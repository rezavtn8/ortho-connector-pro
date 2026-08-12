/**
 * Competitor intelligence: the analysis behind the Competitor Watch page.
 *
 * Everything here is pure. The page fetches rows, this module turns them into
 * the numbers on screen, and the tests in `__tests__/competitorIntel.test.ts`
 * pin the arithmetic. Nothing in this file touches Supabase or the network.
 *
 * Two ideas drive the page:
 *
 *  1. **Referral exposure.** Nexora is the only place that knows both where a
 *     practice's referring offices are and how many patients each one sends.
 *     Crossing that against a competitor's location answers a question a
 *     reputation tracker cannot: not "who is rated higher" but "who is sitting
 *     between me and the offices that actually feed me". A referring dentist
 *     picks a specialist partly on how far they are sending the patient, so a
 *     competitor closer to that dentist than we are is a standing risk to the
 *     relationship regardless of anyone's star rating.
 *
 *     This is a proximity model, not observed behaviour — it says a
 *     relationship is *contested*, never that it is being lost. What turns it
 *     into evidence is the second half: pairing exposure with the referral
 *     trend we do observe. A contested office whose referrals are also falling
 *     is the alarm worth acting on.
 *
 *  2. **Movement.** `competitor_snapshots` accumulates a row per competitor per
 *     day and the previous page read only the newest one, so the entire history
 *     was collected and discarded. Deltas over that history are what make this
 *     a watch rather than a dashboard.
 */

const EARTH_RADIUS_MILES = 3958.8;

/** Referral history considered when weighting an office, in months. */
export const VOLUME_WINDOW_MONTHS = 12;

/** Trend compares this many recent months against the same span before it. */
export const TREND_WINDOW_MONTHS = 3;

/** Ignore sub-noise distance differences; GPS on a strip mall is not exact. */
const MIN_MEANINGFUL_MILES = 0.15;

// ---------------------------------------------------------------- input types

export interface LatLng {
  latitude: number | null;
  longitude: number | null;
}

export interface ReferringOffice extends LatLng {
  id: string;
  name: string;
}

export interface MonthlyCount {
  source_id: string | null;
  year_month: string;
  patient_count: number;
}

export interface WatchedCompetitor extends LatLng {
  /** `competitor_watchlist.id` — snapshots join on this. */
  id: string;
  google_place_id: string;
  name: string;
  address?: string | null;
}

export interface Snapshot {
  watchlist_id: string;
  /** `YYYY-MM-DD`. */
  snapshot_date: string;
  google_rating: number | null;
  review_count: number | null;
}

// --------------------------------------------------------------- output types

export interface ContestedOffice {
  sourceId: string;
  name: string;
  /** Patients received from this office over the volume window. */
  patients: number;
  milesToYou: number;
  milesToCompetitor: number;
  /** How much closer the competitor is, as a multiple. 2 = half the distance. */
  advantage: number;
  /** Referrals in the recent window minus the window before it. */
  trend: number;
  /** Contested *and* declining — the combination worth acting on. */
  declining: boolean;
}

export interface CompetitorExposure {
  competitorId: string;
  name: string;
  /** Offices this competitor is the closest tracked practice to. */
  offices: ContestedOffice[];
  /** Patients from offices where this competitor is the nearest rival. */
  contestedPatients: number;
  /** Patients from every office this competitor beats us to, overlaps included. */
  reachPatients: number;
  /** Of `contestedPatients`, the share from offices already declining. */
  decliningPatients: number;
  /** 0–100. Volume at stake, adjusted for reputation and momentum. */
  threat: number;
}

export interface ExposureReport {
  competitors: CompetitorExposure[];
  /** Referral volume from offices we could place on the map. */
  mappedPatients: number;
  /** Volume from offices at least one competitor is closer to. */
  exposedPatients: number;
  /** Volume from contested offices whose referrals are also falling. */
  decliningPatients: number;
  /** Offices with no usable coordinates, so absent from the model. */
  unmappedOffices: number;
  exposedShare: number;
}

export interface SeriesPoint {
  date: string;
  rating: number | null;
  reviews: number;
}

export type MovementKind =
  | 'review-surge'
  | 'rating-drop'
  | 'rating-gain'
  | 'overtaken'
  | 'overtook'
  | 'stalled';

export interface Movement {
  kind: MovementKind;
  severity: 'high' | 'medium' | 'low';
  competitorId: string;
  competitorName: string;
  headline: string;
  detail: string;
}

// -------------------------------------------------------------------- helpers

export function haversineMiles(a: LatLng, b: LatLng): number {
  const lat1 = a.latitude!;
  const lng1 = a.longitude!;
  const lat2 = b.latitude!;
  const lng2 = b.longitude!;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function hasCoords(p: LatLng | null | undefined): boolean {
  return (
    !!p &&
    p.latitude != null &&
    p.longitude != null &&
    Number.isFinite(Number(p.latitude)) &&
    Number.isFinite(Number(p.longitude)) &&
    !(Number(p.latitude) === 0 && Number(p.longitude) === 0)
  );
}

/** `['2026-08', '2026-07', ...]`, most recent first, anchored on `from`. */
export function recentMonths(count: number, from: Date): string[] {
  const months: string[] = [];
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(year, month - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

/**
 * Patients per source over a set of months.
 *
 * `monthly_patients` rows arrive unfiltered by source (RLS already scopes them
 * to the user), so the month set is what bounds the window.
 */
export function volumeBySource(
  monthly: MonthlyCount[],
  months: Iterable<string>,
): Map<string, number> {
  const window = months instanceof Set ? months : new Set(months);
  const totals = new Map<string, number>();
  for (const row of monthly) {
    if (!row.source_id || !window.has(row.year_month)) continue;
    totals.set(row.source_id, (totals.get(row.source_id) ?? 0) + (row.patient_count || 0));
  }
  return totals;
}

/**
 * Recent-window referrals minus the window immediately before it.
 *
 * Negative means the office is sending fewer patients than it was. Comparing
 * equal-length adjacent windows keeps a partial current month from reading as
 * a collapse — it lands in both calculations the same way.
 */
export function trendBySource(monthly: MonthlyCount[], from: Date): Map<string, number> {
  const span = recentMonths(TREND_WINDOW_MONTHS * 2, from);
  const recent = new Set(span.slice(0, TREND_WINDOW_MONTHS));
  const prior = new Set(span.slice(TREND_WINDOW_MONTHS));

  const recentTotals = volumeBySource(monthly, recent);
  const priorTotals = volumeBySource(monthly, prior);

  const trends = new Map<string, number>();
  for (const id of new Set([...recentTotals.keys(), ...priorTotals.keys()])) {
    trends.set(id, (recentTotals.get(id) ?? 0) - (priorTotals.get(id) ?? 0));
  }
  return trends;
}

// ------------------------------------------------------------------- exposure

export interface ExposureInput {
  clinic: LatLng | null;
  competitors: WatchedCompetitor[];
  offices: ReferringOffice[];
  monthly: MonthlyCount[];
  /** Latest snapshot per competitor, used to weight reputation into threat. */
  latest: Map<string, Snapshot>;
  /** Our own latest snapshot, for the same comparison. */
  mine?: Snapshot | null;
  now?: Date;
}

/**
 * Which referring offices each competitor is closer to than we are.
 *
 * An office contested by several competitors is attributed to the nearest one
 * for `contestedPatients`, so the headline total never counts a patient twice.
 * `reachPatients` keeps the un-deduplicated figure, because "four competitors
 * are all closer to this office than you" is itself worth seeing.
 */
export function computeExposure(input: ExposureInput): ExposureReport {
  const { clinic, competitors, offices, monthly, latest, mine } = input;
  const now = input.now ?? new Date();

  const empty: ExposureReport = {
    competitors: [],
    mappedPatients: 0,
    exposedPatients: 0,
    decliningPatients: 0,
    unmappedOffices: 0,
    exposedShare: 0,
  };
  if (!hasCoords(clinic)) return empty;

  const volume = volumeBySource(monthly, recentMonths(VOLUME_WINDOW_MONTHS, now));
  const trends = trendBySource(monthly, now);

  const located = competitors.filter(hasCoords);
  const rows = new Map<string, CompetitorExposure>(
    located.map((c) => [
      c.id,
      {
        competitorId: c.id,
        name: c.name,
        offices: [],
        contestedPatients: 0,
        reachPatients: 0,
        decliningPatients: 0,
        threat: 0,
      },
    ]),
  );

  let mappedPatients = 0;
  let exposedPatients = 0;
  let decliningPatients = 0;
  let unmappedOffices = 0;

  for (const office of offices) {
    const patients = volume.get(office.id) ?? 0;
    // An office that has never sent a patient carries no exposure to weigh.
    if (patients <= 0) continue;

    if (!hasCoords(office)) {
      unmappedOffices++;
      continue;
    }
    mappedPatients += patients;

    const milesToYou = haversineMiles(office, clinic!);
    const trend = trends.get(office.id) ?? 0;
    const declining = trend < 0;

    let nearest: { row: CompetitorExposure; entry: ContestedOffice } | null = null;
    let contested = false;

    for (const competitor of located) {
      const milesToCompetitor = haversineMiles(office, competitor);
      // Only a competitor meaningfully closer counts. Without the floor, an
      // office 30 feet nearer registers as a contested relationship.
      if (milesToCompetitor >= milesToYou - MIN_MEANINGFUL_MILES) continue;

      contested = true;
      const row = rows.get(competitor.id)!;
      row.reachPatients += patients;

      const entry: ContestedOffice = {
        sourceId: office.id,
        name: office.name,
        patients,
        milesToYou,
        milesToCompetitor,
        advantage: milesToCompetitor > 0 ? milesToYou / milesToCompetitor : Infinity,
        trend,
        declining,
      };

      if (!nearest || milesToCompetitor < nearest.entry.milesToCompetitor) {
        nearest = { row, entry };
      }
    }

    if (!contested || !nearest) continue;

    exposedPatients += patients;
    if (declining) decliningPatients += patients;

    nearest.row.offices.push(nearest.entry);
    nearest.row.contestedPatients += patients;
    if (declining) nearest.row.decliningPatients += patients;
  }

  const ranked = [...rows.values()];
  for (const row of ranked) {
    row.offices.sort((a, b) => b.patients - a.patients || a.milesToCompetitor - b.milesToCompetitor);
    row.threat = threatScore(row, mappedPatients, latest.get(row.competitorId) ?? null, mine ?? null);
  }
  ranked.sort((a, b) => b.threat - a.threat || b.contestedPatients - a.contestedPatients);

  return {
    competitors: ranked,
    mappedPatients,
    exposedPatients,
    decliningPatients,
    unmappedOffices,
    exposedShare: mappedPatients > 0 ? exposedPatients / mappedPatients : 0,
  };
}

/**
 * 0–100, dominated by referral volume at stake.
 *
 * Reputation and momentum only modulate it: a better-rated competitor gaining
 * reviews faster is more dangerous to the same relationships, but a competitor
 * contesting nothing is not a threat however well they are rated. Offices that
 * are contested *and* declining count double, which is the one signal here
 * grounded in observed behaviour rather than geometry.
 *
 * Missing ratings score neutral rather than zero, so an unrefreshed competitor
 * does not read as harmless.
 */
function threatScore(
  row: CompetitorExposure,
  mappedPatients: number,
  theirs: Snapshot | null,
  mine: Snapshot | null,
): number {
  if (mappedPatients <= 0 || row.contestedPatients <= 0) return 0;

  const weighted = row.contestedPatients + row.decliningPatients;
  const volumeShare = Math.min(1, weighted / mappedPatients);

  const theirRating = theirs?.google_rating ?? null;
  const myRating = mine?.google_rating ?? null;
  const ratingEdge =
    theirRating != null && myRating != null
      ? clamp01((theirRating - myRating + 0.5) / 1.0)
      : 0.5;

  const theirReviews = theirs?.review_count ?? 0;
  const myReviews = mine?.review_count ?? 0;
  const reviewEdge =
    theirReviews + myReviews > 0 ? theirReviews / (theirReviews + myReviews) : 0.5;

  const score = 100 * (0.65 * volumeShare + 0.2 * ratingEdge + 0.15 * reviewEdge);
  return Math.round(Math.min(100, score));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// --------------------------------------------------------------------- series

/**
 * Snapshot history per competitor, oldest first, one point per day.
 *
 * Duplicate dates keep the last row seen; the unique constraint on
 * `(watchlist_id, snapshot_date)` means that should not happen, but the chart
 * must not render two points on one x value if it ever does.
 */
export function buildSeries(snapshots: Snapshot[]): Map<string, SeriesPoint[]> {
  const byCompetitor = new Map<string, Map<string, SeriesPoint>>();

  for (const snap of snapshots) {
    let days = byCompetitor.get(snap.watchlist_id);
    if (!days) {
      days = new Map();
      byCompetitor.set(snap.watchlist_id, days);
    }
    days.set(snap.snapshot_date, {
      date: snap.snapshot_date,
      rating: snap.google_rating,
      reviews: snap.review_count ?? 0,
    });
  }

  const out = new Map<string, SeriesPoint[]>();
  for (const [id, days] of byCompetitor) {
    out.set(id, [...days.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }
  return out;
}

export function latestByCompetitor(snapshots: Snapshot[]): Map<string, Snapshot> {
  const latest = new Map<string, Snapshot>();
  for (const snap of snapshots) {
    const held = latest.get(snap.watchlist_id);
    if (!held || snap.snapshot_date > held.snapshot_date) latest.set(snap.watchlist_id, snap);
  }
  return latest;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Reviews per week across the series, measured over the real elapsed days.
 *
 * The stored `review_velocity` column is not used: it was written against
 * whatever the previous snapshot happened to be, so a day with two refreshes
 * compared today against itself and recorded zero. Deriving it from the series
 * makes the number independent of when anyone pressed refresh.
 *
 * Returns null below `minDays` of history rather than annualising a single
 * day's noise into a headline figure.
 */
export function velocityPerWeek(series: SeriesPoint[] | undefined, minDays = 5): number | null {
  if (!series || series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const days = daysBetween(first.date, last.date);
  if (days < minDays) return null;
  return ((last.reviews - first.reviews) / days) * 7;
}

export interface Gain {
  gained: number;
  /** Days actually spanned, which is rarely exactly the days requested. */
  days: number;
}

/**
 * The snapshot closest in age to `targetDays`, with the age it really has.
 *
 * Snapshots land on the days someone refreshed, so a 30-day window almost
 * never has a point sitting on its boundary. Returning the true span lets the
 * caller say "in 22 days" instead of labelling a 41-day measurement as 30 —
 * which matters beyond wording, because the surge test divides the gain by the
 * rate expected over that span and a wrong denominator invents campaigns.
 */
function baselineNear(
  series: SeriesPoint[] | undefined,
  targetDays: number,
): { point: SeriesPoint; days: number } | null {
  if (!series || series.length < 2) return null;
  const last = series[series.length - 1];

  let best: { point: SeriesPoint; days: number } | null = null;
  for (const point of series.slice(0, -1)) {
    const days = daysBetween(point.date, last.date);
    if (days < 1) continue;
    if (!best || Math.abs(days - targetDays) < Math.abs(best.days - targetDays)) {
      best = { point, days };
    }
  }
  return best;
}

/** Reviews gained over roughly the last `targetDays`, and the span measured. */
export function reviewsGained(
  series: SeriesPoint[] | undefined,
  targetDays: number,
): Gain | null {
  const baseline = baselineNear(series, targetDays);
  if (!baseline) return null;
  const last = series![series!.length - 1];
  return { gained: last.reviews - baseline.point.reviews, days: baseline.days };
}

/**
 * Weeks until a competitor's review count passes ours at current rates.
 *
 * Null when they are already ahead, when either side lacks enough history, or
 * when the gap is not actually closing — a projection that never converges is
 * worse than no projection.
 */
export function weeksToCrossover(
  mine: SeriesPoint[] | undefined,
  theirs: SeriesPoint[] | undefined,
): number | null {
  const myVelocity = velocityPerWeek(mine);
  const theirVelocity = velocityPerWeek(theirs);
  if (myVelocity == null || theirVelocity == null) return null;

  const myReviews = mine![mine!.length - 1].reviews;
  const theirReviews = theirs![theirs!.length - 1].reviews;
  const gap = myReviews - theirReviews;
  if (gap <= 0) return null;

  const closingPerWeek = theirVelocity - myVelocity;
  if (closingPerWeek <= 0) return null;

  const weeks = gap / closingPerWeek;
  // Beyond two years the arithmetic still works and the claim does not.
  return weeks > 104 ? null : Math.max(1, Math.round(weeks));
}

// ------------------------------------------------------------------ movements

export interface MovementInput {
  competitors: WatchedCompetitor[];
  series: Map<string, SeriesPoint[]>;
  /** Our own watchlist row id, excluded from the feed. */
  selfId?: string | null;
  mine?: SeriesPoint[] | null;
  /** Look-back for surges and rating changes. */
  windowDays?: number;
}

/**
 * What changed recently, worst first.
 *
 * A surge is judged against the competitor's own baseline rather than a fixed
 * threshold: five reviews in a fortnight is unremarkable for a practice that
 * always gains five, and a clear campaign for one that normally gains none.
 */
export function detectMovements(input: MovementInput): Movement[] {
  const { competitors, series, selfId, mine } = input;
  const windowDays = input.windowDays ?? 30;
  const movements: Movement[] = [];

  const myLatest = mine && mine.length > 0 ? mine[mine.length - 1] : null;
  const myPrevious = mine && mine.length > 1 ? mine[mine.length - 2] : null;

  for (const competitor of competitors) {
    if (selfId && competitor.id === selfId) continue;

    const points = series.get(competitor.id);
    if (!points || points.length < 2) continue;

    const last = points[points.length - 1];
    const recent = reviewsGained(points, windowDays);
    const velocity = velocityPerWeek(points);

    // ---- review surge, relative to their own long-run rate
    if (recent != null && velocity != null && recent.gained >= 3) {
      const expected = (velocity * recent.days) / 7;
      const ratio = expected > 0.5 ? recent.gained / expected : recent.gained >= 5 ? 3 : 1;
      if (ratio >= 1.8) {
        movements.push({
          kind: 'review-surge',
          severity: ratio >= 3 ? 'high' : 'medium',
          competitorId: competitor.id,
          competitorName: competitor.name,
          headline: `${competitor.name} gained ${recent.gained} reviews in ${recent.days} days`,
          detail:
            expected > 0.5
              ? `${ratio.toFixed(1)}× their usual rate — likely an active review campaign`
              : 'A jump from a practice that normally gains none — likely an active review campaign',
        });
      }
    }

    // ---- rating movement over the window
    const baseline = baselineNear(points, windowDays);
    if (baseline?.point.rating != null && last.rating != null) {
      const delta = Math.round((last.rating - baseline.point.rating) * 100) / 100;
      if (delta <= -0.1) {
        movements.push({
          kind: 'rating-drop',
          severity: 'low',
          competitorId: competitor.id,
          competitorName: competitor.name,
          headline: `${competitor.name} slipped to ${last.rating.toFixed(1)}`,
          detail: `Down ${Math.abs(delta).toFixed(1)} in ${baseline.days} days — an opening while it lasts`,
        });
      } else if (delta >= 0.1) {
        movements.push({
          kind: 'rating-gain',
          severity: 'medium',
          competitorId: competitor.id,
          competitorName: competitor.name,
          headline: `${competitor.name} climbed to ${last.rating.toFixed(1)}`,
          detail: `Up ${delta.toFixed(1)} in ${baseline.days} days`,
        });
      }
    }

    // ---- rating crossings against us, using the previous point as the "before"
    if (myLatest?.rating != null && myPrevious?.rating != null && last.rating != null) {
      const previous = points[points.length - 2];
      if (previous.rating != null) {
        const wasBehind = previous.rating < myPrevious.rating;
        const nowAhead = last.rating > myLatest.rating;
        if (wasBehind && nowAhead) {
          movements.push({
            kind: 'overtaken',
            severity: 'high',
            competitorId: competitor.id,
            competitorName: competitor.name,
            headline: `${competitor.name} now outranks you on rating`,
            detail: `${last.rating.toFixed(1)} against your ${myLatest.rating.toFixed(1)}`,
          });
        } else if (previous.rating > myPrevious.rating && last.rating < myLatest.rating) {
          movements.push({
            kind: 'overtook',
            severity: 'low',
            competitorId: competitor.id,
            competitorName: competitor.name,
            headline: `You passed ${competitor.name} on rating`,
            detail: `${myLatest.rating.toFixed(1)} against their ${last.rating.toFixed(1)}`,
          });
        }
      }
    }
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  return movements.sort((a, b) => order[a.severity] - order[b.severity]);
}

// -------------------------------------------------------------- market ranks

export interface MarketPosition {
  ratingRank: number;
  reviewRank: number;
  total: number;
  avgRating: number;
  avgReviews: number;
  myRating: number | null;
  myReviews: number;
}

/**
 * Where we sit against the tracked field.
 *
 * Ranked by descending value with ties sharing the better rank, which the
 * previous `indexOf` approach got right only by accident — it returned the
 * first matching position, so two practices on 4.8 both read as joint first
 * while the third on 4.7 read as third rather than second.
 */
export function marketPosition(
  mine: Snapshot | null | undefined,
  rivals: Array<{ rating: number | null; reviews: number }>,
): MarketPosition | null {
  if (!mine || rivals.length === 0) return null;

  const myRating = mine.google_rating ?? null;
  const myReviews = mine.review_count ?? 0;

  const ratings = rivals.map((r) => r.rating).filter((r): r is number => r != null);
  const reviews = rivals.map((r) => r.reviews);

  const ratingRank = myRating == null ? ratings.length + 1 : 1 + ratings.filter((r) => r > myRating).length;
  const reviewRank = 1 + reviews.filter((r) => r > myReviews).length;

  const allRatings = myRating == null ? ratings : [myRating, ...ratings];
  const allReviews = [myReviews, ...reviews];

  return {
    ratingRank,
    reviewRank,
    total: rivals.length + 1,
    avgRating: allRatings.length
      ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
      : 0,
    avgReviews: allReviews.length
      ? Math.round(allReviews.reduce((a, b) => a + b, 0) / allReviews.length)
      : 0,
    myRating,
    myReviews,
  };
}
