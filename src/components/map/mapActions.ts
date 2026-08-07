import type { Hub, MapOffice } from './types';

/**
 * Turning the map into something you can act from, rather than only read.
 */

/** Google Maps caps a directions URL at an origin, a destination and 23 waypoints. */
const MAX_WAYPOINTS = 23;

export interface RoutePlan {
  url: string;
  stops: MapOffice[];
  /** Offices dropped because the route hit Google's waypoint ceiling. */
  omitted: number;
  totalMiles: number;
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const R = 3959;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Order stops by repeatedly hopping to the nearest unvisited office.
 *
 * Nearest-neighbour, not optimal TSP — but for a dozen stops it is within a few
 * percent of optimal, runs instantly, and Google re-optimises the legs anyway. The
 * point is to avoid handing someone a route that zigzags across town.
 */
function nearestNeighbourOrder(start: [number, number], offices: MapOffice[]): MapOffice[] {
  const remaining = [...offices];
  const ordered: MapOffice[] = [];
  let current = start;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMiles(current, [remaining[i].longitude, remaining[i].latitude]);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = [next.longitude, next.latitude];
  }

  return ordered;
}

/**
 * Build a Google Maps directions link for a visit run: out from the practice,
 * around the selected offices, and back.
 */
export function planVisitRoute(hub: Hub, offices: readonly MapOffice[]): RoutePlan | null {
  const withCoords = offices.filter((o) => o.latitude != null && o.longitude != null);
  if (withCoords.length === 0) return null;

  const ordered = nearestNeighbourOrder([hub.longitude, hub.latitude], withCoords);
  const stops = ordered.slice(0, MAX_WAYPOINTS);
  const omitted = ordered.length - stops.length;

  let totalMiles = 0;
  let cursor: [number, number] = [hub.longitude, hub.latitude];
  for (const stop of stops) {
    const point: [number, number] = [stop.longitude, stop.latitude];
    totalMiles += haversineMiles(cursor, point);
    cursor = point;
  }
  totalMiles += haversineMiles(cursor, [hub.longitude, hub.latitude]);

  const origin = `${hub.latitude},${hub.longitude}`;
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination: origin, // a loop: back to the practice
    travelmode: 'driving',
  });
  params.set('waypoints', stops.map((s) => `${s.latitude},${s.longitude}`).join('|'));

  return {
    url: `https://www.google.com/maps/dir/?${params.toString()}`,
    stops,
    omitted,
    totalMiles: Math.round(totalMiles * 10) / 10,
  };
}

/** Directions from the practice to a single office. */
export function directionsUrl(hub: Hub, office: MapOffice): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${hub.latitude},${hub.longitude}`,
    destination: `${office.latitude},${office.longitude}`,
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** A pasteable address block for the offices currently shown. */
export function addressList(offices: readonly MapOffice[]): string {
  return offices
    .map((o) => (o.address ? `${o.name}\n${o.address}` : o.name))
    .join('\n\n');
}
