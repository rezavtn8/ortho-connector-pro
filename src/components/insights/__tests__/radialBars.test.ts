import { describe, it, expect } from 'vitest';
import { layoutRadialBars, DEFAULT_HOLE_RATIO, type RadialBarInput } from '../radialBars';
import { TAU } from '../svgPolar';

const TIERS = ['VIP', 'Warm', 'Cold', 'Dormant'] as const;

const BOX = {
  cx: 500,
  cy: 500,
  innerRadius: 200,
  outerRadius: 384,
  groupOrder: TIERS,
  mode: 'magnitude' as const,
  sectorGap: 0.05,
};

const bar = (id: string, group: string, value: number, sortValue = value): RadialBarInput => ({
  id,
  label: id,
  group,
  value,
  sortValue,
});

/** Four offices per tier, descending volume. */
const SPREAD: RadialBarInput[] = TIERS.flatMap((tier, t) =>
  [0, 1, 2, 3].map((i) => bar(`${tier}-${i}`, tier, (4 - t) * 10 - i)),
);

describe('layoutRadialBars — angles', () => {
  const out = layoutRadialBars(SPREAD, BOX);

  it('closes the ring: sector widths plus gaps sum to a full turn', () => {
    const widths = out.sectors.reduce((acc, s) => acc + (s.endAngle - s.startAngle), 0);
    expect(widths + out.sectors.length * BOX.sectorGap).toBeCloseTo(TAU, 9);
  });

  it('lays sectors out in the declared group order, without overlap', () => {
    expect(out.sectors.map((s) => s.group)).toEqual([...TIERS]);
    for (let i = 1; i < out.sectors.length; i++) {
      expect(out.sectors[i].startAngle).toBeGreaterThan(out.sectors[i - 1].endAngle);
    }
  });

  it('gives every bar the same angular width, so length is the only encoding', () => {
    // This is the whole reason sector width is proportional to count rather than
    // equal quarters: with equal quarters a six-office sector gets fat bars whose
    // area shouts over the long thin bars they lose to.
    const widths = out.bars.map((b) => b.endAngle - b.startAngle);
    for (const w of widths) expect(w).toBeCloseTo(widths[0], 9);
  });

  it('does not overlap bars within a sector', () => {
    for (const tier of TIERS) {
      const inSector = out.bars.filter((b) => b.group === tier).sort((a, b) => a.startAngle - b.startAngle);
      for (let i = 1; i < inSector.length; i++) {
        expect(inSector[i].startAngle).toBeGreaterThanOrEqual(inSector[i - 1].endAngle);
      }
    }
  });

  it('orders bars by sortValue descending within a sector', () => {
    const vip = out.bars.filter((b) => b.group === 'VIP').sort((a, b) => a.startAngle - b.startAngle);
    expect(vip.map((b) => b.value)).toEqual([40, 39, 38, 37]);
  });

  it('keeps the sort stable when the displayed metric changes sign', () => {
    // Sorting by the displayed value would reshuffle every bar when the user flips
    // to "change vs baseline" and they would lose whichever office they were reading.
    const flipped = SPREAD.map((d) => ({ ...d, value: -d.value }));
    const diverging = layoutRadialBars(flipped, { ...BOX, mode: 'diverging' });
    expect(diverging.bars.map((b) => b.id)).toEqual(out.bars.map((b) => b.id));
  });
});

describe('layoutRadialBars — magnitude scale', () => {
  const out = layoutRadialBars(SPREAD, BOX);

  it('starts every bar at the donut hole', () => {
    for (const b of out.bars) expect(b.r0).toBe(BOX.innerRadius);
  });

  it('takes the largest bar exactly to the outer radius', () => {
    const longest = out.bars.reduce((a, b) => (b.value > a.value ? b : a));
    expect(longest.r1).toBeCloseTo(BOX.outerRadius, 9);
  });

  it('is linear in value, not sqrt', () => {
    const byId = new Map(out.bars.map((b) => [b.id, b]));
    const len = (id: string) => byId.get(id)!.r1 - byId.get(id)!.r0;
    // VIP-0 is 40, Cold-0 is 20 — exactly double, so the lengths must be too.
    expect(len('VIP-0') / len('Cold-0')).toBeCloseTo(2, 6);
  });

  it('collapses a zero-value bar to no length', () => {
    const zeroed = layoutRadialBars([bar('z', 'VIP', 0), bar('a', 'VIP', 10)], BOX);
    const z = zeroed.bars.find((b) => b.id === 'z')!;
    expect(z.r1).toBeCloseTo(z.r0, 9);
    expect(z.sign).toBe(0);
  });

  it('keeps the hole large enough that the tip is not much wider than the base', () => {
    expect(DEFAULT_HOLE_RATIO).toBeGreaterThan(0.4);
    expect(1 / DEFAULT_HOLE_RATIO).toBeLessThan(2.2);
  });
});

describe('layoutRadialBars — diverging scale', () => {
  const values: RadialBarInput[] = [
    bar('up', 'VIP', 10, 100),
    bar('down', 'VIP', -10, 90),
    bar('flat', 'VIP', 0, 80),
  ];
  const out = layoutRadialBars(values, { ...BOX, mode: 'diverging' });
  const byId = new Map(out.bars.map((b) => [b.id, b]));

  it('grows gaining bars outward from the zero ring', () => {
    expect(byId.get('up')!.r0).toBeCloseTo(out.scale.zeroRadius, 9);
    expect(byId.get('up')!.r1).toBeGreaterThan(out.scale.zeroRadius);
    expect(byId.get('up')!.sign).toBe(1);
  });

  it('grows slipping bars inward from the zero ring', () => {
    expect(byId.get('down')!.r1).toBeCloseTo(out.scale.zeroRadius, 9);
    expect(byId.get('down')!.r0).toBeLessThan(out.scale.zeroRadius);
    expect(byId.get('down')!.sign).toBe(-1);
  });

  it('gives a no-change bar a visible tick rather than nothing', () => {
    // Absent would be indistinguishable from "this office is missing".
    const flat = byId.get('flat')!;
    expect(flat.r1 - flat.r0).toBeGreaterThan(0);
    expect(flat.sign).toBe(0);
  });

  it('is symmetric in fractional extent for equal and opposite values', () => {
    const up = byId.get('up')!;
    const down = byId.get('down')!;
    const outFrac = (up.r1 - out.scale.zeroRadius) / (out.scale.outerRadius - out.scale.zeroRadius);
    const inFrac =
      (out.scale.zeroRadius - down.r0) / (out.scale.zeroRadius - out.scale.innerRadius);
    expect(outFrac).toBeCloseTo(inFrac, 9);
  });

  it('gives the gaining arm the larger share of the band', () => {
    // The zero ring therefore sits *below* the midpoint. Putting it above would hand
    // the extra room to the slipping side, which is the reverse of the intent.
    const { zeroRadius, innerRadius, outerRadius } = out.scale;
    expect(zeroRadius).toBeLessThan((innerRadius + outerRadius) / 2);
    expect(outerRadius - zeroRadius).toBeGreaterThan(zeroRadius - innerRadius);
  });

  it('scales against the largest magnitude, not the largest positive', () => {
    const skewed = layoutRadialBars([bar('a', 'VIP', 2), bar('b', 'VIP', -50)], {
      ...BOX,
      mode: 'diverging',
    });
    expect(skewed.scale.domainMax).toBe(50);
  });
});

describe('layoutRadialBars — value rings', () => {
  it('never places a ring beyond the outer radius', () => {
    const out = layoutRadialBars(SPREAD, BOX);
    for (const t of out.scale.ticks) {
      expect(t.radius).toBeLessThanOrEqual(BOX.outerRadius + 1e-6);
      expect(t.radius).toBeGreaterThanOrEqual(out.scale.zeroRadius - 1e-6);
    }
  });

  it('rings both arms in diverging mode, each on its own scale', () => {
    const out = layoutRadialBars(
      [bar('up', 'VIP', 10), bar('down', 'VIP', -10)],
      { ...BOX, mode: 'diverging' },
    );
    const { zeroRadius, innerRadius, outerRadius } = out.scale;

    const outward = out.scale.ticks.filter((t) => t.value > 0);
    const inward = out.scale.ticks.filter((t) => t.value < 0);

    expect(outward.length).toBeGreaterThan(0);
    expect(inward.length).toBe(outward.length);

    for (const t of outward) {
      expect(t.radius).toBeGreaterThanOrEqual(zeroRadius - 1e-6);
      expect(t.radius).toBeLessThanOrEqual(outerRadius + 1e-6);
    }
    for (const t of inward) {
      expect(t.radius).toBeLessThanOrEqual(zeroRadius + 1e-6);
      expect(t.radius).toBeGreaterThanOrEqual(innerRadius - 1e-6);
    }

    // The arms are different lengths, so mirrored radii would misreport the inward
    // side. Equal magnitudes must sit at *different* distances from zero.
    const up = outward.find((t) => t.value === 10)!;
    const down = inward.find((t) => t.value === -10)!;
    expect(zeroRadius - down.radius).toBeLessThan(up.radius - zeroRadius);
  });

  it('adds no inward rings in magnitude mode', () => {
    const out = layoutRadialBars(SPREAD, BOX);
    expect(out.scale.ticks.every((t) => t.value >= 0)).toBe(true);
  });

  it('puts the tick gutter in the gap before the first sector, not on a bar', () => {
    const out = layoutRadialBars(SPREAD, BOX);
    for (const b of out.bars) {
      const onBar = out.scale.gutterAngle >= b.startAngle && out.scale.gutterAngle <= b.endAngle;
      expect(onBar).toBe(false);
    }
  });
});

describe('layoutRadialBars — sector labels', () => {
  const out = layoutRadialBars(SPREAD, BOX);

  it('reverses the label arc on the lower half so glyphs stay upright', () => {
    const upper = out.sectors.filter((s) => s.midAngle <= Math.PI / 2 || s.midAngle >= Math.PI * 1.5);
    const lower = out.sectors.filter((s) => s.midAngle > Math.PI / 2 && s.midAngle < Math.PI * 1.5);

    expect(lower.length).toBeGreaterThan(0);
    for (const s of lower) expect(s.labelPath).toMatch(/A [\d.]+ [\d.]+ 0 \d 0 /);
    for (const s of upper) expect(s.labelPath).toMatch(/A [\d.]+ [\d.]+ 0 \d 1 /);
  });

  it('pushes reversed labels one ring further out so the baselines do not collide', () => {
    const lower = out.sectors.find((s) => s.midAngle > Math.PI / 2 && s.midAngle < Math.PI * 1.5)!;
    const upper = out.sectors.find((s) => s.midAngle <= Math.PI / 2)!;
    expect(lower.labelRadius).toBeGreaterThan(upper.labelRadius);
  });

  it('emits no NaN in any path', () => {
    for (const s of out.sectors) expect(s.labelPath).not.toMatch(/NaN|Infinity/);
    for (const b of out.bars) expect(b.path).not.toMatch(/NaN|Infinity/);
  });
});

describe('layoutRadialBars — degenerate input', () => {
  it('reports empty groups instead of silently dropping the sector', () => {
    const out = layoutRadialBars([bar('a', 'VIP', 5)], BOX);
    expect(out.emptyGroups).toEqual(['Warm', 'Cold', 'Dormant']);
    expect(out.sectors.map((s) => s.group)).toEqual(['VIP']);
  });

  it('returns an empty layout, not a crash, for no input', () => {
    const out = layoutRadialBars([], BOX);
    expect(out.bars).toEqual([]);
    expect(out.sectors).toEqual([]);
    expect(out.emptyGroups).toEqual([...TIERS]);
  });

  it('gives a one-office sector at least the minimum angle for its label', () => {
    const lopsided = [
      bar('solo', 'VIP', 5),
      ...Array.from({ length: 200 }, (_, i) => bar(`c${i}`, 'Cold', 1)),
    ];
    const out = layoutRadialBars(lopsided, { ...BOX, minSectorAngle: 0.12 });
    const vip = out.sectors.find((s) => s.group === 'VIP')!;
    expect(vip.endAngle - vip.startAngle).toBeGreaterThanOrEqual(0.11);
  });

  it('never lets the ring overrun a full turn when the minimum angle bites', () => {
    const many = Array.from({ length: 30 }, (_, i) => bar(`g${i}`, `G${i}`, 1));
    const out = layoutRadialBars(many, { ...BOX, groupOrder: [], minSectorAngle: 0.5 });
    const widths = out.sectors.reduce((acc, s) => acc + (s.endAngle - s.startAngle), 0);
    expect(widths + out.sectors.length * BOX.sectorGap).toBeLessThanOrEqual(TAU + 1e-9);
  });

  it('appends an unlisted group rather than dropping its bars', () => {
    const out = layoutRadialBars([bar('a', 'VIP', 5), bar('x', 'Mystery', 3)], BOX);
    expect(out.sectors.map((s) => s.group)).toEqual(['VIP', 'Mystery']);
    expect(out.bars).toHaveLength(2);
  });

  it('does not divide by zero when every value is zero', () => {
    const out = layoutRadialBars([bar('a', 'VIP', 0), bar('b', 'VIP', 0)], BOX);
    expect(out.scale.domainMax).toBe(1);
    for (const b of out.bars) {
      expect(Number.isFinite(b.r1)).toBe(true);
      expect(b.path).not.toMatch(/NaN/);
    }
  });

  it('treats a non-finite value as zero rather than propagating it', () => {
    const out = layoutRadialBars([bar('a', 'VIP', NaN), bar('b', 'VIP', 4)], BOX);
    const a = out.bars.find((b) => b.id === 'a')!;
    expect(Number.isFinite(a.r1)).toBe(true);
    expect(a.path).not.toMatch(/NaN/);
  });

  it('is deterministic, including ties', () => {
    const ties = [bar('b', 'VIP', 5), bar('a', 'VIP', 5), bar('c', 'VIP', 5)];
    const first = layoutRadialBars(ties, BOX);
    expect(first.bars.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(layoutRadialBars(ties, BOX)).toEqual(first);
  });
});
