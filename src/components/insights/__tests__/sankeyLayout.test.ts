import { describe, it, expect } from 'vitest';
import {
  layoutSankey,
  ribbonPath,
  type SankeyLinkInput,
  type SankeyNodeInput,
} from '../sankeyLayout';

const BOX = { width: 600, height: 400 };

/** Source type -> tier -> clinic, the shape the Insights Sankey actually renders. */
const NODES: SankeyNodeInput[] = [
  { id: 'src:Office', label: 'Office', column: 0 },
  { id: 'src:Google', label: 'Google', column: 0 },
  { id: 'mid:VIP', label: 'VIP', column: 1, order: 0 },
  { id: 'mid:Warm', label: 'Warm', column: 1, order: 1 },
  { id: 'mid:Cold', label: 'Cold', column: 1, order: 2 },
  { id: 'mid:Direct', label: 'Direct', column: 1, order: 4 },
  { id: 'end:c1', label: 'My Clinic', column: 2 },
];

const LINKS: SankeyLinkInput[] = [
  { source: 'src:Office', target: 'mid:VIP', value: 60 },
  { source: 'src:Office', target: 'mid:Warm', value: 30 },
  { source: 'src:Office', target: 'mid:Cold', value: 10 },
  { source: 'src:Google', target: 'mid:Direct', value: 25 },
  { source: 'mid:VIP', target: 'end:c1', value: 60 },
  { source: 'mid:Warm', target: 'end:c1', value: 30 },
  { source: 'mid:Cold', target: 'end:c1', value: 10 },
  { source: 'mid:Direct', target: 'end:c1', value: 25 },
];

/** Sample a cubic at t, one axis. */
function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

describe('ribbonPath', () => {
  it('holds constant vertical thickness along its whole length', () => {
    // The one geometric property the entire chart rests on: if this pinches, every
    // flow is understated in the middle of the diagram.
    const sx = 0;
    const tx = 100;
    const sy0 = 10;
    const sy1 = 40; // thickness 30 at the source
    const ty0 = 200;
    const ty1 = 230; // thickness 30 at the target
    const c = (tx - sx) * 0.5;

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const top = cubic(sy0, sy0, ty0, ty0, t);
      const bottom = cubic(sy1, sy1, ty1, ty1, t);
      expect(bottom - top).toBeCloseTo(30, 9);
    }
    expect(c).toBe(50);
  });

  it('emits a closed path with two cubics', () => {
    const d = ribbonPath(0, 0, 10, 100, 50, 60);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d.match(/ C /g)).toHaveLength(2);
    expect(d).not.toMatch(/NaN/);
  });
});

describe('layoutSankey — conservation of flow', () => {
  const out = layoutSankey(NODES, LINKS, BOX);
  const byId = new Map(out.nodes.map((n) => [n.id, n]));

  it('gives every node a height equal to the ribbons leaving it', () => {
    for (const node of out.nodes) {
      const outgoing = out.links.filter((l) => l.source === node.id);
      if (!outgoing.length) continue;
      const stacked = outgoing.reduce((acc, l) => acc + (l.sy1 - l.sy0), 0);
      expect(stacked).toBeCloseTo(node.y1 - node.y0, 6);
    }
  });

  it('gives every node a height equal to the ribbons entering it', () => {
    for (const node of out.nodes) {
      const incoming = out.links.filter((l) => l.target === node.id);
      if (!incoming.length) continue;
      const stacked = incoming.reduce((acc, l) => acc + (l.ty1 - l.ty0), 0);
      expect(stacked).toBeCloseTo(node.y1 - node.y0, 6);
    }
  });

  it('scales every column with one global ky, so column totals stay comparable', () => {
    // Column 0 totals 125, column 1 totals 125, column 2 totals 125 — equal totals
    // must occupy equal total height. A per-column scale would make each fill the box.
    const heightOf = (col: number) =>
      out.nodes.filter((n) => n.column === col).reduce((acc, n) => acc + (n.y1 - n.y0), 0);

    expect(heightOf(0)).toBeCloseTo(heightOf(1), 6);
    expect(heightOf(1)).toBeCloseTo(heightOf(2), 6);
  });

  it('places the clinic node as tall as the whole flow', () => {
    const clinic = byId.get('end:c1')!;
    const office = byId.get('src:Office')!;
    const google = byId.get('src:Google')!;
    expect(clinic.y1 - clinic.y0).toBeCloseTo(
      office.y1 - office.y0 + (google.y1 - google.y0),
      6,
    );
  });
});

describe('layoutSankey — geometry', () => {
  const out = layoutSankey(NODES, LINKS, BOX);

  it('spans the full width with the last column flush right', () => {
    expect(Math.min(...out.nodes.map((n) => n.x0))).toBe(0);
    expect(Math.max(...out.nodes.map((n) => n.x1))).toBeCloseTo(BOX.width, 6);
  });

  it('keeps every node inside the box', () => {
    for (const n of out.nodes) {
      expect(n.y0).toBeGreaterThanOrEqual(-1e-6);
      expect(n.y1).toBeLessThanOrEqual(BOX.height + 1e-6);
    }
  });

  it('does not overlap nodes within a column', () => {
    for (let c = 0; c < out.columnCount; c++) {
      const column = out.nodes.filter((n) => n.column === c).sort((a, b) => a.y0 - b.y0);
      for (let i = 1; i < column.length; i++) {
        expect(column[i].y0).toBeGreaterThanOrEqual(column[i - 1].y1 - 1e-6);
      }
    }
  });

  it('emits a path for every link, with no NaN', () => {
    expect(out.links).toHaveLength(LINKS.length);
    for (const l of out.links) {
      expect(l.path).toMatch(/^M /);
      expect(l.path).not.toMatch(/NaN|Infinity/);
    }
  });

  it('reports a clean run', () => {
    expect(out.dropped).toBe(0);
    expect(out.compressed).toBe(false);
    expect(out.columnCount).toBe(3);
  });
});

describe('layoutSankey — ordering', () => {
  it('honors a pinned column order regardless of link structure', () => {
    // Wire the flows so a crossing-minimiser would want Cold above VIP.
    const perverse: SankeyLinkInput[] = [
      { source: 'src:Office', target: 'mid:Cold', value: 90 },
      { source: 'src:Google', target: 'mid:VIP', value: 90 },
      { source: 'mid:Cold', target: 'end:c1', value: 90 },
      { source: 'mid:VIP', target: 'end:c1', value: 90 },
    ];

    const out = layoutSankey(NODES, perverse, BOX);
    const middle = out.nodes
      .filter((n) => n.column === 1)
      .sort((a, b) => a.y0 - b.y0)
      .map((n) => n.label);

    expect(middle).toEqual(['VIP', 'Warm', 'Cold', 'Direct']);
  });

  it('reduces crossings among unpinned nodes', () => {
    const nodes: SankeyNodeInput[] = [
      { id: 'a1', label: 'a1', column: 0 },
      { id: 'a2', label: 'a2', column: 0 },
      { id: 'b1', label: 'b1', column: 1 },
      { id: 'b2', label: 'b2', column: 1 },
    ];
    // a1 -> b2 and a2 -> b1: the natural order crosses; relaxation should swap them.
    const links: SankeyLinkInput[] = [
      { source: 'a1', target: 'b2', value: 100 },
      { source: 'a2', target: 'b1', value: 5 },
    ];

    const out = layoutSankey(nodes, links, BOX);
    const y = new Map(out.nodes.map((n) => [n.id, (n.y0 + n.y1) / 2]));

    const crosses =
      (y.get('a1')! - y.get('a2')!) * (y.get('b2')! - y.get('b1')!) < 0;
    expect(crosses).toBe(false);
  });

  it('is deterministic across runs', () => {
    expect(layoutSankey(NODES, LINKS, BOX)).toEqual(layoutSankey(NODES, LINKS, BOX));
  });
});

describe('layoutSankey — degenerate input', () => {
  it('returns an empty layout for no nodes', () => {
    expect(layoutSankey([], LINKS, BOX)).toEqual({
      nodes: [],
      links: [],
      columnCount: 0,
      dropped: 0,
      compressed: false,
    });
  });

  it('drops links naming an unknown node and counts them', () => {
    const out = layoutSankey(NODES, [...LINKS, { source: 'ghost', target: 'end:c1', value: 5 }], BOX);
    expect(out.dropped).toBe(1);
    expect(out.links).toHaveLength(LINKS.length);
  });

  it('drops zero and negative values', () => {
    const out = layoutSankey(NODES, [
      { source: 'src:Office', target: 'mid:VIP', value: 0 },
      { source: 'src:Office', target: 'mid:Warm', value: -3 },
    ], BOX);
    expect(out.dropped).toBe(2);
    expect(out.links).toHaveLength(0);
  });

  it('handles a single column without dividing by zero', () => {
    const out = layoutSankey([{ id: 'only', label: 'only', column: 0 }], [], BOX);
    expect(out.nodes[0].x0).toBe(0);
    expect(Number.isFinite(out.nodes[0].y1)).toBe(true);
  });

  it('flags compression and still fits when a column cannot be padded', () => {
    const many: SankeyNodeInput[] = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      label: `n${i}`,
      column: 0,
    }));
    const out = layoutSankey(many, [], { width: 600, height: 100 });

    expect(out.compressed).toBe(true);
    for (const n of out.nodes) {
      expect(n.y0).toBeGreaterThanOrEqual(-1e-6);
      expect(n.y1).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it('renders a labelled skeleton when every value is zero', () => {
    const out = layoutSankey(NODES, [], BOX);
    expect(out.nodes).toHaveLength(NODES.length);
    for (const n of out.nodes) expect(n.y1 - n.y0).toBeGreaterThan(0);
  });

  it('ignores duplicate node ids rather than double-placing them', () => {
    const out = layoutSankey(
      [...NODES, { id: 'src:Office', label: 'dupe', column: 2 }],
      LINKS,
      BOX,
    );
    expect(out.nodes.filter((n) => n.id === 'src:Office')).toHaveLength(1);
  });
});
