/**
 * Stacked-area layout for the Tides view.
 *
 * Stacked to a zero baseline rather than a wiggle-centred streamgraph. A streamgraph
 * is prettier and it is also unreadable for the question this view answers: with a
 * floating baseline nobody can tell whether a band grew or the band beneath it did,
 * and the total — the practice's monthly volume, the single most-checked number in the
 * app — stops being readable at all. The zero baseline keeps the top edge of the stack
 * meaning "patients this month".
 *
 * Pure: no React, no DOM, no colors. Runs under `environment: "node"`.
 */

export interface StreamSeriesInput {
  key: string;
  label: string;
  /** One value per x position, aligned to the axis. Missing entries read as zero. */
  values: readonly number[];
}

export interface StreamPoint {
  x: number;
  y0: number;
  y1: number;
  value: number;
}

export interface StreamBand {
  key: string;
  label: string;
  points: StreamPoint[];
  /** Closed `d` for the filled band. */
  path: string;
  /** Open `d` along the band's top edge, for a crisper boundary stroke. */
  topPath: string;
  total: number;
  peak: number;
}

export interface StreamLayout {
  bands: StreamBand[];
  /** x per axis position, so the caller can place ticks and a cursor. */
  xs: number[];
  /** Stack total per axis position. */
  totals: number[];
  /** Largest stack total; the y domain. */
  max: number;
  /** `d` for the outline of the whole stack, drawn over the bands. */
  outlinePath: string;
}

export interface StreamOptions {
  width: number;
  height: number;
  /**
   * How round the curves are, 0..1. Zero gives straight segments.
   *
   * Monotone-safe by construction: control points only ever move horizontally, so a
   * curve can never overshoot below its own endpoints and paint a band into negative
   * territory the data never visited. A Catmull-Rom or natural cubic would.
   */
  curvature?: number;
}

function r2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/**
 * A horizontally-smoothed polyline through `pts`.
 *
 * `reverse` walks it backwards, which is how the bottom edge of a band is drawn so the
 * fill closes cleanly without a seam.
 */
function edgePath(
  pts: Array<{ x: number; y: number }>,
  curvature: number,
  reverse = false,
  moveTo = true,
): string {
  const list = reverse ? [...pts].reverse() : pts;
  if (list.length === 0) return '';
  if (list.length === 1) {
    return `${moveTo ? 'M' : 'L'} ${r2(list[0].x)} ${r2(list[0].y)}`;
  }

  let d = `${moveTo ? 'M' : 'L'} ${r2(list[0].x)} ${r2(list[0].y)}`;
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1];
    const b = list[i];
    if (curvature <= 0) {
      d += ` L ${r2(b.x)} ${r2(b.y)}`;
      continue;
    }
    const dx = (b.x - a.x) * curvature;
    d += ` C ${r2(a.x + dx)} ${r2(a.y)}, ${r2(b.x - dx)} ${r2(b.y)}, ${r2(b.x)} ${r2(b.y)}`;
  }
  return d;
}

export function layoutStream(
  series: readonly StreamSeriesInput[],
  length: number,
  opts: StreamOptions,
): StreamLayout {
  const width = Math.max(1, opts.width);
  const height = Math.max(1, opts.height);
  const curvature = Math.min(1, Math.max(0, opts.curvature ?? 0.42));
  const n = Math.max(0, Math.trunc(length));

  const rows = (series ?? []).filter((s) => s && typeof s.key === 'string');

  if (n === 0 || rows.length === 0) {
    return { bands: [], xs: [], totals: [], max: 0, outlinePath: '' };
  }

  const xs =
    n === 1 ? [width / 2] : Array.from({ length: n }, (_, i) => (i / (n - 1)) * width);

  const value = (s: StreamSeriesInput, i: number) => {
    const v = s.values?.[i];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
  };

  const totals = Array.from({ length: n }, (_, i) =>
    rows.reduce((acc, s) => acc + value(s, i), 0),
  );
  // Floored at 1 so an all-empty window scales without dividing by zero and blanking
  // every path with NaN.
  const max = Math.max(1, ...totals);
  const ky = height / max;

  // Stack in the order given. The caller owns that order, because it is meaningful
  // (VIP at the bottom, Dormant at the top) and a layout module reordering it would
  // make the bands swap places whenever the data shifted.
  const running = new Array<number>(n).fill(0);
  const bands: StreamBand[] = [];

  for (const s of rows) {
    const points: StreamPoint[] = [];
    let total = 0;
    let peak = 0;

    for (let i = 0; i < n; i++) {
      const v = value(s, i);
      const y0 = height - running[i] * ky;
      running[i] += v;
      const y1 = height - running[i] * ky;
      points.push({ x: xs[i], y0, y1, value: v });
      total += v;
      if (v > peak) peak = v;
    }

    const top = points.map((p) => ({ x: p.x, y: p.y1 }));
    const bottom = points.map((p) => ({ x: p.x, y: p.y0 }));
    const topPath = edgePath(top, curvature);
    const path = `${topPath} ${edgePath(bottom, curvature, true, false)} Z`;

    bands.push({ key: s.key, label: s.label, points, path, topPath, total, peak });
  }

  const outlinePath = edgePath(
    xs.map((x, i) => ({ x, y: height - totals[i] * ky })),
    curvature,
  );

  return { bands, xs, totals, max, outlinePath };
}

/** Index of the axis position nearest `x`, or -1 when there is no axis. */
export function nearestIndex(xs: readonly number[], x: number): number {
  if (!xs.length) return -1;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i] - x);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
