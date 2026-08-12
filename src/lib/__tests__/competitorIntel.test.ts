import { describe, it, expect } from 'vitest';
import {
  buildSeries,
  computeExposure,
  detectMovements,
  haversineMiles,
  latestByCompetitor,
  marketPosition,
  recentMonths,
  reviewsGained,
  trendBySource,
  velocityPerWeek,
  volumeBySource,
  weeksToCrossover,
  type MonthlyCount,
  type ReferringOffice,
  type Snapshot,
  type WatchedCompetitor,
} from '../competitorIntel';

/** Roughly one mile of latitude, for building predictable fixtures. */
const MILE_LAT = 1 / 69;

const CLINIC = { latitude: 34.0, longitude: -118.0 };

function office(id: string, milesNorth: number, name = id): ReferringOffice {
  return { id, name, latitude: 34.0 + milesNorth * MILE_LAT, longitude: -118.0 };
}

function competitor(id: string, milesNorth: number, name = id): WatchedCompetitor {
  return {
    id,
    google_place_id: `place-${id}`,
    name,
    latitude: 34.0 + milesNorth * MILE_LAT,
    longitude: -118.0,
  };
}

function months(count: number, patients: number, sourceId: string, from = '2026-08'): MonthlyCount[] {
  const [y, m] = from.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return {
      source_id: sourceId,
      year_month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      patient_count: patients,
    };
  });
}

const NOW = new Date(Date.UTC(2026, 7, 11)); // 2026-08-11

describe('haversineMiles', () => {
  it('measures a degree of latitude as ~69 miles', () => {
    expect(haversineMiles({ latitude: 34, longitude: -118 }, { latitude: 35, longitude: -118 })).toBeCloseTo(69, 0);
  });

  it('is zero for the same point', () => {
    expect(haversineMiles(CLINIC, CLINIC)).toBe(0);
  });
});

describe('recentMonths', () => {
  it('walks backwards from the anchor month, most recent first', () => {
    expect(recentMonths(3, NOW)).toEqual(['2026-08', '2026-07', '2026-06']);
  });

  it('crosses a year boundary', () => {
    expect(recentMonths(3, new Date(Date.UTC(2026, 0, 15)))).toEqual(['2026-01', '2025-12', '2025-11']);
  });
});

describe('volumeBySource', () => {
  it('sums only the months inside the window', () => {
    const rows: MonthlyCount[] = [
      { source_id: 'a', year_month: '2026-08', patient_count: 5 },
      { source_id: 'a', year_month: '2026-07', patient_count: 3 },
      { source_id: 'a', year_month: '2020-01', patient_count: 99 },
    ];
    expect(volumeBySource(rows, recentMonths(12, NOW)).get('a')).toBe(8);
  });

  it('ignores rows with no source', () => {
    const rows: MonthlyCount[] = [{ source_id: null, year_month: '2026-08', patient_count: 5 }];
    expect(volumeBySource(rows, recentMonths(12, NOW)).size).toBe(0);
  });
});

describe('trendBySource', () => {
  it('reports the fall between adjacent equal windows', () => {
    const rows: MonthlyCount[] = [
      // recent three months: 1 + 1 + 1
      { source_id: 'a', year_month: '2026-08', patient_count: 1 },
      { source_id: 'a', year_month: '2026-07', patient_count: 1 },
      { source_id: 'a', year_month: '2026-06', patient_count: 1 },
      // prior three months: 4 + 4 + 4
      { source_id: 'a', year_month: '2026-05', patient_count: 4 },
      { source_id: 'a', year_month: '2026-04', patient_count: 4 },
      { source_id: 'a', year_month: '2026-03', patient_count: 4 },
    ];
    expect(trendBySource(rows, NOW).get('a')).toBe(-9);
  });

  it('reports growth as positive', () => {
    const rows: MonthlyCount[] = [
      { source_id: 'a', year_month: '2026-08', patient_count: 6 },
      { source_id: 'a', year_month: '2026-05', patient_count: 2 },
    ];
    expect(trendBySource(rows, NOW).get('a')).toBe(4);
  });
});

describe('computeExposure', () => {
  const latest = new Map<string, Snapshot>();

  it('contests an office the competitor is closer to', () => {
    // Office 4mi north; competitor 3mi north is 1mi from it, we are 4mi away.
    const report = computeExposure({
      clinic: CLINIC,
      competitors: [competitor('c1', 3)],
      offices: [office('o1', 4)],
      monthly: months(12, 2, 'o1'),
      latest,
      now: NOW,
    });

    expect(report.competitors).toHaveLength(1);
    expect(report.competitors[0].contestedPatients).toBe(24);
    expect(report.exposedPatients).toBe(24);
    expect(report.mappedPatients).toBe(24);
    expect(report.exposedShare).toBe(1);
    expect(report.competitors[0].offices[0].milesToCompetitor).toBeCloseTo(1, 1);
    expect(report.competitors[0].offices[0].milesToYou).toBeCloseTo(4, 1);
    expect(report.competitors[0].offices[0].advantage).toBeCloseTo(4, 1);
  });

  it('leaves an office alone when we are the closer practice', () => {
    // Office 1mi north, competitor 10mi north — we win it comfortably.
    const report = computeExposure({
      clinic: CLINIC,
      competitors: [competitor('c1', 10)],
      offices: [office('o1', 1)],
      monthly: months(12, 2, 'o1'),
      latest,
      now: NOW,
    });

    expect(report.exposedPatients).toBe(0);
    expect(report.competitors[0].contestedPatients).toBe(0);
    expect(report.competitors[0].threat).toBe(0);
  });

  it('ignores a difference below the noise floor', () => {
    // Competitor 0.05mi nearer the office than we are — inside GPS slop.
    const report = computeExposure({
      clinic: CLINIC,
      competitors: [competitor('c1', 0.05)],
      offices: [office('o1', 5)],
      monthly: months(12, 2, 'o1'),
      latest,
      now: NOW,
    });
    expect(report.exposedPatients).toBe(0);
  });

  it('attributes a jointly contested office to the nearest competitor only', () => {
    const report = computeExposure({
      clinic: CLINIC,
      competitors: [competitor('near', 4.5), competitor('far', 2)],
      offices: [office('o1', 5)],
      monthly: months(12, 1, 'o1'),
      latest,
      now: NOW,
    });

    const near = report.competitors.find((c) => c.competitorId === 'near')!;
    const far = report.competitors.find((c) => c.competitorId === 'far')!;

    expect(near.contestedPatients).toBe(12);
    expect(far.contestedPatients).toBe(0);
    // Both are closer than we are, so both have reach.
    expect(near.reachPatients).toBe(12);
    expect(far.reachPatients).toBe(12);
    // The headline never double counts.
    expect(report.exposedPatients).toBe(12);
  });

  it('flags a contested office whose referrals are also falling', () => {
    const monthly: MonthlyCount[] = [
      { source_id: 'o1', year_month: '2026-08', patient_count: 1 },
      { source_id: 'o1', year_month: '2026-05', patient_count: 9 },
    ];
    const report = computeExposure({
      clinic: CLINIC,
      competitors: [competitor('c1', 3)],
      offices: [office('o1', 4)],
      monthly,
      latest,
      now: NOW,
    });

    expect(report.competitors[0].offices[0].declining).toBe(true);
    expect(report.competitors[0].offices[0].trend).toBe(-8);
    expect(report.decliningPatients).toBe(10);
  });

  it('counts offices with no coordinates as unmapped instead of safe', () => {
    const report = computeExposure({
      clinic: CLINIC,
      competitors: [competitor('c1', 3)],
      offices: [{ id: 'o1', name: 'No GPS', latitude: null, longitude: null }],
      monthly: months(12, 2, 'o1'),
      latest,
      now: NOW,
    });

    expect(report.unmappedOffices).toBe(1);
    expect(report.mappedPatients).toBe(0);
    expect(report.exposedShare).toBe(0);
  });

  it('treats 0,0 coordinates as missing rather than the Gulf of Guinea', () => {
    const report = computeExposure({
      clinic: CLINIC,
      competitors: [competitor('c1', 3)],
      offices: [{ id: 'o1', name: 'Null Island', latitude: 0, longitude: 0 }],
      monthly: months(12, 2, 'o1'),
      latest,
      now: NOW,
    });
    expect(report.unmappedOffices).toBe(1);
  });

  it('skips offices that have never sent a patient', () => {
    const report = computeExposure({
      clinic: CLINIC,
      competitors: [competitor('c1', 3)],
      offices: [office('o1', 4)],
      monthly: [],
      latest,
      now: NOW,
    });
    expect(report.mappedPatients).toBe(0);
    expect(report.competitors[0].offices).toHaveLength(0);
  });

  it('returns nothing usable when the clinic has no address on file', () => {
    const report = computeExposure({
      clinic: null,
      competitors: [competitor('c1', 3)],
      offices: [office('o1', 4)],
      monthly: months(12, 2, 'o1'),
      latest,
      now: NOW,
    });
    expect(report.competitors).toHaveLength(0);
    expect(report.exposedPatients).toBe(0);
  });

  it('ranks the competitor holding more volume first', () => {
    const report = computeExposure({
      clinic: CLINIC,
      competitors: [competitor('small', 3), competitor('big', -3)],
      offices: [office('o1', 4), office('o2', -4)],
      monthly: [...months(12, 1, 'o1'), ...months(12, 10, 'o2')],
      latest,
      now: NOW,
    });
    expect(report.competitors[0].competitorId).toBe('big');
  });

  it('raises threat when the contesting competitor also outranks us', () => {
    const args = {
      clinic: CLINIC,
      competitors: [competitor('c1', 3)],
      offices: [office('o1', 4)],
      monthly: months(12, 2, 'o1'),
      now: NOW,
    };
    const snap = (rating: number, reviews: number): Snapshot => ({
      watchlist_id: 'c1',
      snapshot_date: '2026-08-11',
      google_rating: rating,
      review_count: reviews,
    });

    const weak = computeExposure({
      ...args,
      latest: new Map([['c1', snap(3.5, 10)]]),
      mine: { watchlist_id: 'me', snapshot_date: '2026-08-11', google_rating: 4.9, review_count: 400 },
    });
    const strong = computeExposure({
      ...args,
      latest: new Map([['c1', snap(4.9, 400)]]),
      mine: { watchlist_id: 'me', snapshot_date: '2026-08-11', google_rating: 3.5, review_count: 10 },
    });

    expect(strong.competitors[0].threat).toBeGreaterThan(weak.competitors[0].threat);
  });
});

describe('buildSeries', () => {
  const snaps: Snapshot[] = [
    { watchlist_id: 'c1', snapshot_date: '2026-08-10', google_rating: 4.5, review_count: 20 },
    { watchlist_id: 'c1', snapshot_date: '2026-08-01', google_rating: 4.4, review_count: 12 },
    { watchlist_id: 'c2', snapshot_date: '2026-08-05', google_rating: 4.0, review_count: 5 },
  ];

  it('groups by competitor and orders oldest first', () => {
    const series = buildSeries(snaps);
    expect(series.get('c1')!.map((p) => p.date)).toEqual(['2026-08-01', '2026-08-10']);
    expect(series.get('c2')).toHaveLength(1);
  });

  it('keeps one point per day', () => {
    const series = buildSeries([
      ...snaps,
      { watchlist_id: 'c1', snapshot_date: '2026-08-10', google_rating: 4.6, review_count: 21 },
    ]);
    expect(series.get('c1')).toHaveLength(2);
    expect(series.get('c1')![1].reviews).toBe(21);
  });
});

describe('latestByCompetitor', () => {
  it('picks the newest date regardless of row order', () => {
    const latest = latestByCompetitor([
      { watchlist_id: 'c1', snapshot_date: '2026-08-01', google_rating: 4.4, review_count: 12 },
      { watchlist_id: 'c1', snapshot_date: '2026-08-10', google_rating: 4.5, review_count: 20 },
    ]);
    expect(latest.get('c1')!.review_count).toBe(20);
  });
});

describe('velocityPerWeek', () => {
  it('measures against elapsed days, not snapshot count', () => {
    const series = buildSeries([
      { watchlist_id: 'c', snapshot_date: '2026-08-01', google_rating: 4, review_count: 10 },
      { watchlist_id: 'c', snapshot_date: '2026-08-15', google_rating: 4, review_count: 24 },
    ]).get('c');
    // 14 reviews over 14 days = 7 per week.
    expect(velocityPerWeek(series)).toBeCloseTo(7, 5);
  });

  it('refuses to extrapolate from too little history', () => {
    const series = buildSeries([
      { watchlist_id: 'c', snapshot_date: '2026-08-01', google_rating: 4, review_count: 10 },
      { watchlist_id: 'c', snapshot_date: '2026-08-02', google_rating: 4, review_count: 14 },
    ]).get('c');
    expect(velocityPerWeek(series)).toBeNull();
  });

  it('is null with a single point', () => {
    expect(velocityPerWeek([{ date: '2026-08-01', rating: 4, reviews: 10 }])).toBeNull();
  });

  it('does not go stale when two refreshes land on the same day', () => {
    // The old stored-column approach compared today against today and wrote 0.
    const series = buildSeries([
      { watchlist_id: 'c', snapshot_date: '2026-08-01', google_rating: 4, review_count: 10 },
      { watchlist_id: 'c', snapshot_date: '2026-08-15', google_rating: 4, review_count: 24 },
      { watchlist_id: 'c', snapshot_date: '2026-08-15', google_rating: 4, review_count: 24 },
    ]).get('c');
    expect(velocityPerWeek(series)).toBeCloseTo(7, 5);
  });
});

describe('reviewsGained', () => {
  const series = buildSeries([
    { watchlist_id: 'c', snapshot_date: '2026-07-01', google_rating: 4, review_count: 100 },
    { watchlist_id: 'c', snapshot_date: '2026-07-20', google_rating: 4, review_count: 110 },
    { watchlist_id: 'c', snapshot_date: '2026-08-11', google_rating: 4, review_count: 140 },
  ]).get('c');

  it('measures from the snapshot closest in age to the window', () => {
    // Points sit 41 and 22 days back; 22 is the nearer fit for a 30-day ask.
    expect(reviewsGained(series, 30)).toEqual({ gained: 30, days: 22 });
  });

  it('reports the span it really measured, not the span requested', () => {
    expect(reviewsGained(series, 365)).toEqual({ gained: 40, days: 41 });
  });

  it('is null without a prior snapshot to measure from', () => {
    expect(reviewsGained([{ date: '2026-08-11', rating: 4, reviews: 10 }], 30)).toBeNull();
  });
});

describe('weeksToCrossover', () => {
  const mine = buildSeries([
    { watchlist_id: 'me', snapshot_date: '2026-06-01', google_rating: 4.7, review_count: 380 },
    { watchlist_id: 'me', snapshot_date: '2026-08-10', google_rating: 4.7, review_count: 400 },
  ]).get('me');

  it('projects the week a faster rival passes us', () => {
    const theirs = buildSeries([
      { watchlist_id: 'c', snapshot_date: '2026-06-01', google_rating: 4.5, review_count: 300 },
      { watchlist_id: 'c', snapshot_date: '2026-08-10', google_rating: 4.5, review_count: 380 },
    ]).get('c');
    // Gap 20; they gain ~8.1/wk, we gain ~2.0/wk, so ~6.1/wk closing.
    expect(weeksToCrossover(mine, theirs)).toBe(3);
  });

  it('is null when the gap is not closing', () => {
    const theirs = buildSeries([
      { watchlist_id: 'c', snapshot_date: '2026-06-01', google_rating: 4.5, review_count: 300 },
      { watchlist_id: 'c', snapshot_date: '2026-08-10', google_rating: 4.5, review_count: 301 },
    ]).get('c');
    expect(weeksToCrossover(mine, theirs)).toBeNull();
  });

  it('is null when they are already ahead', () => {
    const theirs = buildSeries([
      { watchlist_id: 'c', snapshot_date: '2026-06-01', google_rating: 4.5, review_count: 500 },
      { watchlist_id: 'c', snapshot_date: '2026-08-10', google_rating: 4.5, review_count: 600 },
    ]).get('c');
    expect(weeksToCrossover(mine, theirs)).toBeNull();
  });

  it('declines to project further out than two years', () => {
    const theirs = buildSeries([
      { watchlist_id: 'c', snapshot_date: '2026-06-01', google_rating: 4.5, review_count: 100 },
      { watchlist_id: 'c', snapshot_date: '2026-08-10', google_rating: 4.5, review_count: 121 },
    ]).get('c');
    expect(weeksToCrossover(mine, theirs)).toBeNull();
  });
});

describe('detectMovements', () => {
  const rival: WatchedCompetitor = {
    id: 'c1',
    google_place_id: 'p1',
    name: 'BrightSmile',
    latitude: 34,
    longitude: -118,
  };

  it('flags a surge against the competitor’s own baseline', () => {
    const series = buildSeries([
      { watchlist_id: 'c1', snapshot_date: '2026-05-01', google_rating: 4.5, review_count: 100 },
      { watchlist_id: 'c1', snapshot_date: '2026-07-05', google_rating: 4.5, review_count: 105 },
      { watchlist_id: 'c1', snapshot_date: '2026-08-04', google_rating: 4.5, review_count: 125 },
    ]);
    const moves = detectMovements({ competitors: [rival], series });
    const surge = moves.find((m) => m.kind === 'review-surge');
    expect(surge).toBeDefined();
    expect(surge!.headline).toContain('20 reviews');
  });

  it('stays quiet when the gain matches their usual rate', () => {
    const series = buildSeries([
      { watchlist_id: 'c1', snapshot_date: '2026-06-11', google_rating: 4.5, review_count: 100 },
      { watchlist_id: 'c1', snapshot_date: '2026-07-11', google_rating: 4.5, review_count: 110 },
      { watchlist_id: 'c1', snapshot_date: '2026-08-11', google_rating: 4.5, review_count: 120 },
    ]);
    expect(detectMovements({ competitors: [rival], series }).some((m) => m.kind === 'review-surge')).toBe(false);
  });

  it('reports a rating slip as an opening', () => {
    const series = buildSeries([
      { watchlist_id: 'c1', snapshot_date: '2026-06-01', google_rating: 4.8, review_count: 100 },
      { watchlist_id: 'c1', snapshot_date: '2026-08-11', google_rating: 4.4, review_count: 101 },
    ]);
    const drop = detectMovements({ competitors: [rival], series }).find((m) => m.kind === 'rating-drop');
    expect(drop).toBeDefined();
    expect(drop!.detail).toContain('0.4');
  });

  it('raises the alarm when a rival crosses above us', () => {
    const series = buildSeries([
      { watchlist_id: 'c1', snapshot_date: '2026-08-01', google_rating: 4.5, review_count: 100 },
      { watchlist_id: 'c1', snapshot_date: '2026-08-11', google_rating: 4.8, review_count: 105 },
    ]);
    const mine = buildSeries([
      { watchlist_id: 'me', snapshot_date: '2026-08-01', google_rating: 4.7, review_count: 400 },
      { watchlist_id: 'me', snapshot_date: '2026-08-11', google_rating: 4.7, review_count: 401 },
    ]).get('me');

    const moves = detectMovements({ competitors: [rival], series, mine });
    expect(moves[0].kind).toBe('overtaken');
    expect(moves[0].severity).toBe('high');
  });

  it('never reports us against ourselves', () => {
    const self: WatchedCompetitor = { ...rival, id: 'me', name: 'My Practice' };
    const series = buildSeries([
      { watchlist_id: 'me', snapshot_date: '2026-05-01', google_rating: 4.5, review_count: 100 },
      { watchlist_id: 'me', snapshot_date: '2026-08-11', google_rating: 4.5, review_count: 160 },
    ]);
    expect(detectMovements({ competitors: [self], series, selfId: 'me' })).toHaveLength(0);
  });

  it('says nothing about a competitor with one snapshot', () => {
    const series = buildSeries([
      { watchlist_id: 'c1', snapshot_date: '2026-08-11', google_rating: 4.5, review_count: 100 },
    ]);
    expect(detectMovements({ competitors: [rival], series })).toHaveLength(0);
  });
});

describe('marketPosition', () => {
  const mine: Snapshot = {
    watchlist_id: 'me',
    snapshot_date: '2026-08-11',
    google_rating: 4.7,
    review_count: 100,
  };

  it('ranks us against the field', () => {
    const position = marketPosition(mine, [
      { rating: 4.9, reviews: 200 },
      { rating: 4.2, reviews: 50 },
    ])!;
    expect(position.ratingRank).toBe(2);
    expect(position.reviewRank).toBe(2);
    expect(position.total).toBe(3);
  });

  it('gives tied practices the same rank', () => {
    const position = marketPosition(mine, [
      { rating: 4.7, reviews: 100 },
      { rating: 4.1, reviews: 10 },
    ])!;
    expect(position.ratingRank).toBe(1);
    expect(position.reviewRank).toBe(1);
  });

  it('does not rank an unrated practice above the field', () => {
    const position = marketPosition({ ...mine, google_rating: null }, [
      { rating: 4.9, reviews: 200 },
      { rating: 4.2, reviews: 50 },
    ])!;
    expect(position.ratingRank).toBe(3);
  });

  it('is null with nothing to compare against', () => {
    expect(marketPosition(mine, [])).toBeNull();
    expect(marketPosition(null, [{ rating: 4.5, reviews: 10 }])).toBeNull();
  });
});
