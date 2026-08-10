/**
 * A layered Sankey layout, hand-rolled.
 *
 * `d3-sankey` would do this, but the graph here is a strict layered DAG with fixed
 * column assignment and fewer than forty nodes — the one genuinely hard part of the
 * general algorithm (inferring layers from an arbitrary graph) does not apply. What is
 * left is barycenter ordering and stacking, which is ~150 lines and, written here,
 * stays dependency-free and unit-testable under `environment: "node"`. Same reasoning
 * `arcGeometry.ts` records for inlining its projection.
 *
 * Pure: no React, no DOM, no colors.
 */

export interface SankeyNodeInput {
  id: string;
  label: string;
  /** Zero-based column. Assigned by the caller, never inferred. */
  column: number;
  /**
   * Fixes this node's position within its column, lowest first.
   *
   * Used for the tier column: VIP/Warm/Cold/Dormant have an inherent rank and are
   * rendered in it on every other screen in the app. Letting a crossing-minimiser
   * shuffle them to VIP/Cold/Direct/Warm would be both unreadable and inconsistent
   * with the Offices table sitting one tab away.
   */
  order?: number;
}

export interface SankeyLinkInput {
  source: string;
  target: string;
  value: number;
}

export interface SankeyNode extends SankeyNodeInput {
  value: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface SankeyLink extends SankeyLinkInput {
  sy0: number;
  sy1: number;
  ty0: number;
  ty1: number;
  path: string;
}

export interface SankeyLayout {
  nodes: SankeyNode[];
  links: SankeyLink[];
  columnCount: number;
  /** Links dropped for naming an unknown node or carrying a non-positive value. */
  dropped: number;
  /**
   * True when node padding had to be shrunk to fit the height.
   *
   * Surfaced rather than swallowed: silently squeezing is how a Sankey ends up with
   * nodes touching and no indication that the view is over capacity.
   */
  compressed: boolean;
}

export interface SankeyOptions {
  width: number;
  height: number;
  nodeWidth?: number;
  nodePadding?: number;
  /** Barycenter sweeps. Six is ample at this graph size. */
  iterations?: number;
  curvature?: number;
}

const EMPTY: SankeyLayout = { nodes: [], links: [], columnCount: 0, dropped: 0, compressed: false };

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * A constant-thickness ribbon between two vertical spans.
 *
 * The two boundary cubics are exact vertical translates of one another: every control
 * point differs only in y, by `sy1 - sy0` at the source end and `ty1 - ty0` at the
 * target end. That is what makes vertical thickness constant along the whole ribbon,
 * which is what "constant width" actually has to mean in a Sankey — and it is directly
 * testable by sampling both curves at the same `t`.
 *
 * A symmetric control layout (both curves bending toward a shared midline) looks
 * similar at a glance and pinches in the middle, quietly understating flows.
 */
export function ribbonPath(
  sx: number,
  sy0: number,
  sy1: number,
  tx: number,
  ty0: number,
  ty1: number,
  curvature = 0.5,
): string {
  const c = (tx - sx) * curvature;
  return (
    `M ${r3(sx)} ${r3(sy0)}` +
    ` C ${r3(sx + c)} ${r3(sy0)}, ${r3(tx - c)} ${r3(ty0)}, ${r3(tx)} ${r3(ty0)}` +
    ` L ${r3(tx)} ${r3(ty1)}` +
    ` C ${r3(tx - c)} ${r3(ty1)}, ${r3(sx + c)} ${r3(sy1)}, ${r3(sx)} ${r3(sy1)}` +
    ' Z'
  );
}

/**
 * Push overlapping nodes apart, then back inside the box. Stable, no RNG.
 *
 * `order` outranks position, so a pinned column stays in its declared sequence even if
 * a relaxation sweep would have interleaved a free neighbour between two pinned nodes.
 */
function resolveCollisions(column: SankeyNode[], height: number, padding: number): void {
  column.sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.y0 - b.y0 || (a.id < b.id ? -1 : 1);
  });

  let y = 0;
  for (const node of column) {
    const shift = y - node.y0;
    if (shift > 0) {
      node.y0 += shift;
      node.y1 += shift;
    }
    y = node.y1 + padding;
  }

  // Now push back up from the bottom, so a column that overflowed is pinned to the
  // box rather than running off the canvas.
  y = height;
  for (let i = column.length - 1; i >= 0; i--) {
    const node = column[i];
    const shift = node.y1 - y;
    if (shift > 0) {
      node.y0 -= shift;
      node.y1 -= shift;
    }
    y = node.y0 - padding;
  }
}

export function layoutSankey(
  nodeInputs: readonly SankeyNodeInput[],
  linkInputs: readonly SankeyLinkInput[],
  opts: SankeyOptions,
): SankeyLayout {
  const width = Math.max(1, opts.width);
  const height = Math.max(1, opts.height);
  const nodeWidth = Math.max(1, opts.nodeWidth ?? 14);
  const iterations = Math.max(0, opts.iterations ?? 6);
  const curvature = opts.curvature ?? 0.5;

  if (!nodeInputs?.length) return { ...EMPTY };

  const byId = new Map<string, SankeyNode>();
  for (const n of nodeInputs) {
    if (!n?.id || byId.has(n.id)) continue;
    byId.set(n.id, {
      ...n,
      column: Math.max(0, Math.trunc(n.column) || 0),
      value: 0,
      x0: 0,
      x1: 0,
      y0: 0,
      y1: 0,
    });
  }
  if (byId.size === 0) return { ...EMPTY };

  // Drop rather than throw. A link naming a node that no longer exists is a data
  // problem, not a render problem, and blanking the whole chart over one bad row
  // hides the other thirty-nine that were fine. The count is reported instead.
  let dropped = 0;
  const links: SankeyLink[] = [];
  for (const l of linkInputs ?? []) {
    if (!l || !byId.has(l.source) || !byId.has(l.target) || !(l.value > 0)) {
      dropped++;
      continue;
    }
    links.push({ ...l, sy0: 0, sy1: 0, ty0: 0, ty1: 0, path: '' });
  }

  const outgoing = new Map<string, SankeyLink[]>();
  const incoming = new Map<string, SankeyLink[]>();
  const bucket = (table: Map<string, SankeyLink[]>, key: string): SankeyLink[] => {
    let rows = table.get(key);
    if (!rows) {
      rows = [];
      table.set(key, rows);
    }
    return rows;
  };
  for (const l of links) {
    bucket(outgoing, l.source).push(l);
    bucket(incoming, l.target).push(l);
  }

  const sum = (rows: SankeyLink[] | undefined) =>
    (rows ?? []).reduce((acc, l) => acc + l.value, 0);

  // d3-sankey's rule. It should balance here — every patient goes source, middle,
  // end — but a dropped link must not produce a node shorter than the ribbons
  // leaving it, which would stack them past its own edge into negative offsets.
  for (const node of byId.values()) {
    node.value = Math.max(sum(outgoing.get(node.id)), sum(incoming.get(node.id)));
  }

  const columnCount = Math.max(...[...byId.values()].map((n) => n.column)) + 1;
  const columns: SankeyNode[][] = Array.from({ length: columnCount }, () => []);
  for (const node of byId.values()) columns[node.column].push(node);

  // Horizontal placement: evenly spaced columns, last one flush to the right edge.
  const gap = columnCount > 1 ? (width - nodeWidth) / (columnCount - 1) : 0;
  for (const node of byId.values()) {
    node.x0 = node.column * gap;
    node.x1 = node.x0 + nodeWidth;
  }

  // One vertical scale across every column, never one per column. A per-column scale
  // makes the middle column fill the canvas no matter what it totals, which destroys
  // conservation of flow — the single thing a Sankey is for.
  let padding = Math.max(0, opts.nodePadding ?? 12);
  let compressed = false;

  const maxCount = Math.max(...columns.map((c) => c.length), 1);
  if ((maxCount - 1) * padding >= height) {
    padding = Math.max(0, height / (2 * maxCount));
    compressed = true;
  }

  let ky = Infinity;
  for (const column of columns) {
    if (!column.length) continue;
    const total = column.reduce((acc, n) => acc + n.value, 0);
    const usable = height - (column.length - 1) * padding;
    if (total > 0 && usable > 0) ky = Math.min(ky, usable / total);
  }
  if (!Number.isFinite(ky) || ky <= 0) {
    // Every node is zero-valued (an empty window). Give each a hairline so the
    // skeleton of the diagram is still visible and labelled.
    ky = 0;
    compressed = compressed || links.length > 0;
  }

  const MIN_NODE = 1;
  const MIN_LINK = 0.75;

  for (const column of columns) {
    if (!column.length) continue;

    const ordered = [...column].sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      if (b.value !== a.value) return b.value - a.value;
      return a.id < b.id ? -1 : 1;
    });

    // The minimum node height keeps a zero-value node clickable, but enough of them
    // will overflow the box on their own — sixty 1-unit nodes do not fit in 100 units
    // however the padding is set. Fit the column explicitly rather than leaving
    // `resolveCollisions` to push the overflow off the top edge, which is what it does
    // when asked to contain something that genuinely cannot fit.
    const heights = ordered.map((n) => Math.max(MIN_NODE, n.value * ky));
    let pad = padding;
    let stack = heights.reduce((a, b) => a + b, 0) + (ordered.length - 1) * pad;

    // The epsilon is load-bearing. `ky` is chosen so the tightest column fills the
    // height exactly, and that column's stack then lands a few ulps over `height` —
    // a bare `>` reports every healthy diagram as compressed and prints a warning
    // about crowding on a chart with five nodes in it.
    const FITS = height + 1e-6;

    if (stack > FITS) {
      pad = 0;
      stack = heights.reduce((a, b) => a + b, 0);
      compressed = true;
    }
    if (stack > FITS) {
      const shrink = height / stack;
      for (let i = 0; i < heights.length; i++) heights[i] *= shrink;
      compressed = true;
    }

    let y = 0;
    ordered.forEach((node, i) => {
      node.y0 = y;
      node.y1 = y + heights[i];
      y = node.y1 + pad;
    });
    resolveCollisions(column, height, pad);
  }

  // Barycenter sweeps. Nodes with an explicit `order` are pinned — the sweep may not
  // reorder the tier column, only the free ones around it.
  const center = (n: SankeyNode) => (n.y0 + n.y1) / 2;

  const relax = (column: SankeyNode[], side: 'incoming' | 'outgoing') => {
    const table = side === 'incoming' ? incoming : outgoing;
    for (const node of column) {
      if (node.order !== undefined) continue;
      const rows = table.get(node.id) ?? [];
      let weight = 0;
      let acc = 0;
      for (const l of rows) {
        const partner = byId.get(side === 'incoming' ? l.source : l.target);
        if (!partner) continue;
        acc += center(partner) * l.value;
        weight += l.value;
      }
      if (weight > 0) {
        const target = acc / weight;
        const h = node.y1 - node.y0;
        node.y0 = target - h / 2;
        node.y1 = node.y0 + h;
      }
    }
    resolveCollisions(column, height, padding);
  };

  for (let i = 0; i < iterations; i++) {
    for (let c = 1; c < columnCount; c++) relax(columns[c], 'incoming');
    for (let c = columnCount - 2; c >= 0; c--) relax(columns[c], 'outgoing');
  }

  // Stack the ribbons at both ends, each sorted by where its partner sits. Skipping
  // this is exactly why hand-rolled Sankeys look like spaghetti: the bands leave the
  // node in arbitrary order and cross each other before they have gone anywhere.
  for (const node of byId.values()) {
    const out = (outgoing.get(node.id) ?? []).slice().sort((a, b) => {
      const at = byId.get(a.target)!;
      const bt = byId.get(b.target)!;
      return at.y0 - bt.y0 || (a.target < b.target ? -1 : 1);
    });
    let y = node.y0;
    for (const l of out) {
      const h = Math.max(MIN_LINK, l.value * ky);
      l.sy0 = y;
      l.sy1 = y + h;
      y += h;
    }

    const inc = (incoming.get(node.id) ?? []).slice().sort((a, b) => {
      const as = byId.get(a.source)!;
      const bs = byId.get(b.source)!;
      return as.y0 - bs.y0 || (a.source < b.source ? -1 : 1);
    });
    y = node.y0;
    for (const l of inc) {
      const h = Math.max(MIN_LINK, l.value * ky);
      l.ty0 = y;
      l.ty1 = y + h;
      y += h;
    }
  }

  for (const l of links) {
    const s = byId.get(l.source)!;
    const t = byId.get(l.target)!;
    l.path = ribbonPath(s.x1, l.sy0, l.sy1, t.x0, l.ty0, l.ty1, curvature);
  }

  return {
    nodes: [...byId.values()],
    links,
    columnCount,
    dropped,
    compressed,
  };
}
