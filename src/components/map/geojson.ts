import type { Momentum } from '@/lib/officeMetrics';
import { buildArc, type Arc } from './arcGeometry';
import type { DeltaFlow } from './deltaFlows';
import { normalize, widthFor } from './flowScales';
import type { Flow, Hub, MapOffice } from './types';

/**
 * GeoJSON builders for each map source.
 *
 * Arc geometry is expensive relative to everything else here, so it is cached by
 * office+hub pair and reused across month changes — scrubbing only alters a flow's
 * width and tier, never its shape.
 */

export interface DiscoveredPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  ratingCategory: string;
}

function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features };
}

export function hubsToFC(hubs: readonly Hub[]): GeoJSON.FeatureCollection {
  return fc(
    hubs.map((h) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.longitude, h.latitude] },
      properties: { id: h.id, name: h.name, address: h.address, isPrimary: h.isPrimary },
    })),
  );
}

/**
 * `momentum` rides along on the same features as `tier` so the map can show volume
 * and direction at once — tier as the dot's fill, momentum as a ring around it.
 * Offices missing from the lookup fall back to `steady`, which draws no ring.
 */
export function officesToFC(
  offices: readonly MapOffice[],
  momentumById?: ReadonlyMap<string, Momentum>,
): GeoJSON.FeatureCollection {
  return fc(
    offices.map((o) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.longitude, o.latitude] },
      properties: {
        id: o.id,
        name: o.name,
        tier: o.tier,
        momentum: momentumById?.get(o.id) ?? 'steady',
      },
    })),
  );
}

/** Miles per degree of latitude. Longitude shrinks by cos(lat). */
const MILES_PER_DEG_LAT = 69.0;

/**
 * Catchment rings around each hub — how far the practice actually reaches.
 *
 * Drawn as real geographic polygons rather than fixed-pixel circles so a "10 miles"
 * ring stays 10 miles at every zoom level.
 */
export function ringsToFC(
  hubs: readonly Hub[],
  radiiMiles: readonly number[],
  points = 96,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const hub of hubs) {
    const latScale = Math.cos((hub.latitude * Math.PI) / 180) || 1;

    for (const miles of radiiMiles) {
      const dLat = miles / MILES_PER_DEG_LAT;
      const dLng = dLat / latScale;

      const ring: [number, number][] = [];
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        ring.push([
          hub.longitude + Math.cos(angle) * dLng,
          hub.latitude + Math.sin(angle) * dLat,
        ]);
      }

      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: ring },
        properties: { hubId: hub.id, miles, label: `${miles} mi` },
      });
    }
  }

  return fc(features);
}

export function discoveredToFC(pins: readonly DiscoveredPin[]): GeoJSON.FeatureCollection {
  return fc(
    pins.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
      properties: { id: p.id, name: p.name, ratingCategory: p.ratingCategory },
    })),
  );
}

/**
 * Arc geometry cache, keyed by `${sourceId}|${hubId}`.
 *
 * MULTI-LOCATION SEAM: the key already includes the hub, so an office feeding two
 * locations gets two independently cached arcs with no change here.
 */
export class ArcCache {
  private cache = new Map<string, Arc>();

  get(sourceId: string, hubId: string, from: [number, number], to: [number, number]): Arc {
    const key = `${sourceId}|${hubId}`;
    let arc = this.cache.get(key);
    if (!arc) {
      arc = buildArc(from, to);
      this.cache.set(key, arc);
    }
    return arc;
  }

  /** Drop entries for offices that are no longer present, so the cache can't grow unbounded. */
  prune(liveKeys: Set<string>): void {
    for (const key of this.cache.keys()) {
      if (!liveKeys.has(key)) this.cache.delete(key);
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

export interface ArcBuildResult {
  featureCollection: GeoJSON.FeatureCollection;
  /** Per-arc data the animation loop needs, in the same order as the features. */
  arcs: Array<{ sourceId: string; hubId: string; tier: string; coords: Float64Array; u: number }>;
}

/**
 * Build the arc layer for the active time window.
 *
 * `maxFlowCount` is the global maximum across every month, not the window's — see
 * `normalize` for why.
 *
 * Width comes from patients **per month**, never the window total. That is what lets
 * a trailing-24-month view and a single month sit behind the same control without
 * every arc exploding or collapsing when you switch: thickness means one thing
 * everywhere, and the legend's "N patients/mo" stays literally true in every mode.
 * The feature still carries the true `count` for the window, because that is the
 * number a tooltip should say.
 */
export function buildArcs(
  flows: readonly Flow[],
  officesById: ReadonlyMap<string, MapOffice>,
  hubsById: ReadonlyMap<string, Hub>,
  maxFlowCount: number,
  cache: ArcCache,
  monthCount = 1,
): ArcBuildResult {
  const months = monthCount > 0 ? monthCount : 1;
  const features: GeoJSON.Feature[] = [];
  const arcs: ArcBuildResult['arcs'] = [];

  for (const flow of flows) {
    const office = officesById.get(flow.sourceId);
    const hub = hubsById.get(flow.hubId);
    if (!office || !hub) continue;

    const arc = cache.get(
      flow.sourceId,
      flow.hubId,
      [office.longitude, office.latitude],
      [hub.longitude, hub.latitude],
    );

    const perMonth = flow.count / months;
    const u = normalize(perMonth, maxFlowCount);

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arc.line },
      properties: {
        sourceId: flow.sourceId,
        hubId: flow.hubId,
        tier: office.tier,
        count: flow.count,
        perMonth,
        w: widthFor(u),
      },
    });

    arcs.push({
      sourceId: flow.sourceId,
      hubId: flow.hubId,
      tier: office.tier,
      coords: arc.coords,
      u,
    });
  }

  return { featureCollection: fc(features), arcs };
}

/**
 * Build the change arcs for compare mode.
 *
 * Features carry `dir` and no `tier`, which is what keeps them off the per-tier
 * layers — see `DELTA_LAYER_IDS`. `arcs` comes back empty on purpose: particles
 * represent patients travelling to the practice *this month*, and there is no such
 * traffic in a difference between two months. Returning none stops the animation
 * rather than leaving dots flowing along arcs that no longer mean flow.
 */
export function buildDeltaArcs(
  deltas: readonly DeltaFlow[],
  officesById: ReadonlyMap<string, MapOffice>,
  hubsById: ReadonlyMap<string, Hub>,
  maxDelta: number,
  cache: ArcCache,
): ArcBuildResult {
  const features: GeoJSON.Feature[] = [];

  for (const entry of deltas) {
    const office = officesById.get(entry.sourceId);
    const hub = hubsById.get(entry.hubId);
    if (!office || !hub) continue;

    const arc = cache.get(
      entry.sourceId,
      entry.hubId,
      [office.longitude, office.latitude],
      [hub.longitude, hub.latitude],
    );

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arc.line },
      properties: {
        sourceId: entry.sourceId,
        hubId: entry.hubId,
        dir: entry.delta > 0 ? 'gain' : 'loss',
        delta: entry.delta,
        w: widthFor(normalize(Math.abs(entry.delta), maxDelta)),
      },
    });
  }

  return { featureCollection: fc(features), arcs: [] };
}
