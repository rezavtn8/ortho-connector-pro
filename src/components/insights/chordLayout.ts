/**
 * Chord layout for the tier-transition view.
 *
 * Where the network chart shows *which* offices moved, this shows *how much* moved
 * between which pairs — the aggregate the network's five hundred individual curves
 * cannot be read for. Every arc is a tier; every ribbon is the volume that went from
 * one tier to another over the period; the self-ribbon is the volume that stayed put.
 *
 * Pure: no React, no DOM, no colors. Runs under `environment: "node"`.
 */

import { TAU } from './svgPolar';

export interface ChordGroup {
  key: string;
  label: string;
  /** Outgoing + incoming, which is what the arc length encodes. */
  total: number;
  outgoing: number;
  incoming: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  /** `d` for the arc band. */
  path: string;
}

export interface ChordRibbon {
  from: string;
  to: string;
  value: number;
  /** True when source and target are the same group. */
  isSelf: boolean;
  path: string;
  /** Midpoint angles of each foot, for hit-testing and labels. */
  sourceAngle: number;
  targetAngle: number;
}

export interface ChordLayout {
  groups: ChordGroup[];
  ribbons: ChordRibbon[];
  total: number;
  /** Volume that changed group, as a share of the total. 0..1. */
  movedShare: number;
}

export interface ChordOptions {
  cx: number;
  cy: number;
  /** Inner radius the ribbons attach to. */
  radius: number;
  /** Thickness of the arc band drawn outside `radius`. */
  bandWidth?: number;
  /** Radians of empty ring between groups. */
  padAngle?: number;
  /** How deep the ribbons dip toward the centre. 0 is a straight chord. */
  curvature?: number;
}

/** matrix[i][j] = volume moving from group i to group j. */
export type ChordMatrix = number[][];

function r2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function pt(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

function arcBand(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const o0 = pt(cx, cy, r1, a0);
  const o1 = pt(cx, cy, r1, a1);
  const i1 = pt(cx, cy, r0, a1);
  const i0 = pt(cx, cy, r0, a0);
  return (
    `M ${r2(o0.x)} ${r2(o0.y)}` +
    ` A ${r2(r1)} ${r2(r1)} 0 ${large} 1 ${r2(o1.x)} ${r2(o1.y)}` +
    ` L ${r2(i1.x)} ${r2(i1.y)}` +
    ` A ${r2(r0)} ${r2(r0)} 0 ${large} 0 ${r2(i0.x)} ${r2(i0.y)} Z`
  );
}

/**
 * A ribbon between two angular spans on the same circle.
 *
 * Both edges are quadratic curves through a control point pulled toward the centre by
 * `curvature`. Using the exact centre for every ribbon — the obvious choice — makes
 * every ribbon pass through one point, so a busy diagram turns into a knot with no
 * readable middle. Scaling the pull by how far apart the feet are keeps short hops
 * shallow and long ones deep, which is what separates them.
 */
function ribbonPath(
  cx: number,
  cy: number,
  r: number,
  s0: number,
  s1: number,
  t0: number,
  t1: number,
  curvature: number,
): string {
  const sa = pt(cx, cy, r, s0);
  const sb = pt(cx, cy, r, s1);
  const ta = pt(cx, cy, r, t0);
  const tb = pt(cx, cy, r, t1);

  // Angular separation between the feet, 0..1, where 1 is diametrically opposite.
  const sep = Math.abs(((s0 + s1) / 2 - (t0 + t1) / 2 + TAU) % TAU);
  const spread = Math.min(sep, TAU - sep) / Math.PI;

  // How far out from the centre the control point sits, as a fraction of the way to
  // the chord's own midpoint. Near 1 for feet that are close together — a self-loop
  // then hugs its own arc — and small for feet on opposite sides, which is what makes
  // a long ribbon dive through the middle. Inverting this is the classic mistake: it
  // drags every self-loop to the centre, and the diagram renders as a pie chart with
  // four lens-shaped wedges instead of a chord.
  const pull = 1 - curvature * spread;

  const control = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: cx + ((a.x + b.x) / 2 - cx) * pull,
    y: cy + ((a.y + b.y) / 2 - cy) * pull,
  });

  const cSourceToTarget = control(sb, ta);
  const cTargetToSource = control(tb, sa);
  const largeS = s1 - s0 > Math.PI ? 1 : 0;
  const largeT = t1 - t0 > Math.PI ? 1 : 0;

  return (
    `M ${r2(sa.x)} ${r2(sa.y)}` +
    ` A ${r2(r)} ${r2(r)} 0 ${largeS} 1 ${r2(sb.x)} ${r2(sb.y)}` +
    ` Q ${r2(cSourceToTarget.x)} ${r2(cSourceToTarget.y)} ${r2(ta.x)} ${r2(ta.y)}` +
    ` A ${r2(r)} ${r2(r)} 0 ${largeT} 1 ${r2(tb.x)} ${r2(tb.y)}` +
    ` Q ${r2(cTargetToSource.x)} ${r2(cTargetToSource.y)} ${r2(sa.x)} ${r2(sa.y)} Z`
  );
}

export function layoutChord(
  keys: readonly string[],
  labels: Readonly<Record<string, string>>,
  matrix: ChordMatrix,
  opts: ChordOptions,
): ChordLayout {
  const { cx, cy } = opts;
  const radius = Math.max(1, opts.radius);
  const bandWidth = Math.max(2, opts.bandWidth ?? 16);
  const padAngle = Math.max(0, opts.padAngle ?? 0.04);
  const curvature = Math.min(1, Math.max(0, opts.curvature ?? 0.85));

  const n = keys?.length ?? 0;
  const at = (i: number, j: number) => {
    const v = matrix?.[i]?.[j];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
  };

  if (n === 0) return { groups: [], ribbons: [], total: 0, movedShare: 0 };

  const outgoing = keys.map((_, i) => keys.reduce((acc, __, j) => acc + at(i, j), 0));
  const incoming = keys.map((_, j) => keys.reduce((acc, __, i) => acc + at(i, j), 0));
  const totals = keys.map((_, i) => outgoing[i] + incoming[i]);
  const grand = totals.reduce((a, b) => a + b, 0);

  // Groups that carry nothing get no arc *and* no pad. Reserving a slice for an empty
  // tier leaves a gap on the ring with no label beside it, which reads as a rendering
  // fault rather than as "nothing was in this tier".
  const present = keys.map((_, i) => totals[i] > 0);
  const presentCount = present.filter(Boolean).length;

  if (grand === 0 || presentCount === 0) {
    return { groups: [], ribbons: [], total: 0, movedShare: 0 };
  }

  const available = Math.max(0.001, TAU - presentCount * padAngle);
  const groups: ChordGroup[] = [];
  const spans = new Map<string, { start: number; end: number }>();

  let angle = 0;
  keys.forEach((key, i) => {
    if (!present[i]) return;
    const start = angle + padAngle / 2;
    const end = start + (available * totals[i]) / grand;
    spans.set(key, { start, end });
    groups.push({
      key,
      label: labels?.[key] ?? key,
      total: totals[i],
      outgoing: outgoing[i],
      incoming: incoming[i],
      startAngle: start,
      endAngle: end,
      midAngle: (start + end) / 2,
      path: arcBand(cx, cy, radius, radius + bandWidth, start, end),
    });
    angle = end + padAngle / 2;
  });

  // Sub-spans. Each group's arc is divided outgoing-first then incoming, both in key
  // order, so a ribbon's two feet always land in the same relative place and the
  // picture is stable as the data moves.
  const cursor = new Map<string, number>();
  for (const g of groups) cursor.set(g.key, spans.get(g.key)!.start);

  const take = (key: string, value: number): { a0: number; a1: number } => {
    const span = spans.get(key)!;
    const width = ((span.end - span.start) * value) / Math.max(1e-9, totals[keys.indexOf(key)]);
    const a0 = cursor.get(key)!;
    const a1 = a0 + width;
    cursor.set(key, a1);
    return { a0, a1 };
  };

  const ribbons: ChordRibbon[] = [];
  let moved = 0;

  // Outgoing feet first, for every group, before any incoming foot — otherwise the
  // two loops interleave on the arc and ribbons cross their own group.
  const outFeet = new Map<string, { a0: number; a1: number }>();
  for (let i = 0; i < n; i++) {
    if (!present[i]) continue;
    for (let j = 0; j < n; j++) {
      const v = at(i, j);
      if (v <= 0) continue;
      outFeet.set(`${keys[i]}|${keys[j]}`, take(keys[i], v));
    }
  }

  for (let j = 0; j < n; j++) {
    if (!present[j]) continue;
    for (let i = 0; i < n; i++) {
      const v = at(i, j);
      if (v <= 0) continue;
      const source = outFeet.get(`${keys[i]}|${keys[j]}`)!;
      const target = take(keys[j], v);
      if (i !== j) moved += v;

      ribbons.push({
        from: keys[i],
        to: keys[j],
        value: v,
        isSelf: i === j,
        sourceAngle: (source.a0 + source.a1) / 2,
        targetAngle: (target.a0 + target.a1) / 2,
        path: ribbonPath(cx, cy, radius, source.a0, source.a1, target.a0, target.a1, curvature),
      });
    }
  }

  const total = grand / 2; // each unit is counted once outgoing and once incoming
  return { groups, ribbons, total, movedShare: total > 0 ? moved / total : 0 };
}
