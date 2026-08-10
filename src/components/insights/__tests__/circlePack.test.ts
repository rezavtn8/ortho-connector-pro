import { describe, it, expect } from 'vitest';
import { packCircles, type PackInput } from '../circlePack';

const OPTS = { radius: 200, padding: 6, minRadiusRatio: 0.18 };

const HUBS: PackInput[] = [
  { id: 'visit', value: 400 },
  { id: 'campaign', value: 200 },
  { id: 'email', value: 90 },
  { id: 'none', value: 30 },
];

const overlaps = (out: ReturnType<typeof packCircles>) => {
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const d = Math.hypot(out[j].x - out[i].x, out[j].y - out[i].y);
      // Allow a hair of slack: the final uniform scale can shave a fraction off the
      // separation the relaxation achieved.
      if (d < out[i].r + out[j].r - 1e-6) return true;
    }
  }
  return false;
};

describe('packCircles', () => {
  it('produces no overlapping circles', () => {
    expect(overlaps(packCircles(HUBS, OPTS))).toBe(false);
  });

  it('fits inside the requested disc', () => {
    for (const c of packCircles(HUBS, OPTS)) {
      expect(Math.hypot(c.x, c.y) + c.r).toBeLessThanOrEqual(OPTS.radius + 1e-6);
    }
  });

  it('fills the disc rather than leaving it mostly empty', () => {
    const out = packCircles(HUBS, OPTS);
    const extent = Math.max(...out.map((c) => Math.hypot(c.x, c.y) + c.r));
    expect(extent).toBeCloseTo(OPTS.radius, 6);
  });

  it('keeps area proportional to value through the fit', () => {
    // The uniform scale in the fit step is what preserves this. Scaling positions
    // without scaling radii would fit the cluster and silently break the encoding.
    const out = packCircles(HUBS, OPTS);
    const byId = new Map(out.map((c) => [c.id, c]));
    const ratio = (byId.get('visit')!.r / byId.get('campaign')!.r) ** 2;
    expect(ratio).toBeCloseTo(400 / 200, 6);
  });

  it('is deterministic — no RNG anywhere', () => {
    expect(packCircles(HUBS, OPTS)).toEqual(packCircles(HUBS, OPTS));
  });

  it('returns circles in input order, for stable React keys', () => {
    expect(packCircles(HUBS, OPTS).map((c) => c.id)).toEqual(HUBS.map((h) => h.id));
  });

  it('floors a zero-value circle so it stays a visible target', () => {
    const out = packCircles([...HUBS.slice(0, 3), { id: 'none', value: 0 }], OPTS);
    const byId = new Map(out.map((c) => [c.id, c]));
    const maxR = Math.max(...out.map((c) => c.r));
    expect(byId.get('none')!.r).toBeGreaterThanOrEqual(maxR * OPTS.minRadiusRatio - 1e-6);
    expect(byId.get('none')!.value).toBe(0);
  });
});

describe('packCircles — degenerate input', () => {
  it('returns nothing for no items', () => {
    expect(packCircles([], OPTS)).toEqual([]);
  });

  it('centres a single circle and fills the disc', () => {
    const out = packCircles([{ id: 'only', value: 7 }], OPTS);
    expect(out).toEqual([{ id: 'only', value: 7, x: 0, y: 0, r: 200 }]);
  });

  it('gives equal radii when every value is zero', () => {
    const out = packCircles(
      HUBS.map((h) => ({ ...h, value: 0 })),
      OPTS,
    );
    for (const c of out) expect(c.r).toBeCloseTo(out[0].r, 6);
    expect(overlaps(out)).toBe(false);
  });

  it('separates two circles seeded on the same point', () => {
    const out = packCircles(
      [
        { id: 'a', value: 10 },
        { id: 'b', value: 10 },
      ],
      OPTS,
    );
    expect(overlaps(out)).toBe(false);
    for (const c of out) expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
  });

  it('never emits a non-finite coordinate for a non-finite value', () => {
    const out = packCircles([{ id: 'a', value: NaN }, { id: 'b', value: 10 }], OPTS);
    for (const c of out) {
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
      expect(Number.isFinite(c.r)).toBe(true);
    }
  });

  it('treats a negative value as zero rather than producing an imaginary radius', () => {
    const out = packCircles([{ id: 'a', value: -5 }, { id: 'b', value: 10 }], OPTS);
    expect(out.every((c) => c.r > 0)).toBe(true);
  });

  it('breaks seeding ties on id so equal values do not shuffle', () => {
    const tied: PackInput[] = [
      { id: 'b', value: 10 },
      { id: 'a', value: 10 },
      { id: 'c', value: 10 },
    ];
    expect(packCircles(tied, OPTS)).toEqual(packCircles(tied, OPTS));
    expect(packCircles(tied, OPTS)).toEqual(packCircles([...tied], OPTS));
  });

  it('handles more circles than the four the chart uses today', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `h${i}`, value: (i + 1) * 10 }));
    const out = packCircles(many, OPTS);
    expect(out).toHaveLength(12);
    expect(overlaps(out)).toBe(false);
    for (const c of out) expect(Math.hypot(c.x, c.y) + c.r).toBeLessThanOrEqual(OPTS.radius + 1e-6);
  });
});
