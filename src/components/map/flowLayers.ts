import type mapboxgl from 'mapbox-gl';
import type { ExpressionSpecification } from 'mapbox-gl';
import { lighten, withAlpha, type TierColors } from './flowScales';

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
  rings: 'catchment-rings',
} as const;

export type SourceId = (typeof SOURCES)[keyof typeof SOURCES];

export const LAYERS = {
  rings: 'catchment-rings',
  ringLabels: 'catchment-ring-labels',
  arcGlow: 'flow-arcs-glow',
  particles: 'flow-particles-dot',
  discovered: 'discovered-offices-icon',
  officeHalo: 'network-offices-halo',
  officeDot: 'network-offices-dot',
  officeLabel: 'network-offices-label',
  hubPulse: 'hub-pulse',
  hubDot: 'hub-dot',
} as const;

export const TIERS = ['VIP', 'Warm', 'Cold', 'Dormant'] as const;

/**
 * One arc layer per tier.
 *
 * `line-gradient` is what makes an arc read as *flowing* rather than as a static
 * connector, but Mapbox gradient stops must be literal colours — the expression can
 * only reference `line-progress`, never `['get', 'tier']`. So the tier split has to
 * happen at the layer level, with each layer filtered to its own tier.
 */
export const arcLayerId = (tier: string) => `flow-arc-${tier}`;
export const ARC_LAYER_IDS = TIERS.map(arcLayerId);

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

/** A brighter variant, so particles read as moving light on top of their arc. */
function tierMatchBright(colors: TierColors, delta = 20): ExpressionSpecification {
  return tierMatch({
    VIP: lighten(colors.VIP, delta),
    Warm: lighten(colors.Warm, delta),
    Cold: lighten(colors.Cold, delta),
    Dormant: lighten(colors.Dormant, delta),
  });
}

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
    if (map.getSource(id)) continue;
    // `lineMetrics` computes `line-progress`, which the arc gradients depend on.
    map.addSource(id, {
      type: 'geojson',
      data: EMPTY_FC,
      ...(id === SOURCES.arcs ? { lineMetrics: true } : {}),
    });
  }

  /**
   * Add a layer and verify it landed.
   *
   * Mapbox validates layer specs and, on failure, emits an error event and simply
   * doesn't add the layer — `addLayer` neither throws nor returns a status. A bad
   * paint value therefore yields a blank map with no obvious cause. Checking
   * afterwards turns that into a loud, named failure.
   */
  const add = (layer: mapboxgl.LayerSpecification) => {
    if (map.getLayer(layer.id)) return;
    map.addLayer(layer);
    if (!map.getLayer(layer.id)) {
      console.error(
        `[flowLayers] Mapbox rejected layer "${layer.id}" — it is NOT on the map. ` +
          `Check the preceding Mapbox error; a common cause is a colour in CSS ` +
          `Color Level 4 syntax, which Mapbox cannot parse.`,
      );
    }
  };

  // `text-field` requires the style to declare `glyphs`. The dev preview harness
  // uses a self-contained style without one, so skip labels rather than log noise.
  const hasGlyphs = Boolean(map.getStyle()?.glyphs);

  // --- Catchment rings (bottom) ---------------------------------------------
  add({
    id: LAYERS.rings,
    type: 'line',
    source: SOURCES.rings,
    paint: {
      'line-color': hubColor,
      'line-opacity': 0.28,
      'line-width': 1,
      'line-dasharray': [3, 3],
    },
  });

  if (hasGlyphs)
    add({
      id: LAYERS.ringLabels,
      type: 'symbol',
      source: SOURCES.rings,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 10,
        'symbol-placement': 'line',
        'text-offset': [0, -0.6],
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': hubColor,
        'text-opacity': 0.65,
        'text-halo-color': 'rgba(0,0,0,0.6)',
        'text-halo-width': 1,
      },
    });

  // --- Arc glow -------------------------------------------------------------
  add({
    id: LAYERS.arcGlow,
    type: 'line',
    source: SOURCES.arcs,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': tierMatch(colors),
      'line-blur': 6,
      'line-opacity': 0.32,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        ['*', ['get', 'w'], 2.4],
        11,
        ['*', ['get', 'w'], 4],
        16,
        ['*', ['get', 'w'], 6.5],
      ],
    },
  });

  // --- Arc bodies, one gradient layer per tier ------------------------------
  for (const tier of TIERS) {
    const tierColor = colors[tier];
    add({
      id: arcLayerId(tier),
      type: 'line',
      source: SOURCES.arcs,
      filter: ['==', ['get', 'tier'], tier],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        // Fades in at the office and brightens into the practice, so the arc
        // reads as directional without needing an arrowhead.
        'line-gradient': [
          'interpolate',
          ['linear'],
          ['line-progress'],
          0,
          withAlpha(tierColor, 0),
          0.18,
          withAlpha(tierColor, 0.55),
          0.7,
          tierColor,
          1,
          lighten(hubColor, 22),
        ],
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
  }

  // --- Particles -------------------------------------------------------------
  add({
    id: LAYERS.particles,
    type: 'circle',
    source: SOURCES.particles,
    paint: {
      'circle-color': tierMatchBright(colors),
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
      'circle-opacity': 0.22,
      'circle-blur': 0.6,
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
      // A dark rim separates the dot from the arc terminating beneath it; a white
      // rim at this size dominates the dot's own tier colour on a dark basemap.
      'circle-stroke-color': 'rgba(8, 14, 22, 0.85)',
      'circle-stroke-width': 1.5,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 12, 6, 16, 10],
    },
  });

  if (hasGlyphs) add({
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
      'circle-color': lighten(hubColor, 18),
      'circle-stroke-color': 'rgba(255, 255, 255, 0.9)',
      'circle-stroke-width': 2.5,
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
  for (const t of TIERS) {
    set(arcLayerId(t), 'line-gradient', [
      'interpolate',
      ['linear'],
      ['line-progress'],
      0,
      withAlpha(colors[t], 0),
      0.18,
      withAlpha(colors[t], 0.55),
      0.7,
      colors[t],
      1,
      lighten(hubColor, 22),
    ]);
  }
  set(LAYERS.particles, 'circle-color', tier);
  set(LAYERS.officeHalo, 'circle-color', tier);
  set(LAYERS.officeDot, 'circle-color', tier);
  set(LAYERS.officeLabel, 'text-color', colors.Dormant);
  set(LAYERS.hubPulse, 'circle-color', hubColor);
  set(LAYERS.hubDot, 'circle-color', hubColor);
  set(LAYERS.rings, 'line-color', hubColor);
  set(LAYERS.ringLabels, 'text-color', hubColor);
}

/** Dim everything except the focused office. Paint-only — never re-tessellates. */
export function applyFocus(map: mapboxgl.Map, focusId: string | null): void {
  for (const tier of TIERS) {
    const id = arcLayerId(tier);
    if (map.getLayer(id)) {
      map.setPaintProperty(id, 'line-opacity', arcOpacityExpr(focusId) as never);
    }
  }
  if (map.getLayer(LAYERS.officeDot)) {
    map.setPaintProperty(LAYERS.officeDot, 'circle-opacity', officeOpacityExpr(focusId) as never);
  }
  if (map.getLayer(LAYERS.particles)) {
    map.setPaintProperty(LAYERS.particles, 'circle-opacity', particleOpacityExpr(focusId) as never);
  }
}
