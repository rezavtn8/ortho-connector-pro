/**
 * Radial bar layout: one bar per office, grouped into sectors around a donut hole.
 *
 * Two geometry decisions carry the whole chart, and both have a tempting wrong answer.
 *
 * **Angle is proportional to bar count, not equal quarters.** Four equal quarters would
 * give a Dormant sector of six offices bars twenty times fatter than the VIP sector's
 * hundred-and-twenty. A radial bar's perceived weight is its *area*, so those fat stubs
 * would out-shout the long thin bars they lose to — the chart would say the opposite of
 * the data. Proportional allocation makes every bar the same angular width everywhere,
 * which leaves length as the only encoding, which is what a bar chart promises.
 *
 * **Radius is linear in value, not sqrt.** The standard criticism of coxcomb charts —
 * that area grows quadratically with radius — applies to wedges drawn from the origin.
 * Here every bar starts at the same `innerRadius` and spans the same angle, so the
 * reader's task is comparing lengths against a common baseline: an ordinary bar chart,
 * bent. A sqrt scale would compress exactly the top referrers this page exists to
 * surface, and would make the value rings unreadable (evenly spaced rings would stand
 * for uneven value steps). The real remedy for the residual area distortion is the
 * donut hole — see `DEFAULT_HOLE_RATIO`.
 *
 * Pure: no React, no DOM, no colors. Runs under `environment: "node"`.
 */

import { annulusSectorPath, arcPath, niceTicks, TAU } from './svgPolar';

/**
 * Inner radius as a fraction of the outer.
 *
 * At 0.52 the longest bar is only ~1.9x wider at its tip than at its base. A small
 * hole (say 0.15) puts that ratio past 6x, and the tip of every long bar then carries
 * far more ink than its base — which is the area distortion people actually notice.
 * This constant is the reason good radial bar charts have a big hole in the middle.
 */
export const DEFAULT_HOLE_RATIO = 0.52;

export type RadialMode = 'magnitude' | 'diverging';

export interface RadialBarInput {
  id: string;
  label: string;
  group: string;
  /** What the bar length encodes. May be negative in diverging mode. */
  value: number;
  /** What decides position within the sector. Kept stable across metric toggles. */
  sortValue: number;
}

export interface RadialSector {
  group: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  count: number;
  /** `d` for the curved outer label arc, already reversed on the lower half. */
  labelPath: string;
  /** Radius the label arc sits on, so the caller can size the viewBox. */
  labelRadius: number;
}

export interface RadialBar {
  id: string;
  label: string;
  group: string;
  value: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  r0: number;
  r1: number;
  /** -1 losing, 0 flat, 1 gaining. Always 1 in magnitude mode for a positive value. */
  sign: -1 | 0 | 1;
  path: string;
}

export interface RadialScale {
  mode: RadialMode;
  /** `max(value)`, or `max(|value|)` diverging. Never zero. */
  domainMax: number;
  innerRadius: number;
  outerRadius: number;
  /** Where a value of zero sits. Equals `innerRadius` in magnitude mode. */
  zeroRadius: number;
  ticks: Array<{ value: number; radius: number }>;
  /** The widest inter-sector gap, where tick labels can sit without crossing a bar. */
  gutterAngle: number;
}

export interface RadialBarLayout {
  bars: RadialBar[];
  sectors: RadialSector[];
  scale: RadialScale;
  /** Groups named in `groupOrder` with no members, so the legend can say "0 offices". */
  emptyGroups: string[];
}

export interface RadialBarOptions {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  groupOrder: readonly string[];
  mode: RadialMode;
  /** Radians of empty ring between sectors. */
  sectorGap?: number;
  /** Smallest angular width a non-empty sector may have, so its label still fits. */
  minSectorAngle?: number;
  /** Fraction of its angular slot a bar occupies. */
  barPad?: number;
  /** Distance beyond `outerRadius` for the curved sector labels. */
  labelOffset?: number;
}

export function layoutRadialBars(
  inputs: readonly RadialBarInput[],
  opts: RadialBarOptions,
): RadialBarLayout {
  const { cx, cy, mode, groupOrder } = opts;
  const innerRadius = Math.max(0, opts.innerRadius);
  const outerRadius = Math.max(innerRadius + 1, opts.outerRadius);
  const sectorGap = opts.sectorGap ?? 0.05;
  const minSectorAngle = opts.minSectorAngle ?? 0.12;
  const barPad = Math.min(1, Math.max(0.1, opts.barPad ?? 0.78));
  const labelOffset = opts.labelOffset ?? 24;

  const rows = (inputs ?? []).filter((d) => d && typeof d.id === 'string');

  // Every group named in `groupOrder`, plus any straggler group the caller forgot,
  // appended rather than dropped — silently discarding a bar is worse than an
  // unexpected sector.
  const known = new Set(groupOrder);
  const extras = [...new Set(rows.map((r) => r.group).filter((g) => !known.has(g)))].sort();
  const order = [...groupOrder, ...extras];

  const byGroup = new Map<string, RadialBarInput[]>();
  for (const g of order) byGroup.set(g, []);
  for (const r of rows) byGroup.get(r.group)?.push(r);

  const emptyGroups = order.filter((g) => (byGroup.get(g)?.length ?? 0) === 0);
  const nonEmpty = order.filter((g) => (byGroup.get(g)?.length ?? 0) > 0);

  const scaleBase: RadialScale = {
    mode,
    domainMax: 1,
    innerRadius,
    outerRadius,
    zeroRadius: innerRadius,
    ticks: [],
    gutterAngle: 0,
  };

  if (nonEmpty.length === 0) {
    return { bars: [], sectors: [], scale: scaleBase, emptyGroups };
  }

  // Value domain. Floored at 1 so an all-zero window cannot divide by zero and blank
  // every path with NaN.
  const magnitudes = rows.map((r) => (Number.isFinite(r.value) ? Math.abs(r.value) : 0));
  const domainMax = Math.max(1, ...magnitudes);

  const span = outerRadius - innerRadius;
  // Zero sits *below* the middle of the band, which gives the outward arm the larger
  // share (0.55 of the span against 0.45). Gaining is the direction people scan for,
  // and the outward arm also has more circumference to spend it on. Note the fraction
  // names the inward arm, not the outward one — setting this to 0.55 quietly does the
  // opposite of what it reads like.
  const zeroRadius = mode === 'diverging' ? innerRadius + span * 0.45 : innerRadius;

  // Angle allocation.
  const totalBars = nonEmpty.reduce((acc, g) => acc + byGroup.get(g)!.length, 0);
  const available = Math.max(0.001, TAU - nonEmpty.length * sectorGap);

  let widths = nonEmpty.map((g) =>
    Math.max(minSectorAngle, (available * byGroup.get(g)!.length) / totalBars),
  );
  // The floor can push the total past what is available; renormalise so the ring
  // still closes exactly rather than overlapping its own first sector.
  const widthSum = widths.reduce((a, b) => a + b, 0);
  if (widthSum > available) widths = widths.map((w) => (w * available) / widthSum);

  const sectors: RadialSector[] = [];
  const bars: RadialBar[] = [];

  let angle = 0;

  nonEmpty.forEach((group, gi) => {
    const startAngle = angle + sectorGap / 2;
    const endAngle = startAngle + widths[gi];
    const midAngle = (startAngle + endAngle) / 2;

    // A <textPath> follows its path's direction, so a label sitting on the lower half
    // of the ring renders upside down on a normally-wound arc. Build that arc
    // backwards instead, one ring further out so the two label baselines — which
    // hang off opposite sides of their paths — do not collide at the 3 and 9 o'clock
    // crossovers. With 0 at 12 o'clock, "lower half" is exactly (π/2, 3π/2).
    const lower = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5;
    const labelRadius = outerRadius + (lower ? labelOffset + 11 : labelOffset);
    const labelPath = lower
      ? arcPath(cx, cy, labelRadius, endAngle, startAngle, 0)
      : arcPath(cx, cy, labelRadius, startAngle, endAngle, 1);

    sectors.push({
      group,
      startAngle,
      endAngle,
      midAngle,
      count: byGroup.get(group)!.length,
      labelPath,
      labelRadius,
    });

    const members = [...byGroup.get(group)!].sort(
      (a, b) => b.sortValue - a.sortValue || (a.id < b.id ? -1 : 1),
    );
    const slot = widths[gi] / members.length;
    const barWidth = slot * barPad;

    members.forEach((m, i) => {
      const slotStart = startAngle + i * slot;
      const barStart = slotStart + (slot - barWidth) / 2;
      const barEnd = barStart + barWidth;
      const value = Number.isFinite(m.value) ? m.value : 0;

      let r0: number;
      let r1: number;
      let sign: -1 | 0 | 1;

      if (mode === 'diverging') {
        if (value > 0) {
          sign = 1;
          r0 = zeroRadius;
          r1 = zeroRadius + (outerRadius - zeroRadius) * (value / domainMax);
        } else if (value < 0) {
          sign = -1;
          r1 = zeroRadius;
          r0 = zeroRadius - (zeroRadius - innerRadius) * (Math.abs(value) / domainMax);
        } else {
          // A visible tick rather than nothing: "measured, and unchanged" is a real
          // reading, and an absent bar would be indistinguishable from a missing office.
          sign = 0;
          r0 = zeroRadius - 0.75;
          r1 = zeroRadius + 0.75;
        }
      } else {
        sign = value > 0 ? 1 : 0;
        r0 = innerRadius;
        r1 = innerRadius + span * (Math.max(0, value) / domainMax);
      }

      bars.push({
        id: m.id,
        label: m.label,
        group,
        value,
        startAngle: barStart,
        endAngle: barEnd,
        midAngle: (barStart + barEnd) / 2,
        r0,
        r1,
        sign,
        path: annulusSectorPath(cx, cy, r0, r1, barStart, barEnd),
      });
    });

    angle = endAngle + sectorGap / 2;
  });

  // Value rings.
  //
  // In diverging mode both arms get their own rings, each mapped on its own scale.
  // The two arms are deliberately not the same length (the gaining side has 55% of
  // the band), so a single mirrored set of radii would misreport the inward side by a
  // fifth. Leaving the inward arm unringed is worse still: a bar reaching halfway in
  // would have nothing at all to be read against.
  const outward = outerRadius - zeroRadius;
  const inward = zeroRadius - innerRadius;
  const steps = niceTicks(domainMax, 4);

  const ticks = steps.map((value) => ({
    value,
    radius: zeroRadius + outward * (value / domainMax),
  }));

  if (mode === 'diverging') {
    for (const value of steps) {
      if (value <= 0) continue; // zero is already the baseline circle
      ticks.push({ value: -value, radius: zeroRadius - inward * (value / domainMax) });
    }
  }

  // Tick labels go in the gap that opens the first sector. Every sector is separated
  // by the same `sectorGap`, so there is no "widest" one to hunt for — picking the
  // first keeps the gutter in the same place as the scrubber moves, which is what
  // stops the scale labels hopping around the ring between months.
  const gutterAngle = sectors.length ? sectors[0].startAngle - sectorGap / 2 : 0;

  return {
    bars,
    sectors,
    scale: { mode, domainMax, innerRadius, outerRadius, zeroRadius, ticks, gutterAngle },
    emptyGroups,
  };
}
