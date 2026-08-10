/**
 * Tiers as they stood at the end of a past month.
 *
 * `deriveOfficeMetrics(cohort, series, pastDate)` looks like it answers this and does
 * not. Three things in it are unbounded by `nowDate`:
 *
 *   1. `totalReferrals` sums every entry of the office's month map, including months
 *      *after* `pastDate`. Since the quartile ranking is by `totalReferrals`, a
 *      "historical" tier is contaminated by the future — an office idle until March
 *      and enormous since would rank VIP "as of March".
 *   2. `lastActiveMonth` is the max over all months, so MSLR (`pastDate - lastActive`)
 *      goes *negative*. `mslr < 6` then reads it as active, and the ranking tie-break
 *      (`a.mslr - b.mslr`) rewards the negative number with a better position than a
 *      genuinely recent office.
 *   3. `strength` and `category` inherit both.
 *
 * Only `l12` and `r3` survive, because they are gated on an explicit month set.
 *
 * The fix is to truncate the *input* rather than change `officeMetrics.ts`: with no
 * months after `endMonth` in the series, all three defects disappear at once and the
 * tier vocabulary stays defined in exactly one place.
 *
 * Deliberately pure, like `officeMetrics.ts`: no React, no Supabase, no clock.
 * `vitest.config.ts` runs `environment: "node"`.
 */

import {
  deriveOfficeMetrics,
  monthKey,
  type FlowTier,
  type MonthlySeries,
  type OfficeMetrics,
} from './officeMetrics';

/** Ranked best to worst. Used to decide promoted vs demoted. */
export const TIER_RANK: Readonly<Record<FlowTier, number>> = {
  VIP: 0,
  Warm: 1,
  Cold: 2,
  Dormant: 3,
};

export type TierChange = 'promoted' | 'demoted' | 'unchanged' | 'new';

/**
 * How an office moved between two snapshots.
 *
 * `from === null` means the office had no referral history at all in the baseline —
 * it is `new`, not `promoted`. Reporting a first-ever referral as a promotion out of
 * Dormant would inflate the "improving" count with offices that never declined.
 */
export function classifyTierChange(from: FlowTier | null, to: FlowTier): TierChange {
  if (from === null) return 'new';
  if (from === to) return 'unchanged';
  return TIER_RANK[to] < TIER_RANK[from] ? 'promoted' : 'demoted';
}

/**
 * A copy of `series` with every month strictly after `endMonth` dropped.
 *
 * Returns fresh Maps at both levels. Sharing the inner Map would let a caller's later
 * mutation reach into the React Query cache the series was built from.
 */
export function truncateSeries(series: MonthlySeries, endMonth: string): MonthlySeries {
  const out: MonthlySeries = new Map();

  for (const [sourceId, byMonth] of series) {
    const kept = new Map<string, number>();
    for (const [ym, count] of byMonth) {
      // 'YYYY-MM' keys are zero-padded, so lexicographic order is chronological order.
      if (ym <= endMonth) kept.set(ym, count);
    }
    out.set(sourceId, kept);
  }

  return out;
}

/** Days in a given month, so a day-of-month carried from another month can be clamped. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * The `nowDate` to hand `deriveOfficeMetrics` when reading a period that ended at
 * `endMonth`.
 *
 * Preserves `reference`'s day-of-month, clamped to the target month's length. MSLR is
 * `floor(days / 30)`, so the day-of-month decides exactly where the 6-month dormancy
 * boundary falls. Anchoring the baseline snapshot on the 1st while the current one
 * sits on the 28th moves that boundary between the two, and an office that never
 * changed shows up as a "Cold to Dormant" transition that is purely a calendar
 * artifact. Same phase in both snapshots, no phantom movement.
 */
export function asOfDate(endMonth: string, reference: Date): Date {
  const [year, month] = endMonth.split('-').map(Number);
  const monthIndex = month - 1;
  const day = Math.min(reference.getDate(), daysInMonth(year, monthIndex));

  return new Date(
    year,
    monthIndex,
    day,
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds(),
  );
}

/**
 * Tiers and metrics for `cohort` as they stood at the end of `endMonth`.
 *
 * Two invariants callers must hold, because both are silent when broken:
 *
 *   - Pass the *same* `cohort` array for every snapshot you intend to compare.
 *     Tiering is relative quartiles over the active set, so ranking "offices that
 *     existed then" against "offices now" shifts every boundary and invents movement
 *     for offices that never moved.
 *   - `cohort` must be the same predicate the rest of the app tiers on —
 *     `is_active = true AND source_type = 'Office'`. Adding one non-office source
 *     moves the quartile cuts for every real office.
 */
export function tierSnapshot<S extends { id: string }>(
  cohort: readonly S[],
  series: MonthlySeries,
  endMonth: string,
  nowDate: Date,
): Array<S & OfficeMetrics> {
  // At or past the present, truncation is a no-op — and it would drop future-dated
  // rows that the Offices page does count. Short-circuiting means the default
  // scrubber position produces byte-identical output to `useOffices`, so /insights
  // and /offices agree by construction rather than by coincidence.
  if (!endMonth || endMonth >= monthKey(nowDate)) {
    return deriveOfficeMetrics(cohort, series, nowDate);
  }

  return deriveOfficeMetrics(cohort, truncateSeries(series, endMonth), asOfDate(endMonth, nowDate));
}

/**
 * Whether an office had any referral history at or before `endMonth`.
 *
 * This is what separates `new` from `promoted` in `classifyTierChange` — an office
 * with no history lands in Dormant in the baseline snapshot for the same reason a
 * long-lapsed one does, and the two must not be reported the same way.
 */
export function hadHistoryBy(
  series: MonthlySeries,
  sourceId: string,
  endMonth: string,
): boolean {
  const byMonth = series.get(sourceId);
  if (!byMonth) return false;

  for (const [ym, count] of byMonth) {
    if (count > 0 && ym <= endMonth) return true;
  }
  return false;
}
