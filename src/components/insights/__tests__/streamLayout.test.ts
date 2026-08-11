import { describe, it, expect } from 'vitest';
import { layoutStream, nearestIndex, type StreamSeriesInput } from '../streamLayout';

const BOX = { width: 600, height: 300 };

const SERIES: StreamSeriesInput[] = [
  { key: 'vip', label: 'VIP', values: [10, 20, 30, 40] },
  { key: 'warm', label: 'Warm', values: [5, 5, 5, 5] },
  { key: 'cold', label: 'Cold', values: [0, 0, 10, 0] },
];

describe('layoutStream', () => {
  const out = layoutStream(SERIES, 4, BOX);

  it('stacks to a zero baseline, so the top edge is the monthly total', () => {
    // A wiggle-centred streamgraph looks better and destroys this property, which is
    // the most-checked number in the app.
    const bottom = out.bands[0].points.map((p) => p.y0);
    expect(bottom.every((y) => Math.abs(y - BOX.height) < 1e-9)).toBe(true);
  });

  it('keeps bands contiguous — each starts where the one below ended', () => {
    for (let i = 1; i < out.bands.length; i++) {
      for (let x = 0; x < 4; x++) {
        expect(out.bands[i].points[x].y0).toBeCloseTo(out.bands[i - 1].points[x].y1, 9);
      }
    }
  });

  it('scales the tallest stack to the full height', () => {
    const tallest = Math.max(...out.totals);
    const idx = out.totals.indexOf(tallest);
    const top = out.bands[out.bands.length - 1].points[idx].y1;
    expect(top).toBeCloseTo(0, 9);
  });

  it('reports the stack totals and the domain', () => {
    expect(out.totals).toEqual([15, 25, 45, 45]);
    expect(out.max).toBe(45);
  });

  it('spreads x evenly across the width', () => {
    expect(out.xs[0]).toBe(0);
    expect(out.xs[3]).toBe(BOX.width);
    expect(out.xs[1]).toBeCloseTo(200, 9);
  });

  it('preserves the caller’s band order', () => {
    // The order is meaningful (VIP at the bottom), so the layout must not sort it —
    // bands swapping places as data shifts would make the view unreadable over time.
    expect(out.bands.map((b) => b.key)).toEqual(['vip', 'warm', 'cold']);
  });

  it('totals each band', () => {
    expect(out.bands[0].total).toBe(100);
    expect(out.bands[2].total).toBe(10);
    expect(out.bands[2].peak).toBe(10);
  });

  it('emits closed fills and an open top edge', () => {
    for (const b of out.bands) {
      expect(b.path.startsWith('M ')).toBe(true);
      expect(b.path.endsWith(' Z')).toBe(true);
      expect(b.topPath.startsWith('M ')).toBe(true);
      expect(b.topPath).not.toContain('Z');
      expect(b.path).not.toMatch(/NaN|Infinity/);
    }
    expect(out.outlinePath).not.toMatch(/NaN|Infinity/);
  });

  it('only moves control points horizontally, so a curve cannot overshoot', () => {
    // Every cubic here is `C ax+d ay, bx-d by, bx by`: control-1 sits at the start
    // point's y and control-2 at the end point's y. Because both controls stay inside
    // the endpoints' y range, the curve cannot leave it. A natural cubic or
    // Catmull-Rom would overshoot at a sharp drop and paint the band below zero —
    // patients the practice never had.
    // Walk the open top edge: `M` then nothing but cubics, so the current point is
    // unambiguous. (The closed fill splices the reversed bottom edge on with an `L`.)
    for (const path of [...out.bands.map((b) => b.topPath), out.outlinePath]) {
      const start = path.match(/^M ([-\d.]+) ([-\d.]+)/);
      expect(start).not.toBeNull();

      let currentY = Number(start![2]);
      const cubic = /C ([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+)/g;
      let seen = 0;

      for (let m = cubic.exec(path); m; m = cubic.exec(path)) {
        const c1y = Number(m[2]);
        const c2y = Number(m[4]);
        const endY = Number(m[6]);
        expect(c1y).toBeCloseTo(currentY, 9);
        expect(c2y).toBeCloseTo(endY, 9);
        currentY = endY;
        seen++;
      }
      expect(seen).toBeGreaterThan(0);
    }
  });

  it('never lets a band leave the plot box', () => {
    for (const b of out.bands) {
      for (const p of b.points) {
        expect(p.y1).toBeGreaterThanOrEqual(-1e-6);
        expect(p.y0).toBeLessThanOrEqual(BOX.height + 1e-6);
        expect(p.y1).toBeLessThanOrEqual(p.y0 + 1e-6);
      }
    }
  });

  it('is deterministic', () => {
    expect(layoutStream(SERIES, 4, BOX)).toEqual(layoutStream(SERIES, 4, BOX));
  });
});

describe('layoutStream — degenerate input', () => {
  it('returns an empty layout for no series or no axis', () => {
    const empty = { bands: [], xs: [], totals: [], max: 0, outlinePath: '' };
    expect(layoutStream([], 4, BOX)).toEqual(empty);
    expect(layoutStream(SERIES, 0, BOX)).toEqual(empty);
  });

  it('centres a single axis position instead of dividing by zero', () => {
    const out = layoutStream(SERIES, 1, BOX);
    expect(out.xs).toEqual([BOX.width / 2]);
    expect(out.bands[0].path).not.toMatch(/NaN/);
  });

  it('does not divide by zero when every value is zero', () => {
    const out = layoutStream([{ key: 'a', label: 'a', values: [0, 0, 0] }], 3, BOX);
    expect(out.max).toBe(1);
    expect(out.bands[0].path).not.toMatch(/NaN/);
    for (const p of out.bands[0].points) expect(p.y1).toBeCloseTo(BOX.height, 9);
  });

  it('reads missing, negative and non-finite values as zero', () => {
    const out = layoutStream(
      [{ key: 'a', label: 'a', values: [5, -3, NaN as number] }, { key: 'b', label: 'b', values: [1] }],
      3,
      BOX,
    );
    expect(out.totals).toEqual([6, 0, 0]);
  });

  it('handles straight segments when curvature is zero', () => {
    const out = layoutStream(SERIES, 4, { ...BOX, curvature: 0 });
    expect(out.bands[0].path).not.toContain('C ');
    expect(out.bands[0].path).toContain('L ');
  });

  it('clamps a silly curvature rather than producing loops', () => {
    for (const curvature of [-5, 12, NaN]) {
      const out = layoutStream(SERIES, 4, { ...BOX, curvature });
      expect(out.bands[0].path).not.toMatch(/NaN/);
    }
  });

  it('skips malformed series', () => {
    const out = layoutStream([null as never, { key: 'a', label: 'a', values: [1] }], 1, BOX);
    expect(out.bands).toHaveLength(1);
  });
});

describe('nearestIndex', () => {
  it('finds the closest axis position', () => {
    expect(nearestIndex([0, 100, 200], 90)).toBe(1);
    expect(nearestIndex([0, 100, 200], 149)).toBe(1);
    expect(nearestIndex([0, 100, 200], 151)).toBe(2);
  });

  it('clamps outside the range', () => {
    expect(nearestIndex([0, 100, 200], -50)).toBe(0);
    expect(nearestIndex([0, 100, 200], 9999)).toBe(2);
  });

  it('returns -1 for an empty axis', () => {
    expect(nearestIndex([], 5)).toBe(-1);
  });
});
