import { calculateDistance } from '@/utils/distanceCalculation';
import type { Flow, Hub, MapOffice } from './types';

/**
 * Territory metrics: how far the practice actually reaches, weighted by patients.
 *
 * Weighting by patient count rather than by office is the point. Twenty distant
 * offices sending one patient each say much less about catchment than one nearby
 * office sending sixty, and an unweighted average would report the opposite.
 */

export interface ReachStats {
  /** Distance within which half of this month's patients originate. */
  medianMiles: number | null;
  /** Distance covering 90% of patients — the practical edge of the territory. */
  p90Miles: number | null;
  /** Share of patients from within `coreRadius` miles, 0..1. */
  shareWithinCore: number;
  coreRadius: number;
  farthest: { office: MapOffice; miles: number; count: number } | null;
  /** Ring radii to draw, chosen to bracket the actual spread. */
  ringRadii: number[];
  totalPatients: number;
}

const CANDIDATE_RINGS = [1, 2, 5, 10, 15, 25, 40, 60, 100];

/** Nearest sensible round radius at or above `miles`. */
function niceRadius(miles: number): number {
  return CANDIDATE_RINGS.find((r) => r >= miles) ?? CANDIDATE_RINGS[CANDIDATE_RINGS.length - 1];
}

/** Patient-weighted percentile over (distance, count) pairs. */
function weightedPercentile(
  sorted: Array<{ miles: number; count: number }>,
  fraction: number,
  total: number,
): number | null {
  if (total <= 0) return null;
  const target = total * fraction;
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += entry.count;
    if (cumulative >= target) return entry.miles;
  }
  return sorted[sorted.length - 1]?.miles ?? null;
}

export function computeReachStats(
  flows: readonly Flow[],
  officesById: ReadonlyMap<string, MapOffice>,
  hubs: readonly Hub[],
): ReachStats {
  const empty: ReachStats = {
    medianMiles: null,
    p90Miles: null,
    shareWithinCore: 0,
    coreRadius: 10,
    farthest: null,
    ringRadii: [5, 10, 25],
    totalPatients: 0,
  };

  if (hubs.length === 0 || flows.length === 0) return empty;

  const entries: Array<{ miles: number; count: number; office: MapOffice }> = [];
  let total = 0;

  for (const flow of flows) {
    const office = officesById.get(flow.sourceId);
    if (!office) continue;

    // Distance to the nearest location: a patient chooses a site, not the average
    // of all of them. With one hub this is simply that hub.
    let nearest = Infinity;
    for (const hub of hubs) {
      const d = calculateDistance(hub.latitude, hub.longitude, office.latitude, office.longitude);
      if (d < nearest) nearest = d;
    }
    if (!Number.isFinite(nearest)) continue;

    entries.push({ miles: nearest, count: flow.count, office });
    total += flow.count;
  }

  if (entries.length === 0 || total === 0) return empty;

  const sorted = [...entries].sort((a, b) => a.miles - b.miles);
  const medianMiles = weightedPercentile(sorted, 0.5, total);
  const p90Miles = weightedPercentile(sorted, 0.9, total);

  const coreRadius = niceRadius(medianMiles ?? 10);
  const withinCore = sorted
    .filter((e) => e.miles <= coreRadius)
    .reduce((sum, e) => sum + e.count, 0);

  const farthestEntry = sorted[sorted.length - 1];

  // Three rings that bracket the real spread rather than arbitrary round numbers.
  const outer = niceRadius(p90Miles ?? coreRadius * 2);
  const ringRadii = Array.from(
    new Set([
      niceRadius(Math.max(1, coreRadius / 2)),
      coreRadius,
      outer > coreRadius ? outer : niceRadius(coreRadius * 2),
    ]),
  ).sort((a, b) => a - b);

  return {
    medianMiles,
    p90Miles,
    shareWithinCore: withinCore / total,
    coreRadius,
    farthest: farthestEntry
      ? { office: farthestEntry.office, miles: farthestEntry.miles, count: farthestEntry.count }
      : null,
    ringRadii,
    totalPatients: total,
  };
}
