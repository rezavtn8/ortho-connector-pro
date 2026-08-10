import { describe, it, expect } from 'vitest';
import { aggregateFlows, baselineWindow, resolveWindow, totalPatients } from '../timeWindow';
import type { Flow } from '../types';

const MONTHS = [
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
]; // 12 months, indices 0..11

const LAST = MONTHS.length - 1;

const flow = (sourceId: string, count: number, hubId = 'hub'): Flow => ({
  sourceId,
  hubId,
  count,
});

describe('resolveWindow', () => {
  it('covers the whole axis for "all"', () => {
    const w = resolveWindow(MONTHS, 'all', LAST);
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(LAST);
    expect(w.monthCount).toBe(12);
    expect(w.months).toEqual(MONTHS);
  });

  it('takes a trailing span ending at the cursor', () => {
    const w = resolveWindow(MONTHS, 3, LAST);
    expect(w.months).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(w.monthCount).toBe(3);
  });

  it('treats a single month as a window of one', () => {
    const w = resolveWindow(MONTHS, 1, 4);
    expect(w.months).toEqual(['2026-01']);
    expect(w.startIndex).toBe(4);
    expect(w.endIndex).toBe(4);
  });

  it('reports the months it actually covers near the start of the axis', () => {
    // Four months of history must not be reported as averaging over twelve.
    const w = resolveWindow(MONTHS, 12, 3);
    expect(w.startIndex).toBe(0);
    expect(w.monthCount).toBe(4);
    expect(w.months).toHaveLength(4);
  });

  it('clamps an out-of-range cursor rather than producing a bad slice', () => {
    expect(resolveWindow(MONTHS, 1, 99).endIndex).toBe(LAST);
    expect(resolveWindow(MONTHS, 1, -5).endIndex).toBe(0);
    expect(resolveWindow(MONTHS, 3, 1.7).endIndex).toBe(1);
  });

  it('survives an empty axis', () => {
    const w = resolveWindow([], 'all', 0);
    expect(w.months).toEqual([]);
    expect(w.monthCount).toBe(0);
    expect(w.endIndex).toBe(-1);
  });
});

describe('baselineWindow', () => {
  it('returns the equally sized window that many months earlier', () => {
    const current = resolveWindow(MONTHS, 3, LAST); // Jun..Aug
    const base = baselineWindow(MONTHS, current, 3);
    expect(base!.months).toEqual(['2026-03', '2026-04', '2026-05']);
    expect(base!.monthCount).toBe(3);
  });

  it('supports comparing a 12-month period against the previous 12', () => {
    const twentyFour = [...MONTHS.map((m) => `x-${m}`), ...MONTHS]; // 24 slots
    const current = resolveWindow(twentyFour, 12, 23);
    const base = baselineWindow(twentyFour, current, 12);
    expect(base!.startIndex).toBe(0);
    expect(base!.endIndex).toBe(11);
    expect(base!.monthCount).toBe(12);
  });

  it('refuses a baseline the history cannot cover in full', () => {
    // Comparing 12 months against a truncated 4 would read as a collapse.
    const current = resolveWindow(MONTHS, 12, LAST);
    expect(baselineWindow(MONTHS, current, 12)).toBeNull();
    expect(baselineWindow(MONTHS, current, 1)).toBeNull();
  });

  it('returns null for a non-positive offset', () => {
    const current = resolveWindow(MONTHS, 3, LAST);
    expect(baselineWindow(MONTHS, current, 0)).toBeNull();
    expect(baselineWindow(MONTHS, current, -3)).toBeNull();
  });

  it('returns null when there is no current window', () => {
    expect(baselineWindow([], resolveWindow([], 3, 0), 3)).toBeNull();
  });
});

describe('aggregateFlows', () => {
  const flowsByMonth: Record<string, Flow[]> = {
    '2026-06': [flow('a', 2), flow('b', 5)],
    '2026-07': [flow('a', 3)],
    '2026-08': [flow('a', 1), flow('c', 4)],
  };

  it('sums each office across the window', () => {
    const out = aggregateFlows(flowsByMonth, ['2026-06', '2026-07', '2026-08']);
    expect(out.find((f) => f.sourceId === 'a')!.count).toBe(6);
    expect(out.find((f) => f.sourceId === 'b')!.count).toBe(5);
    expect(out.find((f) => f.sourceId === 'c')!.count).toBe(4);
    expect(out).toHaveLength(3);
  });

  it('keeps each hub leg separate', () => {
    const out = aggregateFlows(
      { m1: [flow('a', 2, 'north'), flow('a', 3, 'south')], m2: [flow('a', 1, 'north')] },
      ['m1', 'm2'],
    );
    expect(out).toHaveLength(2);
    expect(out.find((f) => f.hubId === 'north')!.count).toBe(3);
    expect(out.find((f) => f.hubId === 'south')!.count).toBe(3);
  });

  it('applies the visibility filter', () => {
    const out = aggregateFlows(flowsByMonth, ['2026-06', '2026-08'], (id) => id === 'a');
    expect(out.map((f) => f.sourceId)).toEqual(['a']);
    expect(out[0].count).toBe(3);
  });

  it('does not mutate the source arrays when summing', () => {
    const june = flowsByMonth['2026-06'];
    const before = june.map((f) => f.count);
    aggregateFlows(flowsByMonth, ['2026-06', '2026-07', '2026-08']);
    aggregateFlows(flowsByMonth, ['2026-06', '2026-07', '2026-08']);
    expect(june.map((f) => f.count)).toEqual(before);
  });

  it('returns a copy for a single month, so callers cannot corrupt the cache', () => {
    const out = aggregateFlows(flowsByMonth, ['2026-06']);
    expect(out).not.toBe(flowsByMonth['2026-06']);
    out[0].count = 999;
    expect(flowsByMonth['2026-06'][0].count).toBe(2);
  });

  it('handles missing months and an empty window', () => {
    expect(aggregateFlows(flowsByMonth, ['nope'])).toEqual([]);
    expect(aggregateFlows(flowsByMonth, [])).toEqual([]);
  });
});

describe('totalPatients', () => {
  it('sums counts', () => {
    expect(totalPatients([flow('a', 3), flow('b', 4)])).toBe(7);
    expect(totalPatients([])).toBe(0);
  });
});
