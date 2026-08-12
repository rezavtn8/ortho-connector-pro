/**
 * Data behind the Competitor Watch page.
 *
 * Fetches the raw rows and hands them to `competitorIntel` for the analysis.
 * Nothing here computes a number: the page must be able to show the same
 * figures the unit tests pin, so all arithmetic stays in the pure module.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { fetchAllRows } from '@/lib/supabasePaging';
import {
  buildSeries,
  computeExposure,
  detectMovements,
  latestByCompetitor,
  marketPosition,
  velocityPerWeek,
  weeksToCrossover,
  type ExposureReport,
  type MarketPosition,
  type MonthlyCount,
  type Movement,
  type ReferringOffice,
  type SeriesPoint,
  type Snapshot,
  type WatchedCompetitor,
} from '@/lib/competitorIntel';

export interface ClinicRow {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  specialty: string | null;
}

export interface CompetitorRow extends WatchedCompetitor {
  address: string | null;
  specialty: string | null;
  rating: number | null;
  reviews: number;
  /** Reviews per week derived from the series, null until history exists. */
  velocity: number | null;
  series: SeriesPoint[];
  /** Weeks until they pass us on review count, null when not converging. */
  crossoverWeeks: number | null;
  contestedPatients: number;
  threat: number;
  lastSeen: string | null;
}

export interface CompetitorIntel {
  clinic: ClinicRow | null;
  /** Our own watchlist row, present once `bootstrap` has run. */
  selfId: string | null;
  mySnapshot: Snapshot | null;
  mySeries: SeriesPoint[];
  myVelocity: number | null;
  competitors: CompetitorRow[];
  exposure: ExposureReport;
  movements: Movement[];
  position: MarketPosition | null;
  /** Snapshot history is only meaningful once there are two days of it. */
  historyDays: number;
  lastRefreshed: string | null;
  isLoading: boolean;
  error: Error | null;
}

const EMPTY_EXPOSURE: ExposureReport = {
  competitors: [],
  mappedPatients: 0,
  exposedPatients: 0,
  decliningPatients: 0,
  unmappedOffices: 0,
  exposedShare: 0,
};

export function useCompetitorIntel(): CompetitorIntel {
  const { user } = useAuth();

  const clinicQuery = useQuery({
    queryKey: ['competitor-clinic', user?.id],
    queryFn: async (): Promise<ClinicRow | null> => {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (!profile?.clinic_id) return null;

      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, address, latitude, longitude, google_place_id, specialty')
        .eq('id', profile.clinic_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  const clinic = clinicQuery.data ?? null;

  /**
   * Put the practice's own listing on the watchlist so ranks and the review
   * race have a "you" line. Database-only and cheap, unlike the previous
   * version which re-ran the `add` action — and its billed Place Details call
   * — on every mount.
   */
  const bootstrapQuery = useQuery({
    queryKey: ['competitor-bootstrap', clinic?.google_place_id],
    queryFn: async () => {
      const { error } = await supabase.functions.invoke('competitor-snapshot', {
        body: { action: 'bootstrap' },
      });
      if (error) throw error;
      return true;
    },
    enabled: !!clinic?.google_place_id,
    staleTime: Infinity,
    retry: false,
  });

  const watchlistQuery = useQuery({
    queryKey: ['competitor-watchlist', user?.id, bootstrapQuery.isSuccess],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitor_watchlist')
        .select('id, google_place_id, name, address, specialty, latitude, longitude')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const snapshotQuery = useQuery({
    queryKey: ['competitor-snapshots', user?.id],
    queryFn: async (): Promise<Snapshot[]> => {
      // RLS already scopes these to the user, and one competitor a day for a
      // year is well past the silent 1000-row ceiling once a few are tracked.
      return fetchAllRows<Snapshot>(() =>
        supabase
          .from('competitor_snapshots')
          .select('watchlist_id, snapshot_date, google_rating, review_count')
          .order('snapshot_date', { ascending: true }),
      );
    },
    enabled: !!user,
  });

  /** Referring offices and their volume — the half no rival tool has. */
  const referralQuery = useQuery({
    queryKey: ['competitor-referrals', user?.id],
    queryFn: async () => {
      const [offices, monthly] = await Promise.all([
        fetchAllRows<ReferringOffice>(() =>
          supabase
            .from('patient_sources')
            .select('id, name, latitude, longitude')
            .eq('is_active', true),
        ),
        fetchAllRows<MonthlyCount>(() =>
          supabase.from('monthly_patients').select('source_id, year_month, patient_count'),
        ),
      ]);
      return { offices, monthly };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  return useMemo<CompetitorIntel>(() => {
    const watchlist = (watchlistQuery.data ?? []) as CompetitorRow[];
    const snapshots = snapshotQuery.data ?? [];
    const offices = referralQuery.data?.offices ?? [];
    const monthly = referralQuery.data?.monthly ?? [];

    const series = buildSeries(snapshots);
    const latest = latestByCompetitor(snapshots);

    const selfRow = clinic?.google_place_id
      ? watchlist.find((w) => w.google_place_id === clinic.google_place_id)
      : undefined;
    const selfId = selfRow?.id ?? null;
    const mySeries = (selfId && series.get(selfId)) || [];
    const mySnapshot = (selfId && latest.get(selfId)) || null;

    const rivals = watchlist.filter((w) => w.id !== selfId);

    const exposure = clinic
      ? computeExposure({
          clinic,
          competitors: rivals,
          offices,
          monthly,
          latest,
          mine: mySnapshot,
        })
      : EMPTY_EXPOSURE;

    const exposureById = new Map(exposure.competitors.map((c) => [c.competitorId, c]));

    const competitors: CompetitorRow[] = rivals
      .map((row) => {
        const points = series.get(row.id) ?? [];
        const snapshot = latest.get(row.id);
        const stake = exposureById.get(row.id);
        return {
          ...row,
          rating: snapshot?.google_rating ?? null,
          reviews: snapshot?.review_count ?? 0,
          velocity: velocityPerWeek(points),
          series: points,
          crossoverWeeks: weeksToCrossover(mySeries, points),
          contestedPatients: stake?.contestedPatients ?? 0,
          threat: stake?.threat ?? 0,
          lastSeen: snapshot?.snapshot_date ?? null,
        };
      })
      .sort((a, b) => b.threat - a.threat || b.reviews - a.reviews);

    const movements = detectMovements({
      competitors: rivals,
      series,
      selfId,
      mine: mySeries,
    });

    const position = marketPosition(
      mySnapshot,
      competitors.map((c) => ({ rating: c.rating, reviews: c.reviews })),
    );

    const dates = [...new Set(snapshots.map((s) => s.snapshot_date))];
    const lastRefreshed = dates.length ? dates[dates.length - 1] : null;

    return {
      clinic,
      selfId,
      mySnapshot,
      mySeries,
      myVelocity: velocityPerWeek(mySeries),
      competitors,
      exposure,
      movements,
      position,
      historyDays: dates.length,
      lastRefreshed,
      isLoading:
        clinicQuery.isLoading ||
        watchlistQuery.isLoading ||
        snapshotQuery.isLoading ||
        referralQuery.isLoading,
      error:
        (clinicQuery.error as Error | null) ??
        (watchlistQuery.error as Error | null) ??
        (snapshotQuery.error as Error | null) ??
        (referralQuery.error as Error | null) ??
        null,
    };
  }, [
    clinic,
    clinicQuery.isLoading,
    clinicQuery.error,
    watchlistQuery.data,
    watchlistQuery.isLoading,
    watchlistQuery.error,
    snapshotQuery.data,
    snapshotQuery.isLoading,
    snapshotQuery.error,
    referralQuery.data,
    referralQuery.isLoading,
    referralQuery.error,
  ]);
}

/** A practice picked from suggestions or search, on its way to the watchlist. */
export interface WatchlistCandidate {
  google_place_id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  specialty?: string | null;
  clinic_id?: string;
}

interface RefreshResult {
  refreshed?: number;
  skipped?: number;
  failed?: number;
  upToDate?: boolean;
}

/** Add, remove and refresh, with the cache invalidation they each imply. */
export function useCompetitorActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['competitor-watchlist'] });
    queryClient.invalidateQueries({ queryKey: ['competitor-snapshots'] });
    queryClient.invalidateQueries({ queryKey: ['competitor-suggestions'] });
  };

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('competitor-snapshot', { body });
    if (error) throw error;
    // The function reports its own failures in the body with a 200, so a null
    // `error` alone is not proof the action succeeded.
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const add = useMutation<unknown, Error, WatchlistCandidate>({
    mutationFn: (entry) => invoke({ action: 'add', watchlist_entry: entry }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Now watching' });
    },
    onError: (e: Error) => toast({ title: 'Could not add', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation<unknown, Error, string>({
    mutationFn: (id) => invoke({ action: 'remove', watchlist_entry: { id } }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Removed from watchlist' });
    },
    onError: (e: Error) => toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }),
  });

  const refresh = useMutation<RefreshResult, Error, boolean>({
    mutationFn: (force) => invoke({ action: 'refresh', force }) as Promise<RefreshResult>,
    onSuccess: (data) => {
      invalidate();
      if (data?.upToDate) {
        toast({ title: 'Already up to date today' });
      } else {
        const failed = data?.failed ?? 0;
        toast({
          title: `Refreshed ${data?.refreshed ?? 0} practices`,
          description: failed > 0 ? `${failed} could not be reached and were left unchanged` : undefined,
        });
      }
    },
    onError: (e: Error) => toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' }),
  });

  return { add, remove, refresh };
}
