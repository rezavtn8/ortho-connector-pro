import { describe, it, expect } from 'vitest';
import { bundlePath, labelPolicy, layoutRing, ringLabelPlacement, type RingLeafInput } from '../ringLayout';
import { TAU } from '../svgPolar';

const TIERS = ['VIP', 'Warm', 'Cold', 'Dormant'] as const;

const OPTS = {
  cx: 500,
  cy: 500,
  radius: 330,
  groupOrder: TIERS,
  groupGap: 0.06,
};

const leaf = (id: string, group: string, value: number): RingLeafInput => ({
  id,
  label: id,
  group,
  value,
});

const SPREAD: RingLeafInput[] = TIERS.flatMap((tier, t) =>
  [0, 1, 2].map((i) => leaf(`${tier}-${i}`, tier, (4 - t) * 10 - i)),
);

describe('layoutRing', () => {
  const out = layoutRing(SPREAD, OPTS);

  it('places every leaf, in strictly increasing angle', () => {
    expect(out.leaves).toHaveLength(SPREAD.length);
    for (let i = 1; i < out.leaves.length; i++) {
      expect(out.leaves[i].angle).toBeGreaterThan(out.leaves[i - 1].angle);
    }
  });

  it('closes the ring: group arcs plus gaps make a full turn', () => {
    const arcs = out.groups.reduce((acc, g) => acc + (g.endAngle - g.startAngle), 0);
    expect(arcs + out.groups.length * OPTS.groupGap).toBeCloseTo(TAU, 9);
  });

  it('lays groups out in the declared order', () => {
    expect(out.groups.map((g) => g.group)).toEqual([...TIERS]);
  });

  it('puts leaf anchors on the ring radius', () => {
    for (const l of out.leaves) {
      expect(Math.hypot(l.x - OPTS.cx, l.y - OPTS.cy)).toBeCloseTo(OPTS.radius, 6);
    }
  });

  it('sorts within a group by value descending, ties by id', () => {
    const vip = out.leaves.filter((l) => l.group === 'VIP');
    expect(vip.map((l) => l.value)).toEqual([40, 39, 38]);
  });

  it('starts at 12 o’clock by default', () => {
    expect(out.groups[0].startAngle).toBeCloseTo(OPTS.groupGap / 2, 9);
  });

  it('reports empty groups and gives them neither an arc nor a gap', () => {
    // Four gaps for two present groups would leave visible notches with nothing
    // beside them, which reads as missing data rather than an absent category.
    const partial = layoutRing(
      [leaf('a', 'VIP', 5), leaf('b', 'Cold', 3)],
      OPTS,
    );
    expect(partial.emptyGroups).toEqual(['Warm', 'Dormant']);
    expect(partial.groups.map((g) => g.group)).toEqual(['VIP', 'Cold']);

    const arcs = partial.groups.reduce((acc, g) => acc + (g.endAngle - g.startAngle), 0);
    expect(arcs + 2 * OPTS.groupGap).toBeCloseTo(TAU, 9);
  });

  it('appends an unlisted group rather than dropping its leaves', () => {
    const out2 = layoutRing([leaf('a', 'VIP', 5), leaf('x', 'Mystery', 3)], OPTS);
    expect(out2.groups.map((g) => g.group)).toEqual(['VIP', 'Mystery']);
    expect(out2.leaves).toHaveLength(2);
  });

  it('handles zero and one leaf without dividing by zero', () => {
    expect(layoutRing([], OPTS).leaves).toEqual([]);
    const one = layoutRing([leaf('a', 'VIP', 1)], OPTS);
    expect(one.leaves).toHaveLength(1);
    expect(Number.isFinite(one.leaves[0].angle)).toBe(true);
  });

  it('is deterministic', () => {
    expect(layoutRing(SPREAD, OPTS)).toEqual(layoutRing(SPREAD, OPTS));
  });
});

describe('ringLabelPlacement', () => {
  it('does not flip at 12 o’clock', () => {
    const p = ringLabelPlacement(330, 0);
    expect(p.flipped).toBe(false);
    expect(p.anchor).toBe('start');
    expect(p.transform).not.toContain('rotate(180)');
  });

  it('flips on the left half so the text is not upside down', () => {
    const p = ringLabelPlacement(330, Math.PI * 1.5); // 9 o'clock
    expect(p.flipped).toBe(true);
    expect(p.anchor).toBe('end');
    expect(p.transform).toContain('rotate(180)');
  });

  it('does not flip on the right half', () => {
    expect(ringLabelPlacement(330, Math.PI / 2).flipped).toBe(false); // 3 o'clock
    expect(ringLabelPlacement(330, Math.PI * 0.75).flipped).toBe(false);
  });

  it('rotates the label onto the leaf it names, not the one opposite', () => {
    // Angle 0 is 12 o'clock here but SVG's rotate(0) points at 3 o'clock, so the two
    // frames differ by a quarter turn. Getting the sign wrong renders a tidy ring in
    // which every name sits on the wrong dot — cosmetically perfect and entirely wrong.
    expect(ringLabelPlacement(330, 0).transform).toContain('rotate(270)'); // up
    expect(ringLabelPlacement(330, Math.PI / 2).transform).toContain('rotate(0)'); // right
    expect(ringLabelPlacement(330, Math.PI).transform).toContain('rotate(90)'); // down
  });

  it('translates out to the given radius', () => {
    expect(ringLabelPlacement(330, 0).transform).toContain('translate(330,0)');
  });

  it('normalises angles past a full turn and below zero', () => {
    expect(ringLabelPlacement(330, TAU).flipped).toBe(ringLabelPlacement(330, 0).flipped);
    expect(ringLabelPlacement(330, -Math.PI / 2).flipped).toBe(
      ringLabelPlacement(330, Math.PI * 1.5).flipped,
    );
  });
});

describe('labelPolicy', () => {
  const R = 330;

  it('shows full labels on a sparse ring', () => {
    const p = labelPolicy(40, R);
    expect(p).toEqual({ showLabels: true, fontSize: 11, maxChars: 24, tickOnly: false });
  });

  it('steps down the type scale as the ring fills', () => {
    expect(labelPolicy(140, R).fontSize).toBe(11);
    expect(labelPolicy(180, R).fontSize).toBe(9);
    expect(labelPolicy(210, R).fontSize).toBe(7.5);
  });

  it('degrades to ticks rather than an unreadable smear', () => {
    const p = labelPolicy(400, R);
    expect(p.tickOnly).toBe(true);
    expect(p.showLabels).toBe(false);
  });

  it('is driven by arc per leaf, so a bigger ring holds more labels', () => {
    expect(labelPolicy(250, 330).tickOnly).toBe(true);
    expect(labelPolicy(250, 660).tickOnly).toBe(false);
  });

  it('handles an empty ring', () => {
    expect(labelPolicy(0, R).tickOnly).toBe(false);
  });
});

describe('bundlePath', () => {
  const center = { x: 500, y: 500 };
  const hub = { x: 540, y: 470, r: 40 };
  const leafPt = { x: 500, y: 170 }; // 12 o'clock at r=330

  const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  };

  const parse = (d: string) => {
    const m = d.match(/M ([-\d.]+) ([-\d.]+) C ([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+), ([-\d.]+) ([-\d.]+)/);
    if (!m) throw new Error(`unparseable: ${d}`);
    const n = m.slice(1).map(Number);
    return { p0: { x: n[0], y: n[1] }, c1: { x: n[2], y: n[3] }, c2: { x: n[4], y: n[5] }, p3: { x: n[6], y: n[7] } };
  };

  it('starts at the leaf', () => {
    const { p0 } = parse(bundlePath(leafPt, hub, center));
    expect(p0.x).toBeCloseTo(leafPt.x, 3);
    expect(p0.y).toBeCloseTo(leafPt.y, 3);
  });

  it('lands on the hub rim, not its centre', () => {
    const { p3 } = parse(bundlePath(leafPt, hub, center));
    expect(Math.hypot(p3.x - hub.x, p3.y - hub.y)).toBeCloseTo(hub.r, 3);
  });

  it('arrives head-on, so the curve does not dive through its own target', () => {
    // The endpoint tangent is 3*(p3 - c2). It must point from the rim toward the hub
    // centre; the naive c2 = hub centre points it the other way and every link then
    // passes through the circle and comes back out.
    const { c2, p3 } = parse(bundlePath(leafPt, hub, center));
    const tangent = { x: p3.x - c2.x, y: p3.y - c2.y };
    const inward = { x: hub.x - p3.x, y: hub.y - p3.y };
    const dot = tangent.x * inward.x + tangent.y * inward.y;
    expect(dot).toBeGreaterThan(0);
  });

  it('bows toward the centre, which is what makes the bundles read as ropes', () => {
    const { p0, c1, c2, p3 } = parse(bundlePath(leafPt, hub, center));
    const radiusAt = (t: number) =>
      Math.hypot(
        cubic(p0.x, c1.x, c2.x, p3.x, t) - center.x,
        cubic(p0.y, c1.y, c2.y, p3.y, t) - center.y,
      );

    let prev = radiusAt(0);
    for (let i = 1; i <= 8; i++) {
      const r = radiusAt(i / 10);
      expect(r).toBeLessThanOrEqual(prev + 1e-6);
      prev = r;
    }
  });

  it('puts the first control point on the leaf’s own radial', () => {
    // Neighbouring leaves then share an almost identical opening, which is the
    // mechanism behind the bundling.
    const { c1 } = parse(bundlePath(leafPt, hub, center, { beta: 0.55 }));
    const expectedX = center.x + (leafPt.x - center.x) * 0.55;
    const expectedY = center.y + (leafPt.y - center.y) * 0.55;
    expect(c1.x).toBeCloseTo(expectedX, 3);
    expect(c1.y).toBeCloseTo(expectedY, 3);
  });

  it('tightens the bundle as beta falls, matching d3’s curveBundle sense', () => {
    const loose = parse(bundlePath(leafPt, hub, center, { beta: 0.8 }));
    const tight = parse(bundlePath(leafPt, hub, center, { beta: 0.2 }));
    const dist = (p: { x: number; y: number }) => Math.hypot(p.x - center.x, p.y - center.y);
    expect(dist(tight.c1)).toBeLessThan(dist(loose.c1));
  });

  it('returns a valid short path, never NaN, for a leaf on the hub centre', () => {
    const d = bundlePath({ x: hub.x, y: hub.y }, hub, center);
    expect(d).not.toMatch(/NaN|Infinity/);
    expect(d.startsWith('M ')).toBe(true);
  });

  it('never emits NaN for non-finite input', () => {
    const d = bundlePath({ x: NaN, y: 0 }, hub, center);
    expect(d).not.toMatch(/NaN|Infinity/);
  });
});
