import { describe, it, expect } from 'vitest';
import {
  buildMonthlySeries,
  deriveOfficeMetrics,
  monthKey,
  monthRange,
  type MonthlyRow,
} from '../officeMetrics';

/** Fixed clock so quartile and MSLR assertions are stable. */
const NOW = new Date(2026, 7, 7); // 2026-08-07
const CURRENT = '2026-08';

const row = (source_id: string, year_month: string, patient_count: number): MonthlyRow => ({
  source_id,
  year_month,
  patient_count,
});

describe('monthKey', () => {
  it('zero-pads single-digit months', () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe('2026-01');
    expect(monthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });
});

describe('buildMonthlySeries', () => {
  it('groups by source then month', () => {
    const s = buildMonthlySeries([row('a', '2026-01', 3), row('b', '2026-01', 5)]);
    expect(s.get('a')!.get('2026-01')).toBe(3);
    expect(s.get('b')!.get('2026-01')).toBe(5);
  });

  it('sums duplicate (source, month) rows rather than overwriting', () => {
    const s = buildMonthlySeries([row('a', '2026-01', 3), row('a', '2026-01', 4)]);
    expect(s.get('a')!.get('2026-01')).toBe(7);
  });

  it('skips malformed rows without throwing', () => {
    const s = buildMonthlySeries([
      row('a', '2026-01', 2),
      { source_id: '', year_month: '2026-01', patient_count: 9 } as MonthlyRow,
      { source_id: 'b', year_month: '', patient_count: 9 } as MonthlyRow,
    ]);
    expect(s.size).toBe(1);
    expect(s.get('a')!.get('2026-01')).toBe(2);
  });
});

describe('monthRange', () => {
  it('returns only the current month when there is no data', () => {
    expect(monthRange([], NOW)).toEqual([CURRENT]);
  });

  it('is gap-free and ascending, ending at the current month', () => {
    // Note the deliberate gap: 2026-04 and 2026-06 have no rows at all.
    const months = monthRange([row('a', '2026-03', 1), row('a', '2026-05', 2)], NOW);
    expect(months).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
  });

  it('spans a year boundary correctly', () => {
    const months = monthRange([row('a', '2025-11', 1)], NOW);
    expect(months[0]).toBe('2025-11');
    expect(months[1]).toBe('2025-12');
    expect(months[2]).toBe('2026-01');
    expect(months[months.length - 1]).toBe(CURRENT);
  });

  it('caps at maxMonths, keeping the most recent', () => {
    const months = monthRange([row('a', '2018-01', 1)], NOW, 24);
    expect(months).toHaveLength(24);
    expect(months[months.length - 1]).toBe(CURRENT);
    expect(months[0]).toBe('2024-09');
  });

  it('ignores malformed and future-dated keys so a bad row cannot stretch the axis', () => {
    const months = monthRange(
      [row('a', 'garbage', 1), row('a', '2026-13', 1), row('a', '2099-01', 1), row('a', '2026-07', 1)],
      NOW,
    );
    expect(months).toEqual(['2026-07', '2026-08']);
  });
});

describe('deriveOfficeMetrics', () => {
  const sources = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

  it('returns an empty array for no sources', () => {
    expect(deriveOfficeMetrics([], new Map(), NOW)).toEqual([]);
  });

  it('carries source fields through onto the result', () => {
    const [out] = deriveOfficeMetrics(
      [{ id: 'a', name: 'A', address: '1 Main St' }],
      buildMonthlySeries([row('a', CURRENT, 4)]),
      NOW,
    );
    expect(out.name).toBe('A');
    expect(out.address).toBe('1 Main St');
  });

  it('computes totals, L12, R3 and current month', () => {
    const series = buildMonthlySeries([
      row('a', CURRENT, 5), // current, in R3 and L12
      row('a', '2026-07', 3), // in R3 and L12
      row('a', '2026-01', 7), // in L12 only
      row('a', '2024-01', 100), // outside L12
    ]);
    const [out] = deriveOfficeMetrics([{ id: 'a' }], series, NOW);
    expect(out.currentMonthReferrals).toBe(5);
    expect(out.r3).toBe(8);
    expect(out.l12).toBe(15);
    expect(out.totalReferrals).toBe(115);
  });

  it('tracks the most recent month with a nonzero count', () => {
    const series = buildMonthlySeries([
      row('a', '2026-05', 2),
      row('a', '2026-07', 0), // zero does not count as active
      row('a', '2026-06', 1),
    ]);
    const [out] = deriveOfficeMetrics([{ id: 'a' }], series, NOW);
    expect(out.lastActiveMonth).toBe('2026-06');
  });

  it('marks an office that never referred as Dormant with mslr 999', () => {
    const [out] = deriveOfficeMetrics([{ id: 'a' }], new Map(), NOW);
    expect(out.mslr).toBe(999);
    expect(out.tier).toBe('Dormant');
    expect(out.percentile).toBeNull();
    expect(out.lastActiveMonth).toBeNull();
  });

  it('splits dormant from active at mslr >= 6', () => {
    const series = buildMonthlySeries([
      row('a', CURRENT, 5), // active
      row('b', '2025-06', 5), // ~14 months ago -> dormant
    ]);
    const out = deriveOfficeMetrics(sources, series, NOW);
    const byId = Object.fromEntries(out.map((o) => [o.id, o]));
    expect(byId.a.tier).not.toBe('Dormant');
    expect(byId.b.tier).toBe('Dormant');
    expect(byId.b.mslr).toBeGreaterThanOrEqual(6);
  });

  it('assigns quartiles over active offices: top 25% VIP, next 25% Warm, rest Cold', () => {
    // 8 active offices with strictly descending volume.
    const ids = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8'];
    const series = buildMonthlySeries(ids.map((id, i) => row(id, CURRENT, 100 - i)));
    const out = deriveOfficeMetrics(ids.map((id) => ({ id })), series, NOW);

    const tierOf = (id: string) => out.find((o) => o.id === id)!.tier;
    expect(tierOf('o1')).toBe('VIP');
    expect(tierOf('o2')).toBe('VIP'); // ceil(8*0.25) = 2
    expect(tierOf('o3')).toBe('Warm');
    expect(tierOf('o4')).toBe('Warm'); // ceil(8*0.50) = 4
    expect(tierOf('o5')).toBe('Cold');
    expect(tierOf('o8')).toBe('Cold');
  });

  it('returns active offices ranked before dormant ones', () => {
    const series = buildMonthlySeries([
      row('dormant', '2024-01', 500), // huge but stale
      row('small', CURRENT, 1),
      row('big', CURRENT, 50),
    ]);
    const out = deriveOfficeMetrics(
      [{ id: 'dormant' }, { id: 'small' }, { id: 'big' }],
      series,
      NOW,
    );
    expect(out.map((o) => o.id)).toEqual(['big', 'small', 'dormant']);
  });

  it('breaks volume ties with the more recently active office', () => {
    const series = buildMonthlySeries([
      row('stale', '2026-06', 10),
      row('fresh', CURRENT, 10),
    ]);
    const out = deriveOfficeMetrics([{ id: 'stale' }, { id: 'fresh' }], series, NOW);
    expect(out[0].id).toBe('fresh');
  });

  it('gives the top-ranked active office a 100 percentile', () => {
    const series = buildMonthlySeries([row('a', CURRENT, 9), row('b', CURRENT, 1)]);
    const out = deriveOfficeMetrics(sources, series, NOW);
    expect(out[0].percentile).toBe(100);
    expect(out[1].percentile).toBe(50);
  });

  it('preserves the legacy strength/category vocabulary', () => {
    const series = buildMonthlySeries([
      row('a', CURRENT, 10),
      row('a', '2026-07', 10),
      row('a', '2026-06', 10),
    ]);
    const [out] = deriveOfficeMetrics([{ id: 'a' }], series, NOW);
    expect(out.strength).toBe('Strong'); // r3 >= 5 && mslr <= 2
    expect(out.category).toBe('VIP'); // total >= 20 && current >= 8
  });
});
