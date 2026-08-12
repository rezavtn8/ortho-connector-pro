/**
 * Loads what the briefing needs and computes it.
 *
 * The signals themselves are produced by `buildBriefing`, which is pure and tested.
 * This hook is only the plumbing: four reads, then arithmetic. Nothing here calls a
 * model, which is why the first thing the assistant shows a user is also the thing it
 * is most certain about.
 */

import { useMemo } from 'react';
import { useResilientQuery } from './useResilientQuery';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { now } from '@/lib/dateSync';
import {
  buildMonthlySeries,
  deriveOfficeMetrics,
  monthKey,
  shiftMonth,
  type MonthlyRow,
} from '@/lib/officeMetrics';
import { buildBriefing, summarizeBriefing, type Briefing } from '@/lib/briefing';

/** Momentum needs two 3-month windows, plus headroom for the partial current month. */
const MONTHS_NEEDED = 18;

/** Stable identity, so consumers memoising on it do not rerun every render. */
const EMPTY_TIERS: ReadonlyMap<string, string> = new Map();

interface BriefingData {
  briefing: Briefing;
  summary: string;
  /** office id → tier, for callers that need to label a write correctly. */
  tierByOffice: Map<string, string>;
}

export function useBriefing() {
  const { user } = useAuth();

  const query = useResilientQuery({
    queryKey: ['assistant-briefing', user?.id],
    queryFn: async () => {
      const nowDate = now();
      const since = shiftMonth(monthKey(nowDate), -MONTHS_NEEDED);
      const currentMonth = monthKey(nowDate);

      const [sourcesRes, monthlyRes, visitsRes, reviewsRes] = await Promise.all([
        supabase.from('patient_sources').select('id, name').eq('is_active', true),
        supabase
          .from('monthly_patients')
          .select('source_id, year_month, patient_count')
          .gte('year_month', since),
        // Ordered ascending so the last write per office wins, giving the most recent
        // visit without a per-office query or a group-by the client cannot express.
        supabase
          .from('marketing_visits')
          .select('office_id, visit_date')
          .order('visit_date', { ascending: true }),
        supabase.from('google_reviews').select('review_reply').eq('user_id', user!.id),
      ]);

      if (sourcesRes.error) throw sourcesRes.error;
      if (monthlyRes.error) throw monthlyRes.error;

      const rows = (monthlyRes.data ?? []) as MonthlyRow[];
      const series = buildMonthlySeries(rows);
      const offices = deriveOfficeMetrics(sourcesRes.data ?? [], series, nowDate);

      const lastVisitByOffice = new Map<string, string>();
      for (const v of visitsRes.data ?? []) {
        if (v.office_id && v.visit_date) lastVisitByOffice.set(v.office_id, v.visit_date);
      }

      // Reviews are a soft signal: a practice that has never connected Google Business
      // should see no review chore rather than a query failure.
      const reviewsUnanswered = reviewsRes.error
        ? 0
        : (reviewsRes.data ?? []).filter((r) => !String(r.review_reply ?? '').trim()).length;

      const entriesThisMonth = rows
        .filter((r) => r.year_month === currentMonth)
        .reduce((sum, r) => sum + (r.patient_count ?? 0), 0);

      return {
        offices,
        series,
        lastVisitByOffice,
        reviewsUnanswered,
        entriesThisMonth,
        nowDate,
      };
    },
    staleTime: 5 * 60 * 1000,
    showErrorToast: false,
  });

  const data = useMemo<BriefingData | null>(() => {
    if (!query.data) return null;
    const briefing = buildBriefing(query.data);
    return {
      briefing,
      summary: summarizeBriefing(briefing),
      tierByOffice: new Map(query.data.offices.map((o) => [o.id, o.tier])),
    };
  }, [query.data]);

  return {
    briefing: data?.briefing ?? null,
    summary: data?.summary ?? '',
    tierByOffice: data?.tierByOffice ?? EMPTY_TIERS,
    loading: query.isLoading,
    error: query.error as Error | null,
    refresh: query.refetch,
  };
}
