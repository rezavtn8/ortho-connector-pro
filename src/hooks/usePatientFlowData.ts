import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { now } from '@/lib/dateSync';
import { fetchAllRows } from '@/lib/supabasePaging';
import {
  buildMonthlySeries,
  deriveOfficeMetrics,
  monthKey,
  monthRange,
  type MonthlyRow,
} from '@/lib/officeMetrics';
import type { Flow, Hub, MapOffice } from '@/components/map/types';

export const PATIENT_FLOW_QUERY_KEY = ['patient-flow-map'] as const;

/** How far back the month scrubber can reach. */
const MAX_MONTHS = 24;

export interface PatientFlowData {
  hubs: Hub[];
  /** Geocoded offices only — these are the ones that can be drawn. */
  offices: MapOffice[];
  /** Offices with referral history but no coordinates, so the gap isn't silent. */
  unmappedCount: number;
  /** Ascending, gap-free month axis for the scrubber. */
  months: string[];
  flowsByMonth: Record<string, Flow[]>;
  totalsByMonth: Record<string, number>;
  /**
   * Most recent month that actually has referrals, or null if there are none.
   *
   * The month axis always runs to the current calendar month, but counts are
   * typically entered at month end — so on the 7th of a month the newest entry is
   * usually empty. Defaulting the scrubber to the axis end therefore opened the map
   * on a month with zero flows: office dots rendered, but no arcs and no motion,
   * which read as "the map is broken". Always open on real data instead.
   */
  latestMonthWithData: string | null;
  /**
   * Largest single-office monthly count across the *whole* window.
   *
   * Scaling is normalized against this global max rather than a per-month max on
   * purpose: per-month normalization renders every month identically and destroys
   * the "the network grew" story the scrubber exists to tell.
   */
  maxFlowCount: number;
}

const EMPTY: PatientFlowData = {
  hubs: [],
  offices: [],
  unmappedCount: 0,
  months: [],
  flowsByMonth: {},
  totalsByMonth: {},
  latestMonthWithData: null,
  maxFlowCount: 1,
};

/**
 * MULTI-LOCATION SEAM: the single place that decides which location a month's
 * referrals belong to.
 *
 * TODO(multi-location): read `monthly_patients.clinic_id` — the column already
 * exists but no code writes it today — and fall back to the primary hub when null.
 * Until per-location attribution ships, everything flows to the primary hub.
 */
function assignHubId(_sourceId: string, _yearMonth: string, hubs: Hub[]): string {
  return hubs[0].id;
}

/**
 * Everything the patient-flow map needs, in three queries.
 *
 * Replaces `useMapData`, which issued one `calculate_source_score` RPC *per office*
 * in batches of 10 — roughly 15 sequential round-trips at 150 offices. Tier maths
 * now comes from `@/lib/officeMetrics`, shared with the Offices table, so a tier
 * means the same thing on both screens.
 */
export function usePatientFlowData() {
  return useQuery({
    queryKey: PATIENT_FLOW_QUERY_KEY,
    queryFn: async (): Promise<PatientFlowData> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // MULTI-LOCATION SEAM: an array + `.in()`, never `.maybeSingle()`. Adding a
      // second location later means extending this array and nothing else here.
      const clinicIds = [profile?.clinic_id].filter((id): id is string => Boolean(id));

      const [clinicsResult, sourcesResult] = await Promise.all([
        clinicIds.length
          ? supabase
              .from('clinics')
              .select('id, name, address, latitude, longitude')
              .in('id', clinicIds)
          : Promise.resolve({ data: [], error: null } as const),
        supabase
          .from('patient_sources')
          // Deliberately NOT filtering on lat/lng here (the old useMapData did).
          // Fetching ungeocoded offices too is what lets us report `unmappedCount`
          // instead of silently dropping them off the map.
          .select('id, name, address, phone, latitude, longitude, email, website, google_rating')
          .eq('is_active', true)
          .eq('source_type', 'Office'),
      ]);

      if (clinicsResult.error) throw clinicsResult.error;
      if (sourcesResult.error) throw sourcesResult.error;

      const hubs: Hub[] = (clinicsResult.data ?? [])
        .filter((c) => c.latitude != null && c.longitude != null)
        .map((c) => ({
          id: c.id,
          name: c.name || 'My Clinic',
          address: c.address ?? null,
          latitude: c.latitude as number,
          longitude: c.longitude as number,
          isPrimary: c.id === profile?.clinic_id,
        }));

      const sources = sourcesResult.data ?? [];
      if (hubs.length === 0 || sources.length === 0) {
        return { ...EMPTY, hubs, months: [monthKey(now())] };
      }

      // Paged: 42+ offices over 24 months exceeds PostgREST's silent 1000-row cap.
      // Truncation here would show up as phantom empty months on the scrubber.
      const monthlyRows = await fetchAllRows<MonthlyRow>(() =>
        supabase
          .from('monthly_patients')
          .select('source_id, year_month, patient_count')
          .in(
            'source_id',
            sources.map((s) => s.id),
          ),
      );

      const nowDate = now();
      const series = buildMonthlySeries(monthlyRows);
      const months = monthRange(monthlyRows, nowDate, MAX_MONTHS);
      const monthSet = new Set(months);
      const withMetrics = deriveOfficeMetrics(sources, series, nowDate);

      const offices: MapOffice[] = [];
      let unmappedCount = 0;

      for (const o of withMetrics) {
        if (o.latitude == null || o.longitude == null) {
          if (o.totalReferrals > 0) unmappedCount++;
          continue;
        }

        // Restrict the attached history to the visible axis so the sparkline and
        // the scrubber cannot disagree about what "the window" is.
        const monthly: Record<string, number> = {};
        const byMonth = series.get(o.id);
        if (byMonth) {
          for (const [ym, count] of byMonth) {
            if (monthSet.has(ym)) monthly[ym] = count;
          }
        }

        offices.push({
          id: o.id,
          name: o.name,
          address: o.address ?? null,
          phone: o.phone ?? null,
          email: o.email ?? null,
          website: o.website ?? null,
          google_rating: o.google_rating ?? null,
          latitude: o.latitude,
          longitude: o.longitude,
          tier: o.tier,
          percentile: o.percentile,
          l12: o.l12,
          r3: o.r3,
          mslr: o.mslr,
          totalReferrals: o.totalReferrals,
          currentMonthReferrals: o.currentMonthReferrals,
          lastActiveMonth: o.lastActiveMonth,
          monthly,
        });
      }

      const flowsByMonth: Record<string, Flow[]> = {};
      const totalsByMonth: Record<string, number> = {};
      let maxFlowCount = 0;
      let latestMonthWithData: string | null = null;

      for (const month of months) {
        const flows: Flow[] = [];
        let total = 0;

        for (const office of offices) {
          const count = office.monthly[month] ?? 0;
          if (count <= 0) continue; // no referrals that month => no arc
          flows.push({ sourceId: office.id, hubId: assignHubId(office.id, month, hubs), count });
          total += count;
          if (count > maxFlowCount) maxFlowCount = count;
        }

        flowsByMonth[month] = flows;
        totalsByMonth[month] = total;
        // months is ascending, so the last month to set this wins.
        if (flows.length > 0) latestMonthWithData = month;
      }

      return {
        hubs,
        offices,
        unmappedCount,
        months,
        flowsByMonth,
        totalsByMonth,
        latestMonthWithData,
        maxFlowCount: Math.max(1, maxFlowCount),
      };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    // A refetch mid-playback that resets the scrubber is genuinely awful to use.
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}
