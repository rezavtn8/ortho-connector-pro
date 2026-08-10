import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { now } from '@/lib/dateSync';
import { fetchAllRows } from '@/lib/supabasePaging';
import {
  buildMonthlySeries,
  monthKey,
  monthRange,
  type MonthlySeries,
  type MonthlyRow,
} from '@/lib/officeMetrics';
import { tierSnapshot } from '@/lib/tierSnapshot';
import {
  toOutreachEvents,
  type DeliveryRow,
  type OfficeEmailRow,
  type OutreachEvent,
  type VisitRow,
} from '@/components/insights/outreach';
import type { SourceType } from '@/lib/database.types';

export const INSIGHTS_QUERY_KEY = ['insights'] as const;

/** Matches the map's scrubber reach, so the two pages offer the same history. */
const MAX_MONTHS = 24;

export interface InsightsOffice {
  id: string;
  name: string;
  /** As of `now()` — the same value the Offices page badges. */
  tier: 'VIP' | 'Warm' | 'Cold' | 'Dormant';
  percentile: number | null;
  totalReferrals: number;
  l12: number;
  r3: number;
  mslr: number;
  lastActiveMonth: string | null;
  /** year_month -> count, restricted to the visible month axis. */
  monthly: Record<string, number>;
}

export interface InsightsSource {
  id: string;
  name: string;
  /** Never `'Office'` — offices live in `offices` and carry a tier. */
  sourceType: Exclude<SourceType, 'Office'>;
  monthly: Record<string, number>;
}

export interface InsightsData {
  /** Ascending, gap-free month axis. */
  months: string[];
  latestMonthWithData: string | null;
  totalsByMonth: Record<string, number>;

  offices: InsightsOffice[];
  otherSources: InsightsSource[];

  /**
   * The untruncated office series and the exact cohort array it was tiered against.
   *
   * Exposed on purpose. "Tier movement" has to re-derive tiers over a past window, and
   * tiering is relative quartiles over the cohort — rebuilding the cohort from a
   * filtered or reordered `offices` list would move every boundary and invent movement
   * for offices that never moved. Callers must pass these two straight through to
   * `tierSnapshot`.
   */
  officeSeries: MonthlySeries;
  officeCohort: Array<{ id: string; name: string }>;

  outreach: OutreachEvent[];
  clinics: Array<{ id: string; name: string }>;

  counts: {
    offices: number;
    otherSources: number;
    visits: number;
    deliveries: number;
    emails: number;
    /** Offices on the books that have never sent a patient. */
    officesWithNoReferrals: number;
  };
  /**
   * True when campaign data was read at all. `campaign_deliveries` is row-level
   * secured on `created_by`, so a teammate's campaigns are invisible here and
   * "Never contacted" over-counts. The legend says so rather than implying the
   * number is complete.
   */
  campaignScopeIsOwnerOnly: boolean;
}

const EMPTY: InsightsData = {
  months: [],
  latestMonthWithData: null,
  totalsByMonth: {},
  offices: [],
  otherSources: [],
  officeSeries: new Map(),
  officeCohort: [],
  outreach: [],
  clinics: [],
  counts: {
    offices: 0,
    otherSources: 0,
    visits: 0,
    deliveries: 0,
    emails: 0,
    officesWithNoReferrals: 0,
  },
  campaignScopeIsOwnerOnly: true,
};

interface SourceRow {
  id: string;
  name: string;
  source_type: SourceType;
}

/**
 * Everything the Insights diagrams need.
 *
 * Deliberately separate from `usePatientFlowData` rather than an option on it. The map
 * filters `source_type = 'Office'` in SQL, drops every office without coordinates, and
 * precomputes per-month flows for arc caching; Insights needs the opposite on all three
 * — non-office sources are a whole column of the Sankey, and an ungeocoded office still
 * refers patients. Merging them means a flags object on a hook the map depends on, and
 * either a shared key that over-fetches for the map or a per-option key that doubles
 * the cache. What genuinely wants sharing is already shared and already tested:
 * `fetchAllRows`, `buildMonthlySeries`, `deriveOfficeMetrics`, `monthRange`, `now`.
 */
export function useInsightsData() {
  return useQuery({
    queryKey: INSIGHTS_QUERY_KEY,
    queryFn: async (): Promise<InsightsData> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // MULTI-LOCATION SEAM: an array + `.in()`, never `.maybeSingle()` — the same
      // shape `usePatientFlowData` uses, so a second location extends both the same way.
      const clinicIds = [profile?.clinic_id].filter((id): id is string => Boolean(id));

      const [clinicsResult, sources] = await Promise.all([
        clinicIds.length
          ? supabase.from('clinics').select('id, name').in('id', clinicIds)
          : Promise.resolve({ data: [], error: null } as const),
        // No `source_type` filter. This is the whole reason the hook exists: the
        // Sankey's first column is every source type, not just offices. Paged because
        // a practice that has imported prospects can pass 1000 sources.
        fetchAllRows<SourceRow>(() =>
          supabase.from('patient_sources').select('id, name, source_type').eq('is_active', true),
        ),
      ]);

      if (clinicsResult.error) throw clinicsResult.error;

      const clinics = (clinicsResult.data ?? []).map((c) => ({
        id: c.id,
        name: c.name || 'My Clinic',
      }));

      if (sources.length === 0) {
        return { ...EMPTY, clinics, months: [monthKey(now())] };
      }

      // No `.in('source_id', ids)` on any of these. RLS on `monthly_patients`,
      // `marketing_visits` and `office_emails` is already `user_id = auth.uid()`
      // (and `created_by = auth.uid()` on `campaign_deliveries`), so an unfiltered
      // select returns exactly this user's rows. Sending the id list instead would
      // build a ~36 KB query string at 900 sources, and nginx returns 414 long before
      // the row cap bites. Filter client-side against a Set.
      const [monthlyRows, visitRows, deliveryRows, emailRows] = await Promise.all([
        fetchAllRows<MonthlyRow>(() =>
          supabase.from('monthly_patients').select('source_id, year_month, patient_count'),
        ),
        fetchAllRows<VisitRow>(() =>
          supabase.from('marketing_visits').select('office_id, visit_date, visited'),
        ),
        fetchAllRows<DeliveryRow>(() =>
          supabase
            .from('campaign_deliveries')
            .select(
              'office_id, delivered_at, delivery_status, email_status, email_sent_at, created_at',
            ),
        ),
        fetchAllRows<OfficeEmailRow>(() =>
          supabase.from('office_emails').select('office_id, sent_at, created_at, status'),
        ),
      ]);

      const knownIds = new Set(sources.map((s) => s.id));
      const scopedMonthly = monthlyRows.filter((r) => knownIds.has(r.source_id));

      const nowDate = now();
      const months = monthRange(scopedMonthly, nowDate, MAX_MONTHS);
      const monthSet = new Set(months);

      // The cohort predicate must match `useOffices` and `usePatientFlowData` exactly.
      // Tiering is relative quartiles over this array; letting one non-office source in
      // moves the cut points for every real office and the tier badges stop agreeing
      // across pages.
      const officeRows = sources.filter((s) => s.source_type === 'Office');
      const officeIds = new Set(officeRows.map((s) => s.id));
      const officeCohort = officeRows.map((s) => ({ id: s.id, name: s.name }));

      // Fed the office-only series rather than the all-source one. `deriveOfficeMetrics`
      // only ever does `series.get(source.id)`, so the wider map would be harmless
      // today — passing the narrow one makes the constraint explicit instead.
      const officeSeries = buildMonthlySeries(
        scopedMonthly.filter((r) => officeIds.has(r.source_id)),
      );
      const otherSeries = buildMonthlySeries(
        scopedMonthly.filter((r) => !officeIds.has(r.source_id)),
      );

      /** Only the months on the visible axis, so no chart can disagree with the scrubber. */
      const visibleMonthly = (series: MonthlySeries, id: string): Record<string, number> => {
        const monthly: Record<string, number> = {};
        const byMonth = series.get(id);
        if (byMonth) {
          for (const [ym, count] of byMonth) {
            if (monthSet.has(ym)) monthly[ym] = count;
          }
        }
        return monthly;
      };

      // `tierSnapshot` at the current month short-circuits to the exact call
      // `useOffices` makes, so /insights and /offices agree by construction.
      const withMetrics = tierSnapshot(officeCohort, officeSeries, monthKey(nowDate), nowDate);

      let officesWithNoReferrals = 0;
      const offices: InsightsOffice[] = withMetrics.map((o) => {
        if (o.totalReferrals === 0) officesWithNoReferrals++;
        return {
          id: o.id,
          name: o.name,
          tier: o.tier,
          percentile: o.percentile,
          totalReferrals: o.totalReferrals,
          l12: o.l12,
          r3: o.r3,
          mslr: o.mslr,
          lastActiveMonth: o.lastActiveMonth,
          monthly: visibleMonthly(officeSeries, o.id),
        };
      });

      const otherSources: InsightsSource[] = sources
        .filter((s) => s.source_type !== 'Office')
        .map((s) => ({
          id: s.id,
          name: s.name,
          sourceType: s.source_type as Exclude<SourceType, 'Office'>,
          monthly: visibleMonthly(otherSeries, s.id),
        }));

      const totalsByMonth: Record<string, number> = {};
      let latestMonthWithData: string | null = null;
      for (const month of months) {
        let total = 0;
        for (const o of offices) total += o.monthly[month] ?? 0;
        for (const s of otherSources) total += s.monthly[month] ?? 0;
        totalsByMonth[month] = total;
        // months is ascending, so the last month to set this wins.
        if (total > 0) latestMonthWithData = month;
      }

      const outreach = toOutreachEvents({
        visits: visitRows.filter((r) => r?.office_id && officeIds.has(r.office_id)),
        deliveries: deliveryRows.filter((r) => r?.office_id && officeIds.has(r.office_id)),
        emails: emailRows.filter((r) => r?.office_id && officeIds.has(r.office_id)),
      });

      return {
        months,
        latestMonthWithData,
        totalsByMonth,
        offices,
        otherSources,
        officeSeries,
        officeCohort,
        outreach,
        clinics,
        counts: {
          offices: offices.length,
          otherSources: otherSources.length,
          visits: visitRows.length,
          deliveries: deliveryRows.length,
          emails: emailRows.length,
          officesWithNoReferrals,
        },
        campaignScopeIsOwnerOnly: true,
      };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    // A refetch that resets the scrubber mid-read is genuinely awful to use.
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}
