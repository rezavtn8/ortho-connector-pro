/**
 * The outer ring of the circular network chart: leaves, group arcs, labels, and the
 * bundled curves that connect a leaf to a hub circle in the middle.
 *
 * Pure: no React, no DOM, no colors. Runs under `environment: "node"`.
 */

import { polar, TAU, type Point } from './svgPolar';

export interface RingLeafInput {
  id: string;
  label: string;
  group: string;
  value: number;
}

export interface RingLeaf extends RingLeafInput {
  /** Radians, 0 at 12 o'clock, clockwise. */
  angle: number;
  /** Anchor on the ring, where links attach. */
  x: number;
  y: number;
}

export interface RingGroupArc {
  group: string;
  startAngle: number;
  endAngle: number;
  count: number;
}

export interface RingLayout {
  leaves: RingLeaf[];
  groups: RingGroupArc[];
  radius: number;
  /** Groups named in `groupOrder` with no members. */
  emptyGroups: string[];
}

export interface RingOptions {
  cx: number;
  cy: number;
  radius: number;
  /** Explicit group order. Groups not listed are appended alphabetically. */
  groupOrder: readonly string[];
  /** Radians of empty ring between groups. */
  groupGap?: number;
  startAngle?: number;
  /** Ordering within a group. Defaults to value descending, ties by id. */
  compare?: (a: RingLeafInput, b: RingLeafInput) => number;
}

export function layoutRing(inputs: readonly RingLeafInput[], opts: RingOptions): RingLayout {
  const { cx, cy, groupOrder } = opts;
  const radius = Math.max(1, opts.radius);
  const groupGap = opts.groupGap ?? 0.06;
  const startAngle = opts.startAngle ?? 0;
  const compare =
    opts.compare ?? ((a: RingLeafInput, b: RingLeafInput) => b.value - a.value || (a.id < b.id ? -1 : 1));

  const rows = (inputs ?? []).filter((d) => d && typeof d.id === 'string');

  const known = new Set(groupOrder);
  const extras = [...new Set(rows.map((r) => r.group).filter((g) => !known.has(g)))].sort();
  const order = [...groupOrder, ...extras];

  const byGroup = new Map<string, RingLeafInput[]>();
  for (const g of order) byGroup.set(g, []);
  for (const r of rows) byGroup.get(r.group)?.push(r);

  const emptyGroups = order.filter((g) => (byGroup.get(g)?.length ?? 0) === 0);
  const nonEmpty = order.filter((g) => (byGroup.get(g)?.length ?? 0) > 0);

  if (nonEmpty.length === 0) return { leaves: [], groups: [], radius, emptyGroups };

  const total = rows.length;
  // An empty group takes no arc and, crucially, no gap either — four gaps for two
  // present groups would leave two visible notches in the ring with nothing beside
  // them, which reads as missing data rather than an absent category.
  const available = Math.max(0.001, TAU - nonEmpty.length * groupGap);

  const leaves: RingLeaf[] = [];
  const groups: RingGroupArc[] = [];

  let angle = startAngle;
  for (const group of nonEmpty) {
    const members = [...byGroup.get(group)!].sort(compare);
    const width = (available * members.length) / total;
    const arcStart = angle + groupGap / 2;
    const arcEnd = arcStart + width;

    // Leaves sit at slot centres, so the first and last of a group are inset from the
    // group boundary by half a slot and the gaps read evenly all the way round.
    const slot = width / members.length;
    members.forEach((m, i) => {
      const a = arcStart + slot * (i + 0.5);
      const p = polar(cx, cy, radius, a);
      leaves.push({ ...m, angle: a, x: p.x, y: p.y });
    });

    groups.push({ group, startAngle: arcStart, endAngle: arcEnd, count: members.length });
    angle = arcEnd + groupGap / 2;
  }

  return { leaves, groups, radius, emptyGroups };
}

export interface RingLabelPlacement {
  transform: string;
  anchor: 'start' | 'end';
  flipped: boolean;
}

/**
 * Transform and text-anchor for a label sitting just outside the ring at `angle`.
 *
 * The returned transform is relative to the ring centre, so the `<text>` goes at
 * `x=0 y=0` inside a `<g transform="translate(cx,cy)">` and every rotation composes
 * off one origin.
 *
 * Labels on the left half are rotated 180° and anchored at their end, so text reads
 * left-to-right everywhere instead of standing on its head for half the ring.
 */
export function ringLabelPlacement(radius: number, angle: number): RingLabelPlacement {
  // SVG's rotate(0) leaves +x pointing at 3 o'clock, and this module's angle 0 is 12
  // o'clock, so the frames differ by a quarter turn: subtract 90, do not add it.
  // Adding it puts every label diametrically opposite the leaf it names, which still
  // renders a perfectly tidy ring — just one where every name is on the wrong dot.
  const deg = ((((angle * 180) / Math.PI - 90) % 360) + 360) % 360;
  // Past a quarter turn the baseline is running leftward and the glyphs read upside
  // down. That band is exactly the left half of the ring.
  const flipped = deg > 90 && deg < 270;

  return {
    transform: `rotate(${deg}) translate(${radius},0)${flipped ? ' rotate(180)' : ''}`,
    anchor: flipped ? 'end' : 'start',
    flipped,
  };
}

export interface LabelPolicy {
  showLabels: boolean;
  fontSize: number;
  maxChars: number;
  /** True when the ring degrades to tick marks because names cannot fit. */
  tickOnly: boolean;
}

/**
 * How to label a ring of `count` leaves at `radius`.
 *
 * A radial label's neighbour clearance is its line height, ~1.25x the font size, so
 * the test is arc-per-leaf against that. Past the smallest legible size the names are
 * dropped for ticks — which is a *visible* degradation the caller must caption. The
 * alternative, aggregating leaves into an "and 137 more" node, is worse: a ring whose
 * leaf count does not match the office count is a chart that lies, and every entity
 * being present is the entire value of hierarchical edge bundling.
 */
export function labelPolicy(count: number, radius: number): LabelPolicy {
  if (count <= 0) return { showLabels: false, fontSize: 11, maxChars: 24, tickOnly: false };

  const arcPerLeaf = (TAU * Math.max(1, radius)) / count;
  const fits = (fontSize: number) => arcPerLeaf >= fontSize * 1.25;

  if (fits(11)) return { showLabels: true, fontSize: 11, maxChars: 24, tickOnly: false };
  if (fits(9)) return { showLabels: true, fontSize: 9, maxChars: 16, tickOnly: false };
  if (fits(7.5)) return { showLabels: true, fontSize: 7.5, maxChars: 12, tickOnly: false };
  return { showLabels: false, fontSize: 7.5, maxChars: 12, tickOnly: true };
}

export interface BundleHub {
  x: number;
  y: number;
  r: number;
}

export interface BundleOptions {
  /**
   * Where the first control point sits along the leaf's radial, as a fraction of the
   * distance from the ring centre out to the leaf. **Lower means a tighter bundle** —
   * same sense as d3's `curveBundle.beta`, where 1 is a straight line.
   *
   * This is what makes the bundles at all. The control point lies on the leaf's *own*
   * radial, so neighbouring leaves — whose radials are nearly identical — produce
   * curves that coincide for their first third and only separate deeper in. That
   * shared opening is the visible rope.
   *
   * Below ~0.3 every link is dragged through the exact centre and the chart becomes a
   * hairball; above ~0.75 the curves barely converge and the ropes stop reading.
   */
  beta?: number;
  /** How far outside the hub rim the second control point sits, as a fraction of the span. */
  approach?: number;
}

/**
 * A bundled cubic from a leaf on the ring to the rim of a hub circle.
 *
 * The link lands on the hub's **rim**, not its centre, and the second control point
 * sits on the far side of that landing point along the same ray. That places the
 * curve's tangent at the endpoint pointing *into* the hub, so it arrives head-on and
 * stops. The obvious alternative — putting the second control point at the hub centre —
 * points the tangent outward, and every link then dives through its own target circle
 * and comes back out the other side.
 */
export function bundlePath(
  leaf: Readonly<Point>,
  hub: Readonly<BundleHub>,
  center: Readonly<Point>,
  opts: BundleOptions = {},
): string {
  const beta = opts.beta ?? 0.55;
  const approach = opts.approach ?? 0.28;

  const r3 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 1000) / 1000;

  const dx = leaf.x - hub.x;
  const dy = leaf.y - hub.y;
  const span = Math.hypot(dx, dy);

  // A leaf sitting exactly on a hub centre leaves the direction undefined. Emit a
  // zero-length move rather than a NaN: one NaN in a `d` makes the browser discard the
  // whole path, silently and with no console error. `r3` sanitizes here too — the
  // fallback is reached precisely when an input was non-finite, so passing the raw
  // coordinate through would emit the NaN this branch exists to prevent.
  if (!(span > 1e-9) || !Number.isFinite(span)) {
    return `M ${r3(leaf.x)} ${r3(leaf.y)}`;
  }

  const ux = dx / span;
  const uy = dy / span;

  const endX = hub.x + hub.r * ux;
  const endY = hub.y + hub.r * uy;

  const c1x = center.x + (leaf.x - center.x) * beta;
  const c1y = center.y + (leaf.y - center.y) * beta;

  const c2x = endX + ux * approach * span;
  const c2y = endY + uy * approach * span;

  return (
    `M ${r3(leaf.x)} ${r3(leaf.y)}` +
    ` C ${r3(c1x)} ${r3(c1y)}, ${r3(c2x)} ${r3(c2y)}, ${r3(endX)} ${r3(endY)}`
  );
}
