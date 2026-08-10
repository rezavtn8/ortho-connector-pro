import { describe, it, expect } from 'vitest';
import { computeMomentum, shiftMonth, MOMENTUM_WINDOW } from '../officeMetrics';

/**
 * Tests for the "is this relationship dying?" question.
 *
 * The product's headline claim is that it notices a referral decline before it costs
 * a quarter. That claim is this function. A wrong answer here is not a cosmetic bug:
 * it is the map telling an owner that a relationship they are losing is fine.
 */

/** Build a `monthly` record backwards from `end`, newest count first. */
function series(end: string, newestFirst: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  newestFirst.forEach((count, i) => {
    out[shiftMonth(end, -i)] = count;
  });
  return out;
}

const NOW = '2026-08';

describe('shiftMonth', () => {
  it('moves forward and backward across a year boundary', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-08', -12)).toBe('2025-08');
    expect(shiftMonth('2026-03', -6)).toBe('2025-09');
  });

  it('is the identity at zero', () => {
    expect(shiftMonth('2026-08', 0)).toBe('2026-08');
  });
});

describe('computeMomentum', () => {
  it('reads three months a side', () => {
    expect(MOMENTUM_WINDOW).toBe(3);
    // recent = Jun+Jul+Aug = 6, baseline = Mar+Apr+May = 30
    const r = computeMomentum(series(NOW, [2, 2, 2, 10, 10, 10]), NOW);
    expect(r.recent).toBe(6);
    expect(r.baseline).toBe(30);
  });

  it('flags a big office losing a quarter of its volume', () => {
    // 12/mo -> 8/mo. Still the biggest referrer on the map, and still dying.
    const r = computeMomentum(series(NOW, [8, 8, 8, 12, 12, 12]), NOW);
    expect(r.momentum).toBe('slipping');
    expect(r.perMonthDelta).toBe(4);
    expect(r.dropShare).toBeCloseTo(0.333, 2);
  });

  it('leaves a small but consistent office alone', () => {
    // One a month forever. Never interesting, must never cry wolf.
    const r = computeMomentum(series(NOW, [1, 1, 1, 1, 1, 1]), NOW);
    expect(r.momentum).toBe('steady');
    expect(r.perMonthDelta).toBe(0);
  });

  it('calls a relationship that stopped outright quiet', () => {
    const r = computeMomentum(series(NOW, [0, 0, 0, 4, 5, 3]), NOW);
    expect(r.momentum).toBe('quiet');
    expect(r.recent).toBe(0);
    expect(r.dropShare).toBe(1);
  });

  it('does not call a one-patient office quiet — that is noise, not a signal', () => {
    const r = computeMomentum(series(NOW, [0, 0, 0, 1, 0, 0]), NOW);
    expect(r.momentum).toBe('steady');
  });

  it('recognises growth', () => {
    const r = computeMomentum(series(NOW, [9, 8, 7, 3, 2, 2]), NOW);
    expect(r.momentum).toBe('rising');
    expect(r.perMonthDelta).toBeLessThan(0);
    expect(r.dropShare).toBe(0); // never negative; "drop" means drop
  });

  it('marks a first-time referrer new rather than rising', () => {
    const r = computeMomentum(series(NOW, [3, 2, 1, 0, 0, 0]), NOW);
    expect(r.momentum).toBe('new');
    expect(r.baseline).toBe(0);
  });

  it('treats total silence as steady, not as a drop', () => {
    // Already Dormant by tier. Reporting it as newly slipping every month is noise.
    const r = computeMomentum(series(NOW, [0, 0, 0, 0, 0, 0]), NOW);
    expect(r.momentum).toBe('steady');
    expect(r.perMonthDelta).toBe(0);
  });

  it('ignores months outside the two windows', () => {
    const withHistory = series(NOW, [3, 3, 3, 3, 3, 3, 99, 99]);
    const withoutHistory = series(NOW, [3, 3, 3, 3, 3, 3]);
    expect(computeMomentum(withHistory, NOW)).toEqual(computeMomentum(withoutHistory, NOW));
  });

  it('reads the past when asked about a past month', () => {
    // Quiet now, but healthy back in March — playback has to show that.
    const monthly = series(NOW, [0, 0, 0, 0, 0, 6, 6, 6, 2, 2, 2]);
    expect(computeMomentum(monthly, NOW).momentum).toBe('quiet');
    expect(computeMomentum(monthly, '2026-03').momentum).toBe('rising');
  });

  it('holds a steady reading at a boundary where the drop is exactly the threshold', () => {
    // 4/mo -> 3/mo is exactly 25%: significant by the stated rule, inclusive.
    const r = computeMomentum(series(NOW, [3, 3, 3, 4, 4, 4]), NOW);
    expect(r.dropShare).toBeCloseTo(0.25, 5);
    expect(r.momentum).toBe('slipping');
  });

  it('returns a neutral reading for a malformed month key', () => {
    for (const bad of ['', 'nonsense', '2026-13', '2026-1']) {
      expect(computeMomentum(series(NOW, [5, 5, 5, 1, 1, 1]), bad).momentum).toBe('steady');
    }
  });

  it('handles an empty history without throwing', () => {
    expect(computeMomentum({}, NOW).momentum).toBe('steady');
  });
});
