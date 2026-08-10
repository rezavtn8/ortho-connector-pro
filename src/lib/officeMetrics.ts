/**
 * Shared referral-metric derivation for referring offices.
 *
 * This is the single definition of L12 / R3 / MSLR and of the VIP/Warm/Cold/Dormant
 * tier vocabulary. Both the Offices table (`useOffices`) and the patient-flow map
 * (`usePatientFlowData`) call into here, so a tier means the same thing on both —
 * previously the map used a separate RPC-derived vocabulary (Strong/Moderate/
 * Sporadic/Cold) and `/map-view?tier=VIP` links from the Offices page were
 * meaningless.
 *
 * Deliberately pure: no React, no Supabase, no date-fns, no mapbox. `vitest.config.ts`
 * runs `environment: "node"`, so this module must not touch `window` at import time.
 * `nowDate` is always injected rather than read from a clock, which is what makes the
 * quartile and MSLR behaviour testable.
 *
 * Note: the server-side `office_metrics` view also computes a `tier`, but with a
 * *different* definition. Using it would re-open the vocabulary split this module
 * exists to close. If server-side tiers are ever wanted, `deriveOfficeMetrics` is the
 * one place to swap.
 */

export type FlowTier = 'VIP' | 'Warm' | 'Cold' | 'Dormant';

/** Legacy scoring kept for backwards compatibility with existing UI. */
export type LegacyStrength = 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
export type LegacyCategory = 'VIP' | 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';

export interface MonthlyRow {
  source_id: string;
  year_month: string;
  patient_count: number;
}

/** sourceId -> (year_month -> patient_count) */
export type MonthlySeries = Map<string, Map<string, number>>;

export interface OfficeMetrics {
  currentMonthReferrals: number;
  totalReferrals: number;
  l12: number;
  r3: number;
  mslr: number;
  lastActiveMonth: string | null;
  strength: LegacyStrength;
  category: LegacyCategory;
  tier: FlowTier;
  percentile: number | null;
}

/** `Date` -> `'YYYY-MM'`, in local time (matches how `year_month` is written elsewhere). */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The `count` most recent month keys ending at `nowDate`, ascending. */
function recentMonthKeys(nowDate: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(monthKey(new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)));
  }
  return out;
}

/** `'YYYY-MM'` keys are the app's month vocabulary everywhere. */
export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Move a `'YYYY-MM'` key by `delta` months, in either direction.
 *
 * Goes through `Date` rather than doing the arithmetic by hand so year rollover in
 * both directions is the platform's problem, not ours.
 */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

/** Add one month to a `'YYYY-MM'` key. */
function nextMonth(key: string): string {
  return shiftMonth(key, 1);
}

/**
 * Which way a referral relationship is moving, judged against its own past.
 *
 * Deliberately relative, not absolute. An office that has always sent one patient a
 * month and still does is `steady`, and a VIP dropping from twelve a month to seven
 * is `slipping` — even though the VIP still out-refers the small office four to one.
 * A fixed threshold would report the exact opposite, which is the whole reason the
 * decline this product exists to catch goes unnoticed: the big relationships stay
 * near the top of the list the entire time they are dying.
 */
export type Momentum = 'new' | 'rising' | 'steady' | 'slipping' | 'quiet';

export interface MomentumReading {
  momentum: Momentum;
  /** Patients over the `window` months ending at, and including, the reference month. */
  recent: number;
  /** Patients over the `window` months immediately before those. */
  baseline: number;
  /** Patients per month lost against baseline. Negative means gaining. */
  perMonthDelta: number;
  /** Share of the baseline given up, 0..1. Zero while flat or gaining. */
  dropShare: number;
}

/**
 * Three months a side.
 *
 * One month is mostly noise — referrals arrive in clumps, and a dentist on holiday
 * looks identical to a dentist who has switched specialists. Three is long enough to
 * absorb that and still short enough to notice a decline inside a quarter, which is
 * the window the product promises to beat.
 */
export const MOMENTUM_WINDOW = 3;

/** Below this many patients in the baseline, there is no trend to read — only noise. */
const MIN_BASELINE = 2;

/** How much of the baseline must move before it counts as a direction rather than jitter. */
const SIGNIFICANT_SHARE = 0.25;

const NEUTRAL: MomentumReading = {
  momentum: 'steady',
  recent: 0,
  baseline: 0,
  perMonthDelta: 0,
  dropShare: 0,
};

function sumWindow(
  monthly: Readonly<Record<string, number>>,
  endMonth: string,
  window: number,
): number {
  let total = 0;
  for (let i = 0; i < window; i++) {
    total += monthly[shiftMonth(endMonth, -i)] ?? 0;
  }
  return total;
}

/**
 * Read an office's momentum as of `month`.
 *
 * Evaluated at the given month rather than at "now" on purpose: every other reading
 * on the map is relative to the scrubber, so this one is too. Parked at the newest
 * month with data — where the map opens — it is the current state of the business;
 * dragged backwards it answers "what was going wrong then", which is what makes
 * playback worth watching.
 */
export function computeMomentum(
  monthly: Readonly<Record<string, number>>,
  month: string,
  window: number = MOMENTUM_WINDOW,
): MomentumReading {
  if (!month || !MONTH_KEY_PATTERN.test(month) || window < 1) return NEUTRAL;

  const recent = sumWindow(monthly, month, window);
  const baseline = sumWindow(monthly, shiftMonth(month, -window), window);

  const perMonthDelta = (baseline - recent) / window;
  const dropShare = baseline > 0 ? Math.max(0, (baseline - recent) / baseline) : 0;
  const reading = { recent, baseline, perMonthDelta, dropShare };

  if (baseline === 0) {
    return { ...reading, momentum: recent > 0 ? 'new' : 'steady' };
  }
  // Gone silent outright. Ranked ahead of a partial drop of the same size, because
  // a relationship at zero has usually gone somewhere else rather than gone slow.
  if (recent === 0 && baseline >= MIN_BASELINE) {
    return { ...reading, momentum: 'quiet' };
  }
  if (baseline < MIN_BASELINE) {
    return { ...reading, momentum: 'steady' };
  }

  const share = (baseline - recent) / baseline;
  if (share >= SIGNIFICANT_SHARE) return { ...reading, momentum: 'slipping' };
  if (share <= -SIGNIFICANT_SHARE) return { ...reading, momentum: 'rising' };
  return { ...reading, momentum: 'steady' };
}

/**
 * Group raw rows into a per-source month map.
 *
 * Duplicate (source_id, year_month) rows are summed rather than last-write-wins.
 * There should not be duplicates, but summing is the safer reading of "how many
 * patients came from this office that month".
 */
export function buildMonthlySeries(rows: readonly MonthlyRow[]): MonthlySeries {
  const series: MonthlySeries = new Map();
  for (const row of rows) {
    if (!row?.source_id || !row.year_month) continue;
    let byMonth = series.get(row.source_id);
    if (!byMonth) {
      byMonth = new Map();
      series.set(row.source_id, byMonth);
    }
    byMonth.set(row.year_month, (byMonth.get(row.year_month) ?? 0) + (row.patient_count ?? 0));
  }
  return series;
}

/**
 * A gap-free ascending month axis for the scrubber, ending at the current month.
 *
 * Months with zero referrals must still be present as scrubber stops — otherwise
 * playback silently skips quiet periods and "watch the network grow" is illegible.
 * Capped at `maxMonths`, keeping the most recent ones.
 */
export function monthRange(
  rows: readonly MonthlyRow[],
  nowDate: Date,
  maxMonths = 24,
): string[] {
  const current = monthKey(nowDate);

  let earliest: string | null = null;
  for (const row of rows) {
    const ym = row?.year_month;
    // Ignore malformed or future-dated keys; a bad row must not stretch the axis.
    if (!ym || !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym) || ym > current) continue;
    if (earliest === null || ym < earliest) earliest = ym;
  }

  if (earliest === null) return [current];

  const months: string[] = [];
  for (let m = earliest; m <= current; m = nextMonth(m)) {
    months.push(m);
    if (months.length > 1000) break; // guard against a corrupt earliest key
  }

  return months.length > maxMonths ? months.slice(months.length - maxMonths) : months;
}

/**
 * Derive per-office metrics and assign tiers.
 *
 * Tiering is relative, not absolute: offices with no referrals in 6+ months are
 * `Dormant`; the rest are ranked by lifetime referrals (MSLR breaks ties) and split
 * into quartiles — top 25% `VIP`, next 25% `Warm`, bottom 50% `Cold`.
 *
 * Returns active offices first (ranked), then dormant ones, preserving the ordering
 * the Offices table has always received.
 */
export function deriveOfficeMetrics<S extends { id: string }>(
  sources: readonly S[],
  series: MonthlySeries,
  nowDate: Date,
): Array<S & OfficeMetrics> {
  const currentMonth = monthKey(nowDate);
  const last12 = new Set(recentMonthKeys(nowDate, 12));
  const last3 = new Set(recentMonthKeys(nowDate, 3));
  const nowMs = nowDate.getTime();

  const measured = (sources ?? []).map((source) => {
    const byMonth = series.get(source.id);

    let totalReferrals = 0;
    let l12 = 0;
    let r3 = 0;
    let lastActiveMonth: string | null = null;

    if (byMonth) {
      for (const [ym, count] of byMonth) {
        totalReferrals += count;
        if (last12.has(ym)) l12 += count;
        if (last3.has(ym)) r3 += count;
        if (count > 0 && (lastActiveMonth === null || ym > lastActiveMonth)) {
          lastActiveMonth = ym;
        }
      }
    }

    const currentMonthReferrals = byMonth?.get(currentMonth) ?? 0;

    // Months since last referral. 999 == "never referred", which sorts to dormant.
    const mslr = lastActiveMonth
      ? Math.floor(
          (nowMs - new Date(`${lastActiveMonth}-01`).getTime()) / (1000 * 60 * 60 * 24 * 30),
        )
      : 999;

    let strength: LegacyStrength = 'Cold';
    if (r3 >= 5 && mslr <= 2) strength = 'Strong';
    else if (r3 >= 2 && mslr <= 3) strength = 'Moderate';
    else if (totalReferrals > 0 && mslr <= 6) strength = 'Sporadic';

    const category: LegacyCategory =
      totalReferrals >= 20 && currentMonthReferrals >= 8 ? 'VIP' : strength;

    return {
      source,
      currentMonthReferrals,
      totalReferrals,
      l12,
      r3,
      mslr,
      lastActiveMonth,
      strength,
      category,
    };
  });

  const dormant = measured.filter((m) => m.mslr >= 6);
  const active = measured.filter((m) => m.mslr < 6);

  active.sort((a, b) => {
    if (b.totalReferrals !== a.totalReferrals) return b.totalReferrals - a.totalReferrals;
    return a.mslr - b.mslr; // more recent activity wins the tie
  });

  const out: Array<S & OfficeMetrics> = [];
  const activeCount = active.length;

  if (activeCount > 0) {
    const q1 = Math.ceil(activeCount * 0.25);
    const q2 = Math.ceil(activeCount * 0.5);

    active.forEach((item, index) => {
      const tier: FlowTier = index < q1 ? 'VIP' : index < q2 ? 'Warm' : 'Cold';
      out.push({
        ...item.source,
        currentMonthReferrals: item.currentMonthReferrals,
        totalReferrals: item.totalReferrals,
        l12: item.l12,
        r3: item.r3,
        mslr: item.mslr,
        lastActiveMonth: item.lastActiveMonth,
        strength: item.strength,
        category: item.category,
        tier,
        percentile: Math.round(((activeCount - index) / activeCount) * 100),
      });
    });
  }

  for (const item of dormant) {
    out.push({
      ...item.source,
      currentMonthReferrals: item.currentMonthReferrals,
      totalReferrals: item.totalReferrals,
      l12: item.l12,
      r3: item.r3,
      mslr: item.mslr,
      lastActiveMonth: item.lastActiveMonth,
      strength: item.strength,
      category: item.category,
      tier: 'Dormant',
      percentile: null,
    });
  }

  return out;
}
