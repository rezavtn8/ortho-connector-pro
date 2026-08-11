/**
 * The Orbit view: every referring office placed by its true compass bearing and
 * distance from the practice, on a clean polar field.
 *
 * The Mapbox map plots the same offices on real geography, and that is exactly why it
 * cannot answer this question. On a street map every dot is pinned to the address it
 * happens to occupy, and the *shape* of the catchment — whether referrals arrive evenly
 * from all sides or pile along one corridor, whether the far ones are the strong ones —
 * is buried under roads, labels and coastline. Stripping the geography and keeping only
 * (bearing, distance) makes that shape the only thing left to look at.
 *
 * Pure: no React, no DOM, no colors. Runs under `environment: "node"`.
 */

export interface OrbitInput {
  id: string;
  /** Degrees clockwise from true north. */
  bearingDeg: number | null;
  distanceMiles: number | null;
  /** Drives the dot area. */
  value: number;
}

export interface OrbitDot {
  id: string;
  /** Radians, 0 at 12 o'clock, clockwise — the same convention as `svgPolar`. */
  angle: number;
  distance: number;
  value: number;
  x: number;
  y: number;
  r: number;
  /** True when collision relaxation moved the dot off its exact position. */
  nudged: boolean;
}

export interface OrbitRing {
  miles: number;
  radius: number;
}

export interface OrbitLayout {
  dots: OrbitDot[];
  rings: OrbitRing[];
  /** Miles at the outer edge. */
  maxMiles: number;
  /** Patients per compass sector, in `N, NE, E, …` order. */
  sectorTotals: number[];
  /** Offices dropped for having no usable location. */
  unplaced: number;
  /** Patient-weighted median distance, or null when nothing is placed. */
  medianMiles: number | null;
}

export interface OrbitOptions {
  cx: number;
  cy: number;
  /** Radius of the outermost ring. */
  radius: number;
  /** Smallest dot radius, so a one-patient office is still clickable. */
  minDotRadius?: number;
  maxDotRadius?: number;
  /** Collision relaxation sweeps. Fixed count, no RNG. */
  iterations?: number;
  /** Force the outer edge to this many miles instead of deriving it. */
  maxMiles?: number;
}

/** 1 / 2 / 5 x 10^k ring distances covering `max`, never more than four. */
function ringMiles(max: number): number[] {
  if (!(max > 0)) return [];
  const rough = max / 3;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / magnitude;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * magnitude;

  const out: number[] = [];
  for (let v = step, i = 0; v <= max * 1.0001 && i < 8; v += step, i++) out.push(v);
  if (!out.length) out.push(max);
  return out;
}

export function layoutOrbit(inputs: readonly OrbitInput[], opts: OrbitOptions): OrbitLayout {
  const { cx, cy } = opts;
  const radius = Math.max(1, opts.radius);
  const minR = opts.minDotRadius ?? 3;
  const maxR = Math.max(minR, opts.maxDotRadius ?? 16);
  const iterations = Math.max(0, opts.iterations ?? 90);

  const rows = (inputs ?? []).filter((d) => d && typeof d.id === 'string');

  const placeable = rows.filter(
    (d) =>
      typeof d.bearingDeg === 'number' &&
      Number.isFinite(d.bearingDeg) &&
      typeof d.distanceMiles === 'number' &&
      Number.isFinite(d.distanceMiles) &&
      d.distanceMiles >= 0,
  );
  const unplaced = rows.length - placeable.length;

  const sectorTotals = new Array<number>(8).fill(0);

  if (placeable.length === 0) {
    return { dots: [], rings: [], maxMiles: 0, sectorTotals, unplaced, medianMiles: null };
  }

  // Outer edge. Derived from the 95th percentile rather than the maximum so one
  // out-of-state referrer does not squash the entire local network into the middle
  // few pixels — the far office still plots, pinned to the rim, and the caption says so.
  const sortedDistances = placeable.map((d) => d.distanceMiles as number).sort((a, b) => a - b);
  const p95 = sortedDistances[Math.min(sortedDistances.length - 1, Math.floor(sortedDistances.length * 0.95))];
  const maxMiles = Math.max(0.5, opts.maxMiles ?? p95);

  const maxValue = Math.max(1, ...placeable.map((d) => (d.value > 0 ? d.value : 0)));

  const dots: OrbitDot[] = placeable.map((d) => {
    const angle = ((((d.bearingDeg as number) % 360) + 360) % 360) * (Math.PI / 180);
    const distance = d.distanceMiles as number;
    // Clamped, not dropped: an office beyond the outer ring sits on the rim rather
    // than vanishing, and `distance` keeps the true value for the tooltip.
    const rr = Math.min(1, distance / maxMiles) * radius;
    const value = d.value > 0 ? d.value : 0;

    // Area proportional to patients, floored so a one-patient office is still a target.
    const dotR = minR + (maxR - minR) * Math.sqrt(value / maxValue);

    sectorTotals[Math.round((((d.bearingDeg as number) % 360) + 360) % 360 / 45) % 8] += value;

    return {
      id: d.id,
      angle,
      distance,
      value,
      x: cx + rr * Math.sin(angle),
      y: cy - rr * Math.cos(angle),
      r: dotR,
      nudged: false,
    };
  });

  // Beeswarm relaxation. Offices cluster hard along arterial roads, so without this a
  // dozen dots land on top of each other and the busiest direction reads as the
  // emptiest. Deterministic: ordered sweeps, ties broken by id, no RNG anywhere.
  const order = dots
    .map((_, i) => i)
    .sort((a, b) => dots[b].r - dots[a].r || (dots[a].id < dots[b].id ? -1 : 1));

  /**
   * Pull anything past the rim back along its own radial, preserving the bearing —
   * the axis that carries the meaning here.
   */
  const contain = () => {
    for (const dot of dots) {
      const dx = dot.x - cx;
      const dy = dot.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius && dist > 1e-9) {
        dot.x = cx + (dx / dist) * radius;
        dot.y = cy + (dy / dist) * radius;
      }
    }
  };

  for (let sweep = 0; sweep < iterations; sweep++) {
    let moved = false;
    for (let oi = 0; oi < order.length; oi++) {
      for (let oj = oi + 1; oj < order.length; oj++) {
        const a = dots[order[oi]];
        const b = dots[order[oj]];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const want = a.r + b.r + 1.5;
        if (dist >= want) continue;

        moved = true;
        if (dist < 1e-9) {
          // Exactly coincident: separate along an axis derived from the index so the
          // result is reproducible rather than random.
          const t = (oi / Math.max(1, order.length)) * Math.PI * 2;
          a.x -= Math.sin(t) * want * 0.5;
          a.y += Math.cos(t) * want * 0.5;
          b.x += Math.sin(t) * want * 0.5;
          b.y -= Math.cos(t) * want * 0.5;
        } else {
          const shift = (want - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= shift * ux;
          a.y -= shift * uy;
          b.x += shift * ux;
          b.y += shift * uy;
        }
        a.nudged = true;
        b.nudged = true;
      }
    }

    // Contain *inside* the loop, not once at the end. Running it afterwards undoes the
    // separation the sweeps just achieved — dots pushed past the rim get slammed back
    // on top of their neighbours, and the cluster the relaxation existed to untangle
    // reappears in the outer ring where it is most visible.
    contain();
    if (!moved) break;
  }
  contain();

  // Patient-weighted, so it answers "half our patients come from within N miles"
  // rather than "half our offices are within N miles" — the practice cares about the
  // former, and one busy neighbour outweighs ten quiet distant ones.
  const weighted = placeable
    .filter((d) => d.value > 0)
    .map((d) => ({ miles: d.distanceMiles as number, value: d.value }))
    .sort((a, b) => a.miles - b.miles);
  const totalValue = weighted.reduce((acc, w) => acc + w.value, 0);
  let medianMiles: number | null = null;
  if (totalValue > 0) {
    let acc = 0;
    for (const w of weighted) {
      acc += w.value;
      if (acc >= totalValue / 2) {
        medianMiles = w.miles;
        break;
      }
    }
  }

  return {
    dots,
    rings: ringMiles(maxMiles).map((miles) => ({
      miles,
      radius: (Math.min(1, miles / maxMiles) * radius),
    })),
    maxMiles,
    sectorTotals,
    unplaced,
    medianMiles,
  };
}
