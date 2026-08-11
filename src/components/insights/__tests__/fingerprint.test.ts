import { describe, it, expect } from 'vitest';
import { layoutFingerprint, shortMonthLabel, type FingerprintInput } from '../fingerprint';

const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04'];

const office = (
  id: string,
  tier: FingerprintInput['tier'],
  monthly: Record<string, number>,
): FingerprintInput => ({ id, name: id, tier, monthly });

describe('layoutFingerprint', () => {
  it('aligns every row to the month axis, filling gaps with zero', () => {
    const out = layoutFingerprint([office('a', 'VIP', { '2026-02': 5 })], MONTHS);
    expect(out.rows[0].cells).toEqual([0, 5, 0, 0]);
  });

  it('ignores months outside the axis', () => {
    const out = layoutFingerprint([office('a', 'VIP', { '2025-12': 99, '2026-01': 2 })], MONTHS);
    expect(out.rows[0].total).toBe(2);
  });

  it('treats negative and non-finite counts as empty', () => {
    const out = layoutFingerprint(
      [office('a', 'VIP', { '2026-01': -4, '2026-02': NaN as number, '2026-03': 3 })],
      MONTHS,
    );
    expect(out.rows[0].cells).toEqual([0, 0, 3, 0]);
    expect(out.rows[0].total).toBe(3);
  });

  it('derives the per-row summary numbers', () => {
    const out = layoutFingerprint(
      [office('a', 'VIP', { '2026-01': 1, '2026-03': 9 })],
      MONTHS,
    );
    const r = out.rows[0];
    expect(r.total).toBe(10);
    expect(r.peak).toBe(9);
    expect(r.consistency).toBe(0.5);
    expect(r.lastActiveIndex).toBe(2);
    // First half averages 0.5/mo, second half 4.5/mo.
    expect(r.trend).toBeCloseTo(4, 6);
  });

  it('shares one colour domain across the whole grid', () => {
    const out = layoutFingerprint(
      [office('a', 'VIP', { '2026-01': 3 }), office('b', 'Cold', { '2026-02': 12 })],
      MONTHS,
    );
    expect(out.max).toBe(12);
  });

  it('totals the columns and the grid', () => {
    const out = layoutFingerprint(
      [office('a', 'VIP', { '2026-01': 3, '2026-02': 1 }), office('b', 'Cold', { '2026-01': 4 })],
      MONTHS,
    );
    expect(out.columnTotals).toEqual([7, 1, 0, 0]);
    expect(out.grandTotal).toBe(8);
  });
});

describe('layoutFingerprint — grouping and sorting', () => {
  const rows: FingerprintInput[] = [
    office('cold-big', 'Cold', { '2026-01': 20 }),
    office('vip-small', 'VIP', { '2026-04': 3 }),
    office('vip-big', 'VIP', { '2026-01': 10, '2026-02': 10, '2026-03': 10, '2026-04': 10 }),
    office('dormant', 'Dormant', {}),
  ];

  it('keeps tiers grouped whatever the sort', () => {
    // Sorting the whole grid by volume alone hides the point: a Cold office can
    // out-total a VIP one, and the difference is *where* the ink sits.
    for (const sort of ['volume', 'name', 'recency', 'consistency', 'trend'] as const) {
      const out = layoutFingerprint(rows, MONTHS, sort);
      expect(out.rows.map((r) => r.tier)).toEqual(['VIP', 'VIP', 'Cold', 'Dormant']);
    }
  });

  it('sorts by volume within a tier by default', () => {
    const out = layoutFingerprint(rows, MONTHS);
    expect(out.rows.slice(0, 2).map((r) => r.id)).toEqual(['vip-big', 'vip-small']);
  });

  it('sorts by recency when asked', () => {
    const out = layoutFingerprint(rows, MONTHS, 'recency');
    // Both VIPs last referred in April, so volume breaks the tie.
    expect(out.rows[0].id).toBe('vip-big');
  });

  it('sorts by name when asked', () => {
    const out = layoutFingerprint(rows, MONTHS, 'name');
    expect(out.rows.slice(0, 2).map((r) => r.id)).toEqual(['vip-big', 'vip-small']);
  });

  it('sorts by consistency when asked', () => {
    const out = layoutFingerprint(rows, MONTHS, 'consistency');
    expect(out.rows[0].id).toBe('vip-big'); // 4/4 months vs 1/4
  });

  it('reports contiguous tier groups with counts and totals', () => {
    const out = layoutFingerprint(rows, MONTHS);
    expect(out.groups).toEqual([
      { tier: 'VIP', startRow: 0, count: 2, total: 43 },
      { tier: 'Cold', startRow: 2, count: 1, total: 20 },
      { tier: 'Dormant', startRow: 3, count: 1, total: 0 },
    ]);
  });

  it('is deterministic under ties', () => {
    const tied = [
      office('b', 'VIP', { '2026-01': 5 }),
      office('a', 'VIP', { '2026-01': 5 }),
      office('c', 'VIP', { '2026-01': 5 }),
    ];
    expect(layoutFingerprint(tied, MONTHS).rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(layoutFingerprint(tied, MONTHS)).toEqual(layoutFingerprint(tied, MONTHS));
  });

  it('falls back to volume for an unknown sort key', () => {
    const out = layoutFingerprint(rows, MONTHS, 'nonsense' as never);
    expect(out.rows[0].id).toBe('vip-big');
  });
});

describe('layoutFingerprint — degenerate input', () => {
  it('handles no offices', () => {
    const out = layoutFingerprint([], MONTHS);
    expect(out.rows).toEqual([]);
    expect(out.groups).toEqual([]);
    expect(out.max).toBe(0);
    expect(out.columnTotals).toEqual([0, 0, 0, 0]);
  });

  it('handles no months', () => {
    const out = layoutFingerprint([office('a', 'VIP', { '2026-01': 4 })], []);
    expect(out.rows[0].cells).toEqual([]);
    expect(out.rows[0].consistency).toBe(0);
    expect(out.rows[0].trend).toBe(0);
    expect(Number.isFinite(out.rows[0].trend)).toBe(true);
  });

  it('handles a single month without dividing by zero', () => {
    const out = layoutFingerprint([office('a', 'VIP', { '2026-01': 4 })], ['2026-01']);
    expect(Number.isFinite(out.rows[0].trend)).toBe(true);
  });

  it('skips malformed offices rather than throwing', () => {
    const out = layoutFingerprint(
      [null as never, { id: '', name: 'x', tier: 'VIP', monthly: {} }, office('a', 'VIP', {})],
      MONTHS,
    );
    expect(out.rows.map((r) => r.id)).toEqual(['a']);
  });

  it('tolerates a missing monthly map', () => {
    const out = layoutFingerprint(
      [{ id: 'a', name: 'a', tier: 'VIP' } as FingerprintInput],
      MONTHS,
    );
    expect(out.rows[0].cells).toEqual([0, 0, 0, 0]);
  });
});

describe('shortMonthLabel', () => {
  it('abbreviates the month', () => {
    expect(shortMonthLabel('2026-03')).toEqual({ label: 'Mar', isYearStart: false });
  });

  it('carries the year on January so the axis stays readable', () => {
    expect(shortMonthLabel('2026-01')).toEqual({ label: 'Jan 26', isYearStart: true });
  });
});
