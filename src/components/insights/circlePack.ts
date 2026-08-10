/**
 * Deterministic circle packing for the hub circles at the centre of the network chart.
 *
 * Seed-and-relax rather than an analytic construction. The analytic route (place the
 * largest at the centre, solve tangency for the rest) is exact for three circles, ugly
 * for four, and has to be rewritten the moment a fifth hub appears. Relaxation is
 * ~50 lines, count-agnostic, and trivially testable.
 *
 * **No randomness anywhere.** Seeds are angular and derived from the sorted order,
 * ties break on `id`, the sweep count is fixed, and the degenerate "two circles exactly
 * on top of each other" case pushes along a per-index axis rather than a random one.
 * Same input gives bit-identical output, which is what keeps the chart from twitching
 * between renders.
 *
 * Pure: no React, no DOM. Runs under `environment: "node"`.
 */

export interface PackInput {
  id: string;
  value: number;
}

export interface PackedCircle {
  id: string;
  value: number;
  x: number;
  y: number;
  r: number;
}

export interface PackOptions {
  /** Radius of the disc the result must fit inside. */
  radius: number;
  /** Gap between circles, in the same units as `radius`. */
  padding?: number;
  /** Relaxation sweeps. Fixed, not adaptive — adaptive would be input-dependent. */
  iterations?: number;
  /**
   * Floor on a circle's radius as a fraction of the largest, so a zero-value hub is
   * still a visible, hoverable target.
   *
   * This is an honest lie about area, so the caller must print the real value inside
   * the circle. Without the floor a hub with no members vanishes and the legend claims
   * a category that is nowhere on screen.
   */
  minRadiusRatio?: number;
}

export function packCircles(
  items: readonly PackInput[],
  opts: PackOptions,
): PackedCircle[] {
  const radius = Math.max(1, opts.radius);
  const padding = Math.max(0, opts.padding ?? 6);
  const iterations = Math.max(0, opts.iterations ?? 240);
  const minRatio = Math.min(0.9, Math.max(0, opts.minRadiusRatio ?? 0.18));

  const rows = (items ?? []).filter((d) => d && typeof d.id === 'string');
  if (rows.length === 0) return [];

  // Area proportional to value, which is what a circle's size is read as. Using the
  // value directly as the radius would overstate the biggest hub by its square.
  const raw = rows.map((d) => Math.sqrt(Math.max(0, Number.isFinite(d.value) ? d.value : 0)));
  const rMax = Math.max(...raw);
  const radii = rMax > 0 ? raw.map((r) => Math.max(r, minRatio * rMax)) : raw.map(() => 1);

  if (rows.length === 1) {
    return [{ id: rows[0].id, value: rows[0].value, x: 0, y: 0, r: radius }];
  }

  // Seed: largest at the centre, the rest evenly spaced around it starting at 12
  // o'clock. Sorting by radius then id keeps this reproducible under ties.
  const order = rows
    .map((_, i) => i)
    .sort((a, b) => radii[b] - radii[a] || rows[a].id.localeCompare(rows[b].id));

  const xs = new Array<number>(rows.length).fill(0);
  const ys = new Array<number>(rows.length).fill(0);

  const satellites = order.length - 1;
  order.forEach((idx, k) => {
    if (k === 0) {
      xs[idx] = 0;
      ys[idx] = 0;
      return;
    }
    const theta = ((k - 1) / satellites) * Math.PI * 2;
    const d = radii[order[0]] + radii[idx] + padding;
    xs[idx] = d * Math.sin(theta);
    ys[idx] = -d * Math.cos(theta);
  });

  // Relax: separate overlapping pairs, then pull everything gently inward so the
  // cluster stays compact instead of drifting apart over the sweeps.
  for (let sweep = 0; sweep < iterations; sweep++) {
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const dx = xs[j] - xs[i];
        const dy = ys[j] - ys[i];
        const dist = Math.hypot(dx, dy);
        const want = radii[i] + radii[j] + padding;

        if (dist < 1e-9) {
          // Exactly coincident. Push along an axis derived from the index so the
          // resolution is reproducible; a random direction here would make the whole
          // layout non-deterministic.
          const theta = (i / rows.length) * Math.PI * 2;
          const step = want / 2;
          xs[i] -= step * Math.sin(theta);
          ys[i] += step * Math.cos(theta);
          xs[j] += step * Math.sin(theta);
          ys[j] -= step * Math.cos(theta);
          continue;
        }

        if (dist < want) {
          const shift = (want - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          xs[i] -= shift * ux;
          ys[i] -= shift * uy;
          xs[j] += shift * ux;
          ys[j] += shift * uy;
        }
      }
    }

    for (let i = 0; i < rows.length; i++) {
      xs[i] *= 0.98;
      ys[i] *= 0.98;
    }
  }

  // Centre the bounding box on the origin, then scale to fill the disc.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < rows.length; i++) {
    minX = Math.min(minX, xs[i] - radii[i]);
    maxX = Math.max(maxX, xs[i] + radii[i]);
    minY = Math.min(minY, ys[i] - radii[i]);
    maxY = Math.max(maxY, ys[i] + radii[i]);
  }
  const offX = (minX + maxX) / 2;
  const offY = (minY + maxY) / 2;

  let extent = 0;
  for (let i = 0; i < rows.length; i++) {
    extent = Math.max(extent, Math.hypot(xs[i] - offX, ys[i] - offY) + radii[i]);
  }
  // Scale x, y AND r by the same factor. Scaling only the positions would fit the
  // cluster while silently breaking the area encoding the whole chart rests on.
  const scale = extent > 0 ? radius / extent : 1;

  // Returned in input order so React keys stay stable, not in the sorted order the
  // seeding used.
  return rows.map((d, i) => ({
    id: d.id,
    value: d.value,
    x: (xs[i] - offX) * scale,
    y: (ys[i] - offY) * scale,
    r: radii[i] * scale,
  }));
}
