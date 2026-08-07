import { buildArc, type Arc } from './arcGeometry';
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

export function officesToFC(offices: readonly MapOffice[]): GeoJSON.FeatureCollection {
  return fc(
    offices.map((o) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.longitude, o.latitude] },
      properties: { id: o.id, name: o.name, tier: o.tier },
    })),
  );
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
 * Build the arc layer for one month.
 *
 * `maxFlowCount` is the global maximum across every month, not this month's — see
 * `normalize` for why.
 */
export function buildArcs(
  flows: readonly Flow[],
  officesById: ReadonlyMap<string, MapOffice>,
  hubsById: ReadonlyMap<string, Hub>,
  maxFlowCount: number,
  cache: ArcCache,
): ArcBuildResult {
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

    const u = normalize(flow.count, maxFlowCount);

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arc.line },
      properties: {
        sourceId: flow.sourceId,
        hubId: flow.hubId,
        tier: office.tier,
        count: flow.count,
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
