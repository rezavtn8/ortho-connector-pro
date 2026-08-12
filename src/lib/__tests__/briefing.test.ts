import { describe, it, expect } from 'vitest';
import { buildBriefing, summarizeBriefing, type BriefingOffice } from '../briefing';
import { buildMonthlySeries, type MonthlyRow } from '../officeMetrics';

/**
 * Fixed clock. Momentum reads the last *completed* month, so with NOW in August the
 * reference month is 2026-07: recent window is May–July, baseline is February–April.
 */
const NOW = new Date(2026, 7, 7); // 2026-08-07

const RECENT = ['2026-05', '2026-06', '2026-07'] as const;
const BASELINE = ['2026-02', '2026-03', '2026-04'] as const;

const row = (source_id: string, year_month: string, patient_count: number): MonthlyRow => ({
  source_id,
  year_month,
  patient_count,
});

/** An office with `per` patients in each of the given months. */
function months(id: string, keys: readonly string[], per: number): MonthlyRow[] {
  return keys.map((k) => row(id, k, per));
}

function office(id: string, over: Partial<BriefingOffice> = {}): BriefingOffice {
  return {
    id,
    name: id,
    tier: 'Warm',
    l12: 12,
    r3: 3,
    mslr: 0,
    totalReferrals: 12,
    lastActiveMonth: '2026-07',
    ...over,
  };
}

function run(rows: MonthlyRow[], offices: BriefingOffice[], over = {}) {
  return buildBriefing({
    offices,
    series: buildMonthlySeries(rows),
    lastVisitByOffice: new Map(),
    reviewsUnanswered: 0,
    entriesThisMonth: 5,
    nowDate: NOW,
    ...over,
  });
}

/** Offices with no visit history would otherwise all raise `visit_overdue`. */
const VISITED = (ids: string[]) => new Map(ids.map((id) => [id, '2026-08-01']));

describe('buildBriefing — decline', () => {
  it('flags an office that has gone to zero', () => {
    const b = run(months('a', BASELINE, 4), [office('a')], {
      lastVisitByOffice: VISITED(['a']),
    });
    const quiet = b.signals.find((s) => s.kind === 'quiet');
    expect(quiet).toBeDefined();
    expect(quiet!.tone).toBe('risk');
    expect(quiet!.stake).toBe(4); // 12 over 3 months, all of it lost
    expect(quiet!.headline).toBe('a has stopped referring');
  });

  it('flags a partial decline as slipping, not quiet', () => {
    const b = run([...months('a', BASELINE, 8), ...months('a', RECENT, 2)], [office('a')], {
      lastVisitByOffice: VISITED(['a']),
    });
    expect(b.signals.map((s) => s.kind)).toContain('slipping');
    expect(b.signals.map((s) => s.kind)).not.toContain('quiet');
  });

  it('ignores a drop too small to be worth a line', () => {
    // 3/mo -> 2.67/mo. Real arithmetic, but below both the momentum threshold and MIN_STAKE.
    const b = run(
      [...months('a', BASELINE, 3), row('a', '2026-05', 3), row('a', '2026-06', 3), row('a', '2026-07', 2)],
      [office('a')],
      { lastVisitByOffice: VISITED(['a']) },
    );
    expect(b.signals).toEqual([]);
  });

  it('does not read the in-progress month as a collapse', () => {
    // Steady 4/mo through July, nothing yet in August. August must not count.
    const b = run(
      months('a', [...BASELINE, ...RECENT], 4),
      [office('a')],
      { lastVisitByOffice: VISITED(['a']) },
    );
    expect(b.signals).toEqual([]);
  });
});

describe('buildBriefing — growth', () => {
  it('reports a rising office as good news', () => {
    const b = run([...months('a', BASELINE, 2), ...months('a', RECENT, 6)], [office('a')], {
      lastVisitByOffice: VISITED(['a']),
    });
    const rising = b.signals.find((s) => s.kind === 'rising');
    expect(rising).toBeDefined();
    expect(rising!.tone).toBe('good');
    expect(rising!.stake).toBe(4);
  });

  it('reports a first-time referrer as new', () => {
    const b = run(months('a', RECENT, 2), [office('a')], { lastVisitByOffice: VISITED(['a']) });
    expect(b.signals.find((s) => s.kind === 'new')).toBeDefined();
  });
});

describe('buildBriefing — ranking', () => {
  it('ranks by patients per month at stake, not by severity label', () => {
    // `small` went to zero outright; `big` only slipped — but slipped by far more.
    const b = run(
      [
        ...months('small', BASELINE, 1),
        ...months('big', BASELINE, 12),
        ...months('big', RECENT, 4),
      ],
      [office('small'), office('big')],
      { lastVisitByOffice: VISITED(['small', 'big']) },
    );
    expect(b.signals.map((s) => s.officeName)).toEqual(['big', 'small']);
    expect(b.signals[0].kind).toBe('slipping');
    expect(b.signals[1].kind).toBe('quiet');
  });

  it('sorts chores below anything with patients attached', () => {
    const b = run(months('a', BASELINE, 4), [office('a')], {
      lastVisitByOffice: VISITED(['a']),
      reviewsUnanswered: 3,
    });
    expect(b.signals[0].kind).toBe('quiet');
    expect(b.signals[b.signals.length - 1].stake).toBe(0);
  });

  it('sums every declining office into atRisk', () => {
    const b = run(
      [...months('a', BASELINE, 4), ...months('b', BASELINE, 2)],
      [office('a'), office('b')],
      { lastVisitByOffice: VISITED(['a', 'b']) },
    );
    expect(b.totals.atRisk).toBe(6);
  });
});

describe('buildBriefing — visits', () => {
  it('raises one grouped signal led by the highest-volume overdue office', () => {
    const b = run(
      months('quiet-one', [...BASELINE, ...RECENT], 1),
      [
        office('low', { l12: 2 }),
        office('high', { l12: 40 }),
      ],
      { lastVisitByOffice: new Map([['low', '2026-01-01'], ['high', '2026-01-01']]) },
    );
    const visit = b.signals.find((s) => s.kind === 'visit_overdue');
    expect(visit).toBeDefined();
    expect(visit!.officeName).toBe('high');
    expect(visit!.detail).toContain('and 1 more');
  });

  it('treats a never-visited office as overdue', () => {
    const b = run([], [office('a')], { lastVisitByOffice: new Map() });
    expect(b.signals.find((s) => s.kind === 'visit_overdue')!.detail).toContain('never visited');
  });

  it('treats an unparseable visit date as never visited rather than as today', () => {
    const b = run([], [office('a')], { lastVisitByOffice: new Map([['a', 'not-a-date']]) });
    expect(b.signals.find((s) => s.kind === 'visit_overdue')).toBeDefined();
  });

  it('leaves Cold and Dormant offices out of the visit list', () => {
    const b = run([], [office('a', { tier: 'Cold' }), office('b', { tier: 'Dormant' })], {
      lastVisitByOffice: new Map(),
    });
    expect(b.signals.find((s) => s.kind === 'visit_overdue')).toBeUndefined();
  });

  it('leaves an office that has never referred out of the visit list', () => {
    const b = run([], [office('a', { l12: 0 })], { lastVisitByOffice: new Map() });
    expect(b.signals.find((s) => s.kind === 'visit_overdue')).toBeUndefined();
  });
});

describe('buildBriefing — data health', () => {
  it('says so when the month has no entries yet', () => {
    const b = run([], [], { entriesThisMonth: 0 });
    expect(b.signals.find((s) => s.kind === 'no_entries')).toBeDefined();
  });

  it('stays quiet when the month has entries', () => {
    const b = run([], [], { entriesThisMonth: 3 });
    expect(b.signals.find((s) => s.kind === 'no_entries')).toBeUndefined();
  });
});

describe('buildBriefing — signal shape', () => {
  it('gives every signal a question the assistant can actually answer', () => {
    const b = run(
      [...months('a', BASELINE, 4), ...months('b', BASELINE, 2), ...months('b', RECENT, 6)],
      [office('a'), office('b')],
      { reviewsUnanswered: 1, entriesThisMonth: 0 },
    );
    expect(b.signals.length).toBeGreaterThan(3);
    for (const s of b.signals) {
      expect(s.ask.length).toBeGreaterThan(20);
      expect(s.headline).not.toBe('');
      expect(s.id).not.toBe('');
    }
    expect(new Set(b.signals.map((s) => s.id)).size).toBe(b.signals.length);
  });
});

describe('summarizeBriefing', () => {
  it('states the base the signals move against', () => {
    const b = run(months('a', RECENT, 3), [office('a', { r3: 9 })], {
      lastVisitByOffice: VISITED(['a']),
    });
    expect(summarizeBriefing(b)).toContain('9 patients');
  });

  it('says plainly when nothing is wrong', () => {
    const b = run(months('a', [...BASELINE, ...RECENT], 4), [office('a')], {
      lastVisitByOffice: VISITED(['a']),
    });
    expect(summarizeBriefing(b)).toContain('Nothing is currently declining');
  });

  it('handles an empty network without pretending to have news', () => {
    const b = run([], []);
    expect(summarizeBriefing(b)).toContain('no active referring offices');
  });
});
