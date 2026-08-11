/**
 * Geometry helpers for tiled place discovery.
 *
 * Google caps every places search at 20 results (New API) or 60 with
 * pagination (legacy), and caps the search circle at 50 km. A single call
 * therefore cannot cover a dense metro at any useful radius: you get the 20
 * closest dentists and silently lose the rest. The fix is to tile the search
 * area into overlapping circles small enough that each one comes back
 * unsaturated, and to subdivide the ones that still saturate.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const EARTH_RADIUS_MILES = 3958.8;

/** Latitude is close enough to uniform that one constant works worldwide. */
const MILES_PER_DEG_LAT = 69.0;

/** Longitude degrees shrink toward the poles. */
function milesPerDegLng(lat: number): number {
  return 69.172 * Math.cos((lat * Math.PI) / 180);
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function boundingBox(center: LatLng, radiusMiles: number): BoundingBox {
  const dLat = radiusMiles / MILES_PER_DEG_LAT;
  // Guard against a cos() that collapses to ~0 near the poles.
  const dLng = radiusMiles / Math.max(1, milesPerDegLng(center.lat));
  return {
    south: Math.max(-90, center.lat - dLat),
    north: Math.min(90, center.lat + dLat),
    west: Math.max(-180, center.lng - dLng),
    east: Math.min(180, center.lng + dLng),
  };
}

/**
 * Circles of radius `tileRadiusMiles` that fully cover the search disc.
 *
 * Centers sit on a triangular lattice with spacing `r * sqrt(3)`, which is the
 * tightest packing that still leaves no gaps between the circles. Rows are
 * offset by half a step; any lattice point within `radius + r` of the center
 * contributes coverage, so the returned tiles slightly overhang the disc
 * rather than leaving a scalloped edge.
 */
export function tileCircle(
  center: LatLng,
  radiusMiles: number,
  tileRadiusMiles: number,
): LatLng[] {
  if (tileRadiusMiles >= radiusMiles) return [center];

  // `r * sqrt(3)` is the exact tangency spacing, where neighbouring circles
  // meet at a single point. Tightening it by 5% turns those points into real
  // overlap, which absorbs the curvature error in the flat-earth lattice — at
  // exact spacing the seams between tiles genuinely miss places.
  const spacing = tileRadiusMiles * Math.sqrt(3) * 0.95;
  const rowStep = spacing * 0.866; // sqrt(3)/2 — triangular lattice row height
  const degLat = 1 / MILES_PER_DEG_LAT;
  const degLng = 1 / Math.max(1, milesPerDegLng(center.lat));

  const tiles: LatLng[] = [];
  const rows = Math.ceil(radiusMiles / rowStep);

  for (let row = -rows; row <= rows; row++) {
    const northMiles = row * rowStep;
    // Half-step offset on odd rows is what makes the lattice triangular.
    const rowOffset = row % 2 === 0 ? 0 : spacing / 2;
    const cols = Math.ceil(radiusMiles / spacing) + 1;

    for (let col = -cols; col <= cols; col++) {
      const eastMiles = col * spacing + rowOffset;
      const distanceFromCenter = Math.hypot(northMiles, eastMiles);
      if (distanceFromCenter > radiusMiles + tileRadiusMiles) continue;

      tiles.push({
        lat: center.lat + northMiles * degLat,
        lng: center.lng + eastMiles * degLng,
      });
    }
  }

  return tiles.length > 0 ? tiles : [center];
}

/**
 * Tile radius that covers `radiusMiles` in roughly `tileBudget` circles.
 *
 * A triangular lattice needs about 1.21 * (R/r)^2 circles to cover a disc of
 * radius R, so inverting that gives the largest tile that still fits the
 * budget. Clamped below at 1.5 miles because tiles smaller than that mostly
 * re-return the same places, and above at 15 miles because a tile that wide
 * saturates in any populated area.
 */
export function chooseTileRadius(radiusMiles: number, tileBudget: number): number {
  // A short search fits in one circle. The 5% overshoot means the edge of the
  // requested radius is searched rather than sitting exactly on the boundary;
  // anything genuinely outside is dropped later by the distance filter.
  if (radiusMiles <= 3) return radiusMiles * 1.05;
  const ideal = radiusMiles / Math.sqrt(tileBudget / 1.21);
  return Math.min(15, Math.max(1.5, ideal));
}

/** The 6 surrounding + 1 central sub-tiles used when a tile comes back full. */
export function subdivideTile(tile: LatLng, tileRadiusMiles: number): LatLng[] {
  const childRadius = tileRadiusMiles / 2;
  const offset = childRadius * Math.sqrt(3);
  const degLat = 1 / MILES_PER_DEG_LAT;
  const degLng = 1 / Math.max(1, milesPerDegLng(tile.lat));

  const children: LatLng[] = [tile];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    children.push({
      lat: tile.lat + offset * Math.cos(angle) * degLat,
      lng: tile.lng + offset * Math.sin(angle) * degLng,
    });
  }
  return children;
}

/** Run `fn` over `items` with at most `limit` in flight at once. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
