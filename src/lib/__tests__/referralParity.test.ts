/**
 * The edge function carries a copy of `officeMetrics.ts` because Supabase bundles a
 * function from its own directory and cannot import out of `src/`. This test is the
 * thing that stops the copy from drifting.
 *
 * Drift here is not a cosmetic bug. The assistant would tell a user an office is Warm
 * while the Offices table beside it says VIP, and a data product that disagrees with
 * itself is worth less than no data product.
 */

import { describe, it, expect } from 'vitest';
import * as canonical from '../officeMetrics';
import * as mirrored from '../../../supabase/functions/_shared/referral';

const NOW = new Date(2026, 7, 7);

/**
 * A network with every shape the tiering and momentum code branches on: a large
 * steady office, a collapse, a partial decline, a riser, a first-timer, a long-dormant
 * office and one that has never referred at all.
 */
const ROWS: canonical.MonthlyRow[] = [
  ...['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].map((m) => ({
    source_id: 'steady',
    year_month: m,
    patient_count: 9,
  })),
  ...['2026-02', '2026-03', '2026-04'].map((m) => ({
    source_id: 'collapsed',
    year_month: m,
    patient_count: 5,
  })),
  ...['2026-02', '2026-03', '2026-04'].map((m) => ({
    source_id: 'slipping',
    year_month: m,
    patient_count: 8,
  })),
  ...['2026-05', '2026-06', '2026-07'].map((m) => ({
    source_id: 'slipping',
    year_month: m,
    patient_count: 3,
  })),
  ...['2026-02', '2026-03'].map((m) => ({
    source_id: 'rising',
    year_month: m,
    patient_count: 1,
  })),
  ...['2026-05', '2026-06', '2026-07'].map((m) => ({
    source_id: 'rising',
    year_month: m,
    patient_count: 7,
  })),
  { source_id: 'newcomer', year_month: '2026-07', patient_count: 2 },
  { source_id: 'dormant', year_month: '2025-03', patient_count: 30 },
];

const SOURCES = [
  'steady',
  'collapsed',
  'slipping',
  'rising',
  'newcomer',
  'dormant',
  'never',
].map((id) => ({ id }));

const MONTHS = [
  '2025-03',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
];

describe('edge-function copy of officeMetrics', () => {
  it('derives identical metrics and tiers', () => {
    const a = canonical.deriveOfficeMetrics(
      SOURCES,
      canonical.buildMonthlySeries(ROWS),
      NOW,
    );
    const b = mirrored.deriveOfficeMetrics(SOURCES, mirrored.buildMonthlySeries(ROWS), NOW);
    expect(b).toEqual(a);

    // Guard the fixture itself: a parity test over a network where every office
    // landed in one tier would pass while proving nothing.
    expect(new Set(a.map((o) => o.tier)).size).toBeGreaterThan(2);
  });

  it('reads identical momentum in every month', () => {
    const series = canonical.buildMonthlySeries(ROWS);
    for (const source of SOURCES) {
      const monthly = Object.fromEntries(series.get(source.id) ?? new Map());
      for (const month of MONTHS) {
        expect(mirrored.computeMomentum(monthly, month)).toEqual(
          canonical.computeMomentum(monthly, month),
        );
      }
    }
  });

  it('agrees on the month vocabulary', () => {
    expect(mirrored.monthKey(NOW)).toBe(canonical.monthKey(NOW));
    expect(mirrored.shiftMonth('2026-01', -1)).toBe(canonical.shiftMonth('2026-01', -1));
    expect(mirrored.shiftMonth('2026-12', 1)).toBe(canonical.shiftMonth('2026-12', 1));
  });

  it('exports the same surface', () => {
    // A function deleted from one side and not the other is drift the assertions
    // above would silently skip.
    expect(Object.keys(mirrored).sort()).toEqual(Object.keys(canonical).sort());
  });
});
