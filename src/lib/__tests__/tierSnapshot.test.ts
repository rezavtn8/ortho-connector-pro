import { describe, it, expect } from 'vitest';
import {
  asOfDate,
  classifyTierChange,
  hadHistoryBy,
  tierSnapshot,
  truncateSeries,
  TIER_RANK,
} from '../tierSnapshot';
import { buildMonthlySeries, deriveOfficeMetrics, type MonthlyRow } from '../officeMetrics';

/** Fixed clock, matching officeMetrics.test.ts so the two suites agree. */
const NOW = new Date(2026, 7, 7); // 2026-08-07

const row = (source_id: string, year_month: string, patient_count: number): MonthlyRow => ({
  source_id,
  year_month,
  patient_count,
});

const office = (id: string) => ({ id, name: id });

describe('truncateSeries', () => {
  it('drops months after endMonth and keeps the endMonth itself', () => {
    const series = buildMonthlySeries([
      row('a', '2026-01', 1),
      row('a', '2026-03', 2),
      row('a', '2026-04', 3),
    ]);

    const cut = truncateSeries(series, '2026-03');

    expect([...cut.get('a')!.keys()]).toEqual(['2026-01', '2026-03']);
    expect(cut.get('a')!.get('2026-03')).toBe(2);
  });

  it('keeps sources that lose every month, as an empty map', () => {
    const series = buildMonthlySeries([row('a', '2026-06', 4)]);
    const cut = truncateSeries(series, '2026-01');

    expect(cut.has('a')).toBe(true);
    expect(cut.get('a')!.size).toBe(0);
  });

  it('does not alias the input — mutating the result leaves the source untouched', () => {
    const series = buildMonthlySeries([row('a', '2026-01', 1)]);
    const cut = truncateSeries(series, '2026-12');

    cut.get('a')!.set('2026-01', 999);
    cut.delete('a');

    expect(series.get('a')!.get('2026-01')).toBe(1);
  });
});

describe('tierSnapshot — the bug it exists to fix', () => {
  // `late` is idle until 2026-04 and then enormous; `steady` refers a little, early
  // and consistently. As of 2026-03, `steady` is plainly the better relationship.
  const cohort = [office('late'), office('steady')];
  const series = buildMonthlySeries([
    row('steady', '2026-01', 4),
    row('steady', '2026-02', 4),
    row('steady', '2026-03', 4),
    row('late', '2026-04', 100),
    row('late', '2026-05', 100),
  ]);

  it('does not let post-endMonth referrals contaminate a historical ranking', () => {
    const snap = tierSnapshot(cohort, series, '2026-03', NOW);
    const byId = new Map(snap.map((o) => [o.id, o]));

    expect(byId.get('steady')!.tier).toBe('VIP');
    expect(byId.get('late')!.totalReferrals).toBe(0);
    expect(byId.get('late')!.tier).toBe('Dormant');
  });

  it('reproduces the contamination when deriveOfficeMetrics is called directly', () => {
    // This is the call tierSnapshot replaces. Kept as a test so the reason for the
    // module is documented rather than folklore.
    const naive = deriveOfficeMetrics(cohort, series, new Date(2026, 2, 7));
    const byId = new Map(naive.map((o) => [o.id, o]));

    expect(byId.get('late')!.totalReferrals).toBe(200);
    expect(byId.get('late')!.tier).toBe('VIP');
  });

  it('never produces a negative MSLR', () => {
    const snap = tierSnapshot(cohort, series, '2026-03', NOW);
    for (const o of snap) expect(o.mslr).toBeGreaterThanOrEqual(0);
  });

  it('reports an office with no history yet as never-referred', () => {
    const snap = tierSnapshot(cohort, series, '2026-03', NOW);
    expect(snap.find((o) => o.id === 'late')!.mslr).toBe(999);
  });
});

describe('tierSnapshot — agreement with the Offices page', () => {
  const cohort = [office('a'), office('b'), office('c'), office('d')];
  const series = buildMonthlySeries([
    row('a', '2026-08', 10),
    row('b', '2026-07', 6),
    row('c', '2026-06', 3),
    row('d', '2025-01', 1),
  ]);

  it('short-circuits to deriveOfficeMetrics at the current month', () => {
    expect(tierSnapshot(cohort, series, '2026-08', NOW)).toEqual(
      deriveOfficeMetrics(cohort, series, NOW),
    );
  });

  it('short-circuits for a future month too, keeping future-dated rows', () => {
    expect(tierSnapshot(cohort, series, '2027-01', NOW)).toEqual(
      deriveOfficeMetrics(cohort, series, NOW),
    );
  });

  it('short-circuits rather than throwing on an empty endMonth', () => {
    expect(tierSnapshot(cohort, series, '', NOW)).toEqual(deriveOfficeMetrics(cohort, series, NOW));
  });
});

describe('asOfDate', () => {
  it('preserves the reference day-of-month', () => {
    expect(asOfDate('2026-05', new Date(2026, 7, 15)).getDate()).toBe(15);
  });

  it('clamps to the target month when the reference day does not exist there', () => {
    const d = asOfDate('2026-02', new Date(2026, 7, 31));
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });

  it('lands in the month it was asked for', () => {
    const d = asOfDate('2025-11', NOW);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(10);
  });

  it('keeps both snapshots in the same phase, so the dormancy boundary does not drift', () => {
    // An office last active 2025-12, read at 2026-06 and at 2026-07. With a matched
    // day-of-month the MSLR difference is exactly one month, never two.
    const series = buildMonthlySeries([row('a', '2025-12', 5), row('b', '2026-07', 5)]);
    const cohort = [office('a'), office('b')];

    const june = tierSnapshot(cohort, series, '2026-06', NOW).find((o) => o.id === 'a')!;
    const july = tierSnapshot(cohort, series, '2026-07', NOW).find((o) => o.id === 'a')!;

    expect(july.mslr - june.mslr).toBe(1);
  });
});

describe('classifyTierChange', () => {
  it('ranks the tiers best to worst', () => {
    expect(TIER_RANK.VIP).toBeLessThan(TIER_RANK.Warm);
    expect(TIER_RANK.Warm).toBeLessThan(TIER_RANK.Cold);
    expect(TIER_RANK.Cold).toBeLessThan(TIER_RANK.Dormant);
  });

  it('reads a move up the ranks as promoted and down as demoted', () => {
    expect(classifyTierChange('Cold', 'VIP')).toBe('promoted');
    expect(classifyTierChange('VIP', 'Warm')).toBe('demoted');
    expect(classifyTierChange('Cold', 'Dormant')).toBe('demoted');
  });

  it('reads no move as unchanged', () => {
    expect(classifyTierChange('Warm', 'Warm')).toBe('unchanged');
    expect(classifyTierChange('Dormant', 'Dormant')).toBe('unchanged');
  });

  it('reads a first-ever referral as new, not as a promotion out of Dormant', () => {
    expect(classifyTierChange(null, 'Warm')).toBe('new');
    expect(classifyTierChange(null, 'Dormant')).toBe('new');
  });
});

describe('hadHistoryBy', () => {
  const series = buildMonthlySeries([
    row('a', '2026-01', 3),
    row('b', '2026-06', 3),
    row('c', '2026-01', 0),
  ]);

  it('is true only for referrals at or before the month', () => {
    expect(hadHistoryBy(series, 'a', '2026-03')).toBe(true);
    expect(hadHistoryBy(series, 'b', '2026-03')).toBe(false);
    expect(hadHistoryBy(series, 'b', '2026-06')).toBe(true);
  });

  it('ignores zero-count months and unknown sources', () => {
    expect(hadHistoryBy(series, 'c', '2026-12')).toBe(false);
    expect(hadHistoryBy(series, 'missing', '2026-12')).toBe(false);
  });
});
