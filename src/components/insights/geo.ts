/**
 * Where a referring office sits relative to the practice — as a distance and a
 * compass bearing rather than a map pin.
 *
 * The Mapbox map already plots these on real geography. What it cannot do is make the
 * *shape* of the catchment legible: whether referrals arrive evenly from all sides or
 * pile up along one corridor is invisible when every dot is anchored to a street it
 * happens to sit on. Reducing each office to (bearing, distance) and replotting on a
 * clean polar field answers that in one look.
 *
 * Pure: no React, no DOM. Runs under `environment: "node"`.
 */

const EARTH_MILES = 3959;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export interface LatLng {
  latitude: number;
  longitude: number;
}

function usable(p: Partial<LatLng> | null | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.latitude === 'number' &&
    typeof p.longitude === 'number' &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}

/**
 * Great-circle distance in miles.
 *
 * Duplicates `@/utils/distanceCalculation` on purpose: that module rounds to one
 * decimal, which is right for a "4.2 miles away" label and wrong for a plot where the
 * rounding shows up as offices snapping onto visible rings. This one keeps full
 * precision and lets the caller round for display.
 */
export function distanceMiles(from: LatLng, to: LatLng): number | null {
  if (!usable(from) || !usable(to)) return null;

  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;

  return EARTH_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Initial bearing from `from` to `to`, in degrees clockwise from true north.
 *
 * Deliberately the forward azimuth, not `atan2(Δlat, Δlng)`. The naive version treats
 * a degree of longitude as a degree of latitude, which at this app's latitudes
 * compresses east-west by about 20% — an office due east reads as north-east, and the
 * whole catchment appears rotated toward the poles.
 */
export function bearingDegrees(from: LatLng, to: LatLng): number | null {
  if (!usable(from) || !usable(to)) return null;

  const φ1 = toRad(from.latitude);
  const φ2 = toRad(to.latitude);
  const Δλ = toRad(to.longitude - from.longitude);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** Nearest of the eight compass points to a bearing. */
export function compassPoint(bearing: number): CompassPoint {
  if (!Number.isFinite(bearing)) return 'N';
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return COMPASS_POINTS[index];
}
