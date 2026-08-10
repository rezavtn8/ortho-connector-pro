/**
 * Polar geometry and path builders shared by the Insights diagrams.
 *
 * Angle convention, fixed here once so every chart on the page agrees: **0 is 12
 * o'clock and angles increase clockwise**, in radians. SVG's y axis points down, so
 * the standard `(cos, sin)` pair would put 0 at 3 o'clock and run counter-clockwise
 * on screen — every chart would then need its own quarter-turn fudge, and they would
 * drift apart the first time someone forgot one.
 *
 * Pure by design: no React, no DOM, no colors. `vitest.config.ts` runs
 * `environment: "node"`, so nothing here may touch `window` at import time.
 *
 * A single `NaN` inside a `d` string makes the browser discard the *entire* path
 * silently, and a `NaN` in a transform can blank a whole `<g>`. Every function here
 * therefore guards its divisions and returns a degenerate-but-valid shape rather than
 * propagating one, the same posture `arcGeometry.buildArc` takes.
 */

export interface Point {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

/** Round to 3dp so path strings stay short and stable across renders. */
function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Non-finite in, zero out — the guard that stops one bad value blanking a path. */
function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/** A point at `angle` and `radius` from `(cx, cy)`. 0 is 12 o'clock, clockwise. */
export function polar(cx: number, cy: number, radius: number, angle: number): Point {
  const a = safe(angle);
  const rad = safe(radius);
  return {
    x: safe(cx) + rad * Math.sin(a),
    y: safe(cy) - rad * Math.cos(a),
  };
}

/**
 * An `A`-command arc from `a0` to `a1` at one radius.
 *
 * `sweep` follows SVG semantics: 1 draws clockwise on screen, which given the angle
 * convention above is the direction of increasing angle. Passing 0 draws the arc
 * backwards, which is how a `<textPath>` label on the bottom half is kept right side up.
 */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  a0: number,
  a1: number,
  sweep: 0 | 1 = 1,
): string {
  // Sanitize the radius here as well as inside `polar` — it is emitted directly as the
  // `A` command's rx/ry, where `polar`'s guard cannot reach it.
  const rad = Math.max(0, safe(radius));
  const from = safe(a0);
  const to = safe(a1);

  const start = polar(cx, cy, rad, from);
  const end = polar(cx, cy, rad, to);
  const span = Math.abs(to - from);

  // A full turn has identical endpoints, so a single `A` command draws nothing at all.
  // Split it in two so a 2π arc is still a circle.
  if (span >= TAU - 1e-9) {
    const mid = polar(cx, cy, rad, from + Math.PI);
    return (
      `M ${r3(start.x)} ${r3(start.y)}` +
      ` A ${r3(rad)} ${r3(rad)} 0 0 ${sweep} ${r3(mid.x)} ${r3(mid.y)}` +
      ` A ${r3(rad)} ${r3(rad)} 0 0 ${sweep} ${r3(start.x)} ${r3(start.y)}`
    );
  }

  const largeArc = span > Math.PI ? 1 : 0;
  return (
    `M ${r3(start.x)} ${r3(start.y)}` +
    ` A ${r3(rad)} ${r3(rad)} 0 ${largeArc} ${sweep} ${r3(end.x)} ${r3(end.y)}`
  );
}

/**
 * A filled annulus sector — the radial bar shape.
 *
 * Degenerates safely: equal radii collapse to an arc, a zero angular span collapses to
 * a line, and both together give a lone `M`. All three are valid `d` strings that
 * render nothing, which is what a zero-value bar should do.
 */
export function annulusSectorPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const inner = Math.max(0, Math.min(safe(r0), safe(r1)));
  const outer = Math.max(0, Math.max(safe(r0), safe(r1)));
  const start = Math.min(safe(a0), safe(a1));
  const end = Math.max(safe(a0), safe(a1));
  const span = Math.min(end - start, TAU);
  const largeArc = span > Math.PI ? 1 : 0;

  const o0 = polar(cx, cy, outer, start);
  const o1 = polar(cx, cy, outer, start + span);
  const i1 = polar(cx, cy, inner, start + span);
  const i0 = polar(cx, cy, inner, start);

  if (span <= 1e-9) {
    return `M ${r3(o0.x)} ${r3(o0.y)} L ${r3(i0.x)} ${r3(i0.y)}`;
  }

  return (
    `M ${r3(o0.x)} ${r3(o0.y)}` +
    ` A ${r3(outer)} ${r3(outer)} 0 ${largeArc} 1 ${r3(o1.x)} ${r3(o1.y)}` +
    ` L ${r3(i1.x)} ${r3(i1.y)}` +
    ` A ${r3(inner)} ${r3(inner)} 0 ${largeArc} 0 ${r3(i0.x)} ${r3(i0.y)}` +
    ' Z'
  );
}

/**
 * Tick values covering `[0, max]` on a 1 / 2 / 5 × 10^k step.
 *
 * Always returns at least `[0]`, so a caller can render the scale rings without a
 * length check. Ticks never exceed `max` — a ring drawn beyond the outermost bar
 * would read as headroom that does not exist.
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  const m = safe(max);
  if (!(m > 0) || targetCount < 1) return [0];

  const rough = m / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  // Heckbert's "nice numbers" thresholds — they round to whichever of 1/2/5 lands
  // *nearest* the requested tick count. Rounding up instead (`<= 2 ? 2 : <= 5 ? 5`)
  // turns a max of 10 into two rings at 0 and 5, which is too coarse to read a bar
  // against.
  const step = (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) * magnitude;

  const out: number[] = [];
  // Guard the loop independently of the arithmetic: a pathological `max` must not
  // spin here, and a float step must not emit 10001 ticks.
  for (let v = 0, i = 0; v <= m + 1e-9 && i < 64; v += step, i++) {
    out.push(Math.round(v * 1e6) / 1e6);
  }
  return out.length ? out : [0];
}

/**
 * Truncate to `max` characters with a real ellipsis.
 *
 * Iterates by code point rather than UTF-16 unit. Slicing mid-surrogate produces a
 * lone half of a pair, which renders as a replacement glyph — an office named with an
 * emoji or a non-BMP script would show a black diamond instead of a clean cut.
 */
export function truncateLabel(text: string, max: number): string {
  if (typeof text !== 'string') return '';
  if (max <= 0) return '';

  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return chars.slice(0, Math.max(1, max - 1)).join('') + '…';
}

/** Clamp `n` into `[lo, hi]`, non-finite in giving `lo`. */
export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * Dev-only tripwire for a non-finite value about to enter a path string.
 *
 * A `NaN` in a `d` blanks the path with no console error and no visual clue beyond
 * "the chart is missing a shape", which is exactly the class of bug that survives
 * review. Stripped from production builds by the `import.meta.env.DEV` guard.
 */
export function assertFinite(label: string, ...values: number[]): void {
  if (!import.meta.env?.DEV) return;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      console.warn(`[insights] ${label} produced a non-finite value:`, values);
      return;
    }
  }
}
