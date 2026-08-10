import { describe, it, expect } from 'vitest';
import { shiftMonth } from '@/lib/officeMetrics';
import { computeAttention } from '../attention';
import type { MapOffice } from '../types';

const NOW = '2026-08';

/** A MapOffice with only the fields this module reads; the rest is filler. */
function office(id: string, newestFirst: number[], overrides: Partial<MapOffice> = {}): MapOffice {
  const monthly: Record<string, number> = {};
  newestFirst.forEach((count, i) => {
    monthly[shiftMonth(NOW, -i)] = count;
  });

  return {
    id,
    name: id,
    address: null,
    phone: null,
    email: null,
    website: null,
    google_rating: null,
    latitude: 33.7,
    longitude: -117.8,
    tier: 'Warm',
    percentile: 50,
    l12: 0,
    r3: 0,
    mslr: 0,
    totalReferrals: 0,
    currentMonthReferrals: 0,
    lastActiveMonth: null,
    monthly,
    ...overrides,
  };
}

describe('computeAttention', () => {
  it('ranks by patients lost per month, not by percentage', () => {
    const vip = office('vip', [7, 7, 7, 12, 12, 12]); // -5/mo, a 42% drop
    const tiny = office('tiny', [0, 0, 0, 2, 2, 2]); // -2/mo, a 100% drop

    const { items } = computeAttention([tiny, vip], NOW);

    // The 100% drop is the smaller loss and must not lead.
    expect(items.map((i) => i.office.id)).toEqual(['vip', 'tiny']);
    expect(items[0].perMonthDelta).toBe(5);
  });

  it('puts a relationship that stopped ahead of an equal-sized dip', () => {
    const stopped = office('stopped', [0, 0, 0, 3, 3, 3]); // -3/mo, quiet
    const dipped = office('dipped', [3, 3, 3, 6, 6, 6]); // -3/mo, slipping

    const { items } = computeAttention([dipped, stopped], NOW);
    expect(items.map((i) => i.office.id)).toEqual(['stopped', 'dipped']);
  });

  it('lists only the offices losing ground', () => {
    const summary = computeAttention(
      [
        office('growing', [9, 9, 9, 2, 2, 2]),
        office('flat', [4, 4, 4, 4, 4, 4]),
        office('falling', [1, 1, 1, 6, 6, 6]),
        office('silent', [0, 0, 0, 0, 0, 0]),
      ],
      NOW,
    );

    expect(summary.items.map((i) => i.office.id)).toEqual(['falling']);
    expect(summary.risingCount).toBe(1);
  });

  it('reports momentum for every office, healthy ones included', () => {
    const summary = computeAttention(
      [office('a', [9, 9, 9, 2, 2, 2]), office('b', [1, 1, 1, 6, 6, 6])],
      NOW,
    );

    // The map rings every dot, so the lookup must cover offices absent from `items`.
    expect(summary.byId.get('a')).toBe('rising');
    expect(summary.byId.get('b')).toBe('slipping');
    expect(summary.byId.size).toBe(2);
  });

  it('totals the patients per month at stake', () => {
    const summary = computeAttention(
      [office('a', [7, 7, 7, 12, 12, 12]), office('b', [0, 0, 0, 3, 3, 3])],
      NOW,
    );
    expect(summary.patientsPerMonthAtRisk).toBe(8); // 5 + 3
  });

  it('never lists an office at zero loss', () => {
    const { items } = computeAttention([office('flat', [2, 2, 2, 2, 2, 2])], NOW);
    expect(items).toEqual([]);
  });

  it('answers for the month it is given, not for today', () => {
    // Healthy through spring, collapses over summer.
    const collapsing = office('c', [0, 0, 0, 5, 5, 5, 5, 5, 5]);
    expect(computeAttention([collapsing], NOW).items).toHaveLength(1);
    expect(computeAttention([collapsing], '2026-05').items).toHaveLength(0);
  });

  it('returns an empty summary with no month selected', () => {
    const summary = computeAttention([office('a', [0, 0, 0, 9, 9, 9])], null);
    expect(summary.items).toEqual([]);
    expect(summary.byId.size).toBe(0);
    expect(summary.patientsPerMonthAtRisk).toBe(0);
  });

  it('handles an empty office list', () => {
    expect(computeAttention([], NOW).items).toEqual([]);
  });
});
