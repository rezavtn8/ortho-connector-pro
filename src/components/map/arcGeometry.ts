/**
 * Curved flow-arc geometry for the patient-flow map.
 *
 * Deliberately dependency-free — no `mapbox-gl` import — because `vitest.config.ts`
 * runs `environment: "node"` and importing mapbox-gl touches `window` at module
 * scope. The Web Mercator projection it needs is six lines, so it's inlined below
 * rather than borrowed from `mapboxgl.MercatorCoordinate`.
 */

export type LngLat = readonly [number, number];

export interface Arc {
  /** Interleaved lng,lat pairs — `POINTS` points, `POINTS * 2` entries. */
  coords: Float64Array;
  /** The same points as GeoJSON LineString coordinates. */
  line: [number, number][];
}

/** Points per arc after arc-length resampling. */
export const POINTS = 48;

/** Bézier samples taken before resampling; only affects resampling accuracy. */
const SAMPLES = 128;

/** Control-point offset as a fraction of chord length. Higher = more curve. */
const DEFAULT_BULGE = 0.2;

/**
 * Arcs stop just short of the hub.
 *
 * Every arc converging on the exact same pixel is the classic hub-and-spoke
 * failure mode — the centre becomes an unreadable knot. Ending at 96.5% leaves a
 * small landing gap that the hub's own halo covers.
 */
const END_T = 0.965;

/** lng/lat -> normalized Web Mercator (0..1 on both axes). */
export function project(lng: number, lat: number): [number, number] {
  // Clamp to Mercator's valid range; poles project to infinity.
  const clamped = Math.max(-85.051129, Math.min(85.051129, lat));
  return [
    (lng + 180) / 360,
    (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))) / 360,
  ];
}

/** Normalized Web Mercator -> lng/lat. */
export function unproject(x: number, y: number): [number, number] {
  return [
    x * 360 - 180,
    (360 / Math.PI) * Math.atan(Math.exp(((180 - y * 360) * Math.PI) / 180)) - 90,
  ];
}

/**
 * Build a curved arc from an office to a hub.
 *
 * The Bézier is computed in **mercator space, not raw degrees**. One degree of
 * longitude is not one degree of latitude, so a degree-space curve looks squashed
 * and its apparent bulge changes with latitude. Mercator is conformal, so the same
 * arc reads identically in Miami and in Seattle.
 *
 * The curve is then **resampled to equal arc-length spacing**. Bézier `t` is not
 * uniform in arc length — without this step particles visibly accelerate through
 * the middle of every curve.
 */
export function buildArc(from: LngLat, to: LngLat, bulge = DEFAULT_BULGE): Arc {
  const a = project(from[0], from[1]);
  const b = project(to[0], to[1]);

  const dx = b[0] - a[0];
  const dy = b[1] - a[1];

  // Perpendicular with constant handedness, so arcs never mirror depending on
  // which side of the hub an office happens to sit on.
  const cx = (a[0] + b[0]) / 2 - dy * bulge;
  const cy = (a[1] + b[1]) / 2 + dx * bulge;

  // Dense sample of the quadratic Bézier, plus cumulative arc length.
  const sx = new Float64Array(SAMPLES + 1);
  const sy = new Float64Array(SAMPLES + 1);
  const cum = new Float64Array(SAMPLES + 1);

  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * END_T;
    const mt = 1 - t;
    const w0 = mt * mt;
    const w1 = 2 * mt * t;
    const w2 = t * t;

    sx[i] = w0 * a[0] + w1 * cx + w2 * b[0];
    sy[i] = w0 * a[1] + w1 * cy + w2 * b[1];

    if (i > 0) {
      cum[i] = cum[i - 1] + Math.hypot(sx[i] - sx[i - 1], sy[i] - sy[i - 1]);
    }
  }

  const total = cum[SAMPLES];
  const coords = new Float64Array(POINTS * 2);
  const line: [number, number][] = new Array(POINTS);

  // Degenerate chord (office sitting on the hub): emit the point repeated rather
  // than dividing by zero and producing NaN coordinates that would blank the layer.
  if (!(total > 0)) {
    const p = unproject(a[0], a[1]);
    for (let j = 0; j < POINTS; j++) {
      coords[j * 2] = p[0];
      coords[j * 2 + 1] = p[1];
      line[j] = [p[0], p[1]];
    }
    return { coords, line };
  }

  let seg = 0;
  for (let j = 0; j < POINTS; j++) {
    const target = (j / (POINTS - 1)) * total;
    while (seg < SAMPLES && cum[seg + 1] < target) seg++;

    const span = cum[seg + 1] - cum[seg];
    const u = span > 0 ? (target - cum[seg]) / span : 0;

    const mx = sx[seg] + (sx[seg + 1] - sx[seg]) * u;
    const my = sy[seg] + (sy[seg + 1] - sy[seg]) * u;
    const p = unproject(mx, my);

    coords[j * 2] = p[0];
    coords[j * 2 + 1] = p[1];
    line[j] = [p[0], p[1]];
  }

  return { coords, line };
}

/**
 * Position at progress `p` (0 = office, 1 = hub end) along a resampled arc.
 *
 * O(1) with no allocation and no binary search — the samples are already uniform in
 * arc length, which is the whole point of the resampling step. Writes into a
 * caller-owned tuple because this runs for every particle on every frame.
 */
export function pointOnArc(coords: Float64Array, p: number, out: [number, number]): void {
  const n = coords.length / 2 - 1;
  const clamped = p <= 0 ? 0 : p >= 1 ? 1 : p;

  const f = clamped * n;
  const i = f | 0;
  const u = f - i;
  const j = i * 2;

  if (i >= n) {
    out[0] = coords[n * 2];
    out[1] = coords[n * 2 + 1];
    return;
  }

  out[0] = coords[j] + (coords[j + 2] - coords[j]) * u;
  out[1] = coords[j + 1] + (coords[j + 3] - coords[j + 1]) * u;
}
