import { describe, it, expect } from 'vitest';
import { layoutOrbit, type OrbitInput } from '../orbitLayout';

const OPTS = { cx: 400, cy: 400, radius: 300, minDotRadius: 3, maxDotRadius: 16 };

const dot = (id: string, bearingDeg: number, distanceMiles: number, value = 10): OrbitInput => ({
  id,
  bearingDeg,
  distanceMiles,
  value,
});

/** Angle back out of a placed dot, in degrees clockwise from north. */
const bearingOf = (d: { x: number; y: number }) =>
  ((Math.atan2(d.x - OPTS.cx, OPTS.cy - d.y) * 180) / Math.PI + 360) % 360;

describe('layoutOrbit — placement', () => {
  it('puts due north at the top and due east at the right', () => {
    const out = layoutOrbit([dot('n', 0, 5), dot('e', 90, 5)], { ...OPTS, iterations: 0 });
    const byId = new Map(out.dots.map((d) => [d.id, d]));

    expect(byId.get('n')!.x).toBeCloseTo(OPTS.cx, 6);
    expect(byId.get('n')!.y).toBeLessThan(OPTS.cy);
    expect(byId.get('e')!.y).toBeCloseTo(OPTS.cy, 6);
    expect(byId.get('e')!.x).toBeGreaterThan(OPTS.cx);
  });

  it('places distance as radius', () => {
    const out = layoutOrbit([dot('near', 0, 2), dot('far', 0, 10)], { ...OPTS, iterations: 0 });
    const byId = new Map(out.dots.map((d) => [d.id, d]));
    const rOf = (id: string) => Math.hypot(byId.get(id)!.x - OPTS.cx, byId.get(id)!.y - OPTS.cy);
    expect(rOf('far')).toBeGreaterThan(rOf('near'));
  });

  it('normalises bearings past a full turn and below zero', () => {
    const out = layoutOrbit([dot('a', 450, 5), dot('b', -270, 5)], { ...OPTS, iterations: 0 });
    for (const d of out.dots) expect(bearingOf(d)).toBeCloseTo(90, 3);
  });

  it('makes dot area proportional to patients', () => {
    const out = layoutOrbit([dot('big', 0, 5, 100), dot('small', 180, 5, 25)], {
      ...OPTS,
      minDotRadius: 0,
      iterations: 0,
    });
    const byId = new Map(out.dots.map((d) => [d.id, d]));
    expect((byId.get('big')!.r / byId.get('small')!.r) ** 2).toBeCloseTo(4, 4);
  });

  it('floors the dot radius so a one-patient office is still a target', () => {
    const out = layoutOrbit([dot('big', 0, 5, 500), dot('tiny', 180, 5, 1)], OPTS);
    expect(out.dots.find((d) => d.id === 'tiny')!.r).toBeGreaterThanOrEqual(3);
  });
});

describe('layoutOrbit — the outer edge', () => {
  it('scales to the 95th percentile so one distant office does not squash the rest', () => {
    const local = Array.from({ length: 40 }, (_, i) => dot(`l${i}`, i * 9, 3 + (i % 5)));
    const out = layoutOrbit([...local, dot('outlier', 45, 900)], { ...OPTS, iterations: 0 });
    expect(out.maxMiles).toBeLessThan(50);
  });

  it('pins a beyond-the-edge office to the rim rather than dropping it', () => {
    const local = Array.from({ length: 40 }, (_, i) => dot(`l${i}`, i * 9, 3));
    const out = layoutOrbit([...local, dot('outlier', 45, 900)], { ...OPTS, iterations: 0 });
    const far = out.dots.find((d) => d.id === 'outlier')!;
    expect(Math.hypot(far.x - OPTS.cx, far.y - OPTS.cy)).toBeCloseTo(OPTS.radius, 6);
    // The true distance survives for the tooltip.
    expect(far.distance).toBe(900);
  });

  it('honours an explicit maxMiles', () => {
    const out = layoutOrbit([dot('a', 0, 5)], { ...OPTS, maxMiles: 100, iterations: 0 });
    expect(out.maxMiles).toBe(100);
    expect(Math.hypot(out.dots[0].x - OPTS.cx, out.dots[0].y - OPTS.cy)).toBeCloseTo(15, 3);
  });

  it('emits ascending distance rings inside the field', () => {
    const out = layoutOrbit(
      Array.from({ length: 20 }, (_, i) => dot(`a${i}`, i * 18, 1 + i)),
      OPTS,
    );
    expect(out.rings.length).toBeGreaterThan(0);
    for (let i = 1; i < out.rings.length; i++) {
      expect(out.rings[i].miles).toBeGreaterThan(out.rings[i - 1].miles);
      expect(out.rings[i].radius).toBeGreaterThan(out.rings[i - 1].radius);
    }
    for (const r of out.rings) expect(r.radius).toBeLessThanOrEqual(OPTS.radius + 1e-6);
  });
});

describe('layoutOrbit — collisions', () => {
  it('separates offices stacked on the same bearing and distance', () => {
    // Real books cluster hard along arterial roads; without relaxation the busiest
    // direction renders as a single dot and reads as the emptiest.
    const stacked = Array.from({ length: 8 }, (_, i) => dot(`s${i}`, 90, 4, 20));
    const out = layoutOrbit(stacked, OPTS);

    for (let i = 0; i < out.dots.length; i++) {
      for (let j = i + 1; j < out.dots.length; j++) {
        const d = Math.hypot(out.dots[j].x - out.dots[i].x, out.dots[j].y - out.dots[i].y);
        expect(d).toBeGreaterThanOrEqual(out.dots[i].r + out.dots[j].r - 1e-6);
      }
    }
    expect(out.dots.every((d) => d.nudged)).toBe(true);
  });

  it('keeps every dot inside the field after relaxation', () => {
    const stacked = Array.from({ length: 30 }, (_, i) => dot(`s${i}`, 90, 28, 40));
    const out = layoutOrbit(stacked, OPTS);
    for (const d of out.dots) {
      expect(Math.hypot(d.x - OPTS.cx, d.y - OPTS.cy)).toBeLessThanOrEqual(OPTS.radius + 1e-6);
    }
  });

  it('leaves well-separated dots untouched', () => {
    const out = layoutOrbit([dot('a', 0, 20), dot('b', 180, 20)], OPTS);
    expect(out.dots.every((d) => !d.nudged)).toBe(true);
  });

  it('is deterministic — no RNG anywhere', () => {
    const stacked = Array.from({ length: 10 }, (_, i) => dot(`s${i}`, 45, 6, 15));
    expect(layoutOrbit(stacked, OPTS)).toEqual(layoutOrbit(stacked, OPTS));
  });
});

describe('layoutOrbit — summaries', () => {
  it('totals patients into eight compass sectors', () => {
    const out = layoutOrbit([dot('n', 0, 5, 10), dot('e', 90, 5, 4), dot('ne', 45, 5, 1)], OPTS);
    expect(out.sectorTotals[0]).toBe(10); // N
    expect(out.sectorTotals[1]).toBe(1); // NE
    expect(out.sectorTotals[2]).toBe(4); // E
    expect(out.sectorTotals.reduce((a, b) => a + b, 0)).toBe(15);
  });

  it('weights the median by patients, not by office count', () => {
    // Nine quiet offices at 20 miles, one busy one at 2. Weighted by patients the
    // median is near, which is the fact the practice acts on.
    const rows = [
      ...Array.from({ length: 9 }, (_, i) => dot(`far${i}`, i * 40, 20, 1)),
      dot('near', 0, 2, 500),
    ];
    expect(layoutOrbit(rows, OPTS).medianMiles).toBe(2);
  });

  it('reports offices with no usable location instead of hiding them', () => {
    const out = layoutOrbit(
      [dot('ok', 0, 5), { id: 'no-geo', bearingDeg: null, distanceMiles: null, value: 9 }],
      OPTS,
    );
    expect(out.dots).toHaveLength(1);
    expect(out.unplaced).toBe(1);
  });
});

describe('layoutOrbit — degenerate input', () => {
  it('returns an empty layout when nothing can be placed', () => {
    const out = layoutOrbit([{ id: 'a', bearingDeg: null, distanceMiles: null, value: 1 }], OPTS);
    expect(out.dots).toEqual([]);
    expect(out.rings).toEqual([]);
    expect(out.medianMiles).toBeNull();
    expect(out.sectorTotals).toEqual(new Array(8).fill(0));
  });

  it('handles no input at all', () => {
    expect(layoutOrbit([], OPTS).dots).toEqual([]);
  });

  it('handles every office at zero distance without dividing by zero', () => {
    const out = layoutOrbit([dot('a', 0, 0), dot('b', 90, 0)], OPTS);
    for (const d of out.dots) {
      expect(Number.isFinite(d.x)).toBe(true);
      expect(Number.isFinite(d.y)).toBe(true);
    }
  });

  it('rejects non-finite and negative geometry', () => {
    const out = layoutOrbit(
      [
        dot('ok', 0, 5),
        { id: 'nan', bearingDeg: NaN, distanceMiles: 5, value: 1 },
        { id: 'neg', bearingDeg: 0, distanceMiles: -5, value: 1 },
      ],
      OPTS,
    );
    expect(out.dots.map((d) => d.id)).toEqual(['ok']);
    expect(out.unplaced).toBe(2);
  });

  it('treats a zero or negative value as zero rather than an imaginary radius', () => {
    const out = layoutOrbit([dot('a', 0, 5, 0), dot('b', 90, 5, -3)], OPTS);
    for (const d of out.dots) expect(d.r).toBeGreaterThanOrEqual(3);
  });

  it('skips malformed rows', () => {
    const out = layoutOrbit([null as never, dot('a', 0, 5)], OPTS);
    expect(out.dots).toHaveLength(1);
  });
});
