import type mapboxgl from 'mapbox-gl';
import type { ExpressionSpecification } from 'mapbox-gl';
import type { TierColors } from './flowScales';

/**
 * Source and layer definitions for the patient-flow map.
 *
 * Everything is a GPU layer over a GeoJSON source — no `mapboxgl.Marker`. The old
 * map created one absolutely-positioned div per office, which the browser had to
 * reposition on every pan frame; at 150 offices that was the dominant cost of
 * simply dragging the map. Circle and line layers batch into a handful of draw calls.
 */

export const SOURCES = {
  arcs: 'flow-arcs',
  particles: 'flow-particles',
  offices: 'network-offices',
  hubs: 'hubs',
  discovered: 'discovered-offices',
} as const;

export type SourceId = (typeof SOURCES)[keyof typeof SOURCES];

export const LAYERS = {
  arcGlow: 'flow-arcs-glow',
  arcLine: 'flow-arcs-line',
  particles: 'flow-particles-dot',
  discovered: 'discovered-offices-icon',
  officeHalo: 'network-offices-halo',
  officeDot: 'network-offices-dot',
  officeLabel: 'network-offices-label',
  hubPulse: 'hub-pulse',
  hubDot: 'hub-dot',
} as const;

/** Layers that respond to clicks and hover. Order matters: topmost first. */
export const INTERACTIVE_LAYERS = [LAYERS.officeDot, LAYERS.discovered, LAYERS.hubDot];

export const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export const RATING_CATEGORIES = ['Excellent', 'Good', 'Average', 'Low'] as const;
export type RatingCategory = (typeof RATING_CATEGORIES)[number];

/** Matches the dashed-ring colours the previous map used, so the visual language carries over. */
const RATING_COLORS: Record<RatingCategory, string> = {
  Excellent: '#10b981',
  Good: '#f97316',
  Average: '#eab308',
  Low: '#9ca3af',
};

function tierMatch(colors: TierColors): ExpressionSpecification {
  return [
    'match',
    ['get', 'tier'],
    'VIP',
    colors.VIP,
    'Warm',
    colors.Warm,
    'Cold',
    colors.Cold,
    'Dormant',
    colors.Dormant,
    colors.Dormant,
  ] as ExpressionSpecification;
}

/**
 * Arc opacity, rebuilt whenever focus changes.
 *
 * Applied with `setPaintProperty`, deliberately not `setFeatureState`: feature state
 * is wiped by every `setData`, and the month scrubber calls `setData` constantly, so
 * hover highlighting would flicker out mid-drag.
 */
export function arcOpacityExpr(focusId: string | null): number | ExpressionSpecification {
  if (!focusId) return 0.5;
  return ['case', ['==', ['get', 'sourceId'], focusId], 0.95, 0.06] as ExpressionSpecification;
}

export function officeOpacityExpr(focusId: string | null): number | ExpressionSpecification {
  if (!focusId) return 0.9;
  return ['case', ['==', ['get', 'id'], focusId], 1, 0.25] as ExpressionSpecification;
}

export function particleOpacityExpr(focusId: string | null): ExpressionSpecification {
  if (!focusId) return ['get', 'o'] as ExpressionSpecification;
  return [
    'case',
    ['==', ['get', 'sourceId'], focusId],
    ['get', 'o'],
    ['*', ['get', 'o'], 0.08],
  ] as ExpressionSpecification;
}

/**
 * Render the dashed prospect rings as canvas images.
 *
 * A `symbol` layer with `icon-image` can't produce a dashed border the way CSS can,
 * so the four ring variants are drawn once and registered as map images.
 */
function addDiscoveredIcons(map: mapboxgl.Map): void {
  const size = 40;
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const px = size * dpr;

  for (const category of RATING_CATEGORIES) {
    if (map.hasImage(category)) continue;

    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const color = RATING_COLORS[category];
    const r = px / 2 - 3 * dpr;

    ctx.beginPath();
    ctx.arc(px / 2, px / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = `${color}40`;
    ctx.fill();

    ctx.setLineDash([4 * dpr, 3 * dpr]);
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = color;
    ctx.stroke();

    const data = ctx.getImageData(0, 0, px, px);
    map.addImage(category, { width: px, height: px, data: new Uint8Array(data.data.buffer) }, {
      pixelRatio: dpr,
    });
  }
}

/**
 * Install every source and layer. Safe to call repeatedly — it is re-run after each
 * `setStyle()`, since changing the basemap discards all custom sources and layers.
 */
export function installLayers(map: mapboxgl.Map, colors: TierColors, hubColor: string): void {
  addDiscoveredIcons(map);

  for (const id of Object.values(SOURCES)) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data: EMPTY_FC });
    }
  }

  const add = (layer: mapboxgl.LayerSpecification) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  };

  // --- Arcs (bottom) ---------------------------------------------------------
  add({
    id: LAYERS.arcGlow,
    type: 'line',
    source: SOURCES.arcs,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': tierMatch(colors),
      'line-blur': 3,
      'line-opacity': 0.18,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        ['*', ['get', 'w'], 1.6],
        11,
        ['*', ['get', 'w'], 2.8],
        16,
        ['*', ['get', 'w'], 4.5],
      ],
    },
  });

  add({
    id: LAYERS.arcLine,
    type: 'line',
    source: SOURCES.arcs,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': tierMatch(colors),
      'line-opacity': arcOpacityExpr(null),
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        ['*', ['get', 'w'], 0.55],
        11,
        ['get', 'w'],
        16,
        ['*', ['get', 'w'], 1.8],
      ],
    },
  });

  // --- Particles -------------------------------------------------------------
  add({
    id: LAYERS.particles,
    type: 'circle',
    source: SOURCES.particles,
    paint: {
      'circle-color': tierMatch(colors),
      'circle-opacity': particleOpacityExpr(null),
      'circle-blur': 0.25,
      'circle-pitch-alignment': 'map',
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        ['*', ['get', 'r'], 0.6],
        12,
        ['get', 'r'],
        16,
        ['*', ['get', 'r'], 1.6],
      ],
    },
  });

  // --- Discovered prospects --------------------------------------------------
  add({
    id: LAYERS.discovered,
    type: 'symbol',
    source: SOURCES.discovered,
    layout: {
      'icon-image': ['get', 'ratingCategory'],
      'icon-allow-overlap': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 12, 0.55, 16, 0.8],
    },
  });

  // --- Referring offices -----------------------------------------------------
  add({
    id: LAYERS.officeHalo,
    type: 'circle',
    source: SOURCES.offices,
    paint: {
      'circle-color': tierMatch(colors),
      'circle-opacity': 0.15,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 14, 16, 22],
    },
  });

  add({
    id: LAYERS.officeDot,
    type: 'circle',
    source: SOURCES.offices,
    paint: {
      'circle-color': tierMatch(colors),
      'circle-opacity': officeOpacityExpr(null),
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 7, 16, 11],
    },
  });

  add({
    id: LAYERS.officeLabel,
    type: 'symbol',
    source: SOURCES.offices,
    minzoom: 12,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: {
      'text-color': colors.Dormant,
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  });

  // --- Hubs (top) ------------------------------------------------------------
  add({
    id: LAYERS.hubPulse,
    type: 'circle',
    source: SOURCES.hubs,
    paint: {
      'circle-color': hubColor,
      'circle-opacity': 0.16,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 14, 12, 24, 16, 40],
    },
  });

  add({
    id: LAYERS.hubDot,
    type: 'circle',
    source: SOURCES.hubs,
    paint: {
      'circle-color': hubColor,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 3,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 12, 11, 16, 16],
    },
  });
}

/** Re-apply tier colours after a theme switch, without touching any data. */
export function applyColors(map: mapboxgl.Map, colors: TierColors, hubColor: string): void {
  const tier = tierMatch(colors);
  const set = (layer: string, prop: string, value: unknown) => {
    if (map.getLayer(layer)) {
      (map.setPaintProperty as (l: string, p: string, v: unknown) => void)(layer, prop, value);
    }
  };

  set(LAYERS.arcGlow, 'line-color', tier);
  set(LAYERS.arcLine, 'line-color', tier);
  set(LAYERS.particles, 'circle-color', tier);
  set(LAYERS.officeHalo, 'circle-color', tier);
  set(LAYERS.officeDot, 'circle-color', tier);
  set(LAYERS.officeLabel, 'text-color', colors.Dormant);
  set(LAYERS.hubPulse, 'circle-color', hubColor);
  set(LAYERS.hubDot, 'circle-color', hubColor);
}

/** Dim everything except the focused office. Paint-only — never re-tessellates. */
export function applyFocus(map: mapboxgl.Map, focusId: string | null): void {
  if (map.getLayer(LAYERS.arcLine)) {
    map.setPaintProperty(LAYERS.arcLine, 'line-opacity', arcOpacityExpr(focusId) as never);
  }
  if (map.getLayer(LAYERS.officeDot)) {
    map.setPaintProperty(LAYERS.officeDot, 'circle-opacity', officeOpacityExpr(focusId) as never);
  }
  if (map.getLayer(LAYERS.particles)) {
    map.setPaintProperty(LAYERS.particles, 'circle-opacity', particleOpacityExpr(focusId) as never);
  }
}
