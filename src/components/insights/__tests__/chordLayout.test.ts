import { describe, it, expect } from 'vitest';
import { layoutChord, type ChordMatrix } from '../chordLayout';
import { TAU } from '../svgPolar';

const KEYS = ['VIP', 'Warm', 'Cold', 'Dormant'];
const LABELS = Object.fromEntries(KEYS.map((k) => [k, k]));
const OPTS = { cx: 400, cy: 400, radius: 300, bandWidth: 16, padAngle: 0.04 };

/** VIP holds 50, 10 slip to Warm; Warm holds 20; Cold holds 5 and 5 rise to Warm. */
const M: ChordMatrix = [
  [50, 10, 0, 0],
  [0, 20, 0, 0],
  [0, 5, 5, 0],
  [0, 0, 0, 0],
];

describe('layoutChord', () => {
  const out = layoutChord(KEYS, LABELS, M, OPTS);

  it('drops groups that carry nothing, and their pad with them', () => {
    // A reserved slice for an empty tier leaves a gap with no label beside it, which
    // reads as a rendering fault rather than as "nothing was in this tier".
    expect(out.groups.map((g) => g.key)).toEqual(['VIP', 'Warm', 'Cold']);
  });

  it('closes the ring: arcs plus pads make a full turn', () => {
    const arcs = out.groups.reduce((acc, g) => acc + (g.endAngle - g.startAngle), 0);
    expect(arcs + out.groups.length * OPTS.padAngle).toBeCloseTo(TAU, 9);
  });

  it('sizes each arc by outgoing plus incoming', () => {
    const byKey = new Map(out.groups.map((g) => [g.key, g]));
    expect(byKey.get('VIP')!.outgoing).toBe(60);
    expect(byKey.get('VIP')!.incoming).toBe(50);
    expect(byKey.get('VIP')!.total).toBe(110);
    expect(byKey.get('Warm')!.incoming).toBe(35); // 10 from VIP + 20 self + 5 from Cold
  });

  it('makes arc length proportional to that total', () => {
    const byKey = new Map(out.groups.map((g) => [g.key, g]));
    const span = (k: string) => byKey.get(k)!.endAngle - byKey.get(k)!.startAngle;
    expect(span('VIP') / span('Cold')).toBeCloseTo(110 / 15, 6);
  });

  it('counts each unit once, not twice', () => {
    // 50 + 10 + 20 + 5 + 5 = 90 units of volume in the period.
    expect(out.total).toBe(90);
  });

  it('reports what share actually moved', () => {
    // 15 of 90 changed tier: 10 VIP->Warm and 5 Cold->Warm.
    expect(out.movedShare).toBeCloseTo(15 / 90, 9);
  });

  it('emits one ribbon per non-zero cell, and flags the self-loops', () => {
    expect(out.ribbons).toHaveLength(5);
    expect(out.ribbons.filter((r) => r.isSelf).map((r) => r.from).sort()).toEqual([
      'Cold',
      'VIP',
      'Warm',
    ]);
  });

  it('emits closed paths with no NaN', () => {
    for (const g of out.groups) {
      expect(g.path.startsWith('M ')).toBe(true);
      expect(g.path.endsWith(' Z')).toBe(true);
      expect(g.path).not.toMatch(/NaN|Infinity/);
    }
    for (const r of out.ribbons) {
      expect(r.path.startsWith('M ')).toBe(true);
      expect(r.path.endsWith(' Z')).toBe(true);
      expect(r.path).not.toMatch(/NaN|Infinity/);
    }
  });

  it('keeps every ribbon foot inside its own group’s arc', () => {
    // The classic bug: interleaving the outgoing and incoming passes puts a foot
    // outside its arc, so a ribbon appears to leave from the wrong tier entirely.
    const byKey = new Map(out.groups.map((g) => [g.key, g]));
    for (const r of out.ribbons) {
      const from = byKey.get(r.from)!;
      const to = byKey.get(r.to)!;
      expect(r.sourceAngle).toBeGreaterThanOrEqual(from.startAngle - 1e-9);
      expect(r.sourceAngle).toBeLessThanOrEqual(from.endAngle + 1e-9);
      expect(r.targetAngle).toBeGreaterThanOrEqual(to.startAngle - 1e-9);
      expect(r.targetAngle).toBeLessThanOrEqual(to.endAngle + 1e-9);
    }
  });

  it('fills each arc exactly, leaving no unused sliver', () => {
    // Every unit of a group's total is either an outgoing or an incoming foot, so the
    // feet must tile the arc with nothing left over.
    const byKey = new Map(out.groups.map((g) => [g.key, g]));
    for (const g of out.groups) {
      const feet = out.ribbons
        .filter((r) => r.from === g.key)
        .reduce((acc, r) => acc + r.value, 0);
      const back = out.ribbons.filter((r) => r.to === g.key).reduce((acc, r) => acc + r.value, 0);
      expect(feet + back).toBe(byKey.get(g.key)!.total);
    }
  });

  it('keeps a self-loop near its own arc and dives a cross-ribbon toward the centre', () => {
    // Inverting the control-point pull is the classic mistake: every self-loop gets
    // dragged to the middle and the whole thing renders as a pie chart of four
    // lens-shaped wedges rather than as a chord.
    const control = (path: string) => {
      const m = path.match(/Q ([-\d.]+) ([-\d.]+)/);
      return { x: Number(m![1]), y: Number(m![2]) };
    };
    const distFromCentre = (p: { x: number; y: number }) =>
      Math.hypot(p.x - OPTS.cx, p.y - OPTS.cy);

    const self = out.ribbons.find((r) => r.isSelf && r.from === 'VIP')!;
    const cross = out.ribbons.find((r) => r.from === 'VIP' && r.to === 'Warm')!;

    expect(distFromCentre(control(self.path))).toBeGreaterThan(
      distFromCentre(control(cross.path)),
    );

    // A *narrow* self-loop is the sharp case: its two feet are almost on top of each
    // other, so the control point should sit right out by the arc. Under the inverted
    // pull it lands on the centre instead.
    const narrow = layoutChord(
      KEYS,
      LABELS,
      [[1, 0, 0, 0], [0, 100, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      OPTS,
    );
    const tiny = narrow.ribbons.find((r) => r.from === 'VIP')!;
    expect(distFromCentre(control(tiny.path))).toBeGreaterThan(OPTS.radius * 0.9);
  });

  it('puts the control point on the chord midpoint at zero curvature', () => {
    const flat = layoutChord(KEYS, LABELS, M, { ...OPTS, curvature: 0 });
    const control = (path: string) => {
      const m = path.match(/Q ([-\d.]+) ([-\d.]+)/);
      return { x: Number(m![1]), y: Number(m![2]) };
    };
    const start = (path: string) => {
      const m = path.match(/^M ([-\d.]+) ([-\d.]+)/);
      return { x: Number(m![1]), y: Number(m![2]) };
    };

    for (const r of flat.ribbons) {
      // pull === 1 everywhere, so no ribbon is pulled toward the centre at all: every
      // control point stays on the straight line between its feet.
      const c = control(r.path);
      const s = start(r.path);
      expect(Math.hypot(c.x - OPTS.cx, c.y - OPTS.cy)).toBeLessThanOrEqual(
        Math.hypot(s.x - OPTS.cx, s.y - OPTS.cy) + 1e-6,
      );
    }
  });

  it('is deterministic', () => {
    expect(layoutChord(KEYS, LABELS, M, OPTS)).toEqual(layoutChord(KEYS, LABELS, M, OPTS));
  });
});

describe('layoutChord — degenerate input', () => {
  const empty = { groups: [], ribbons: [], total: 0, movedShare: 0 };

  it('returns an empty layout for no keys', () => {
    expect(layoutChord([], {}, [], OPTS)).toEqual(empty);
  });

  it('returns an empty layout when nothing moved anywhere', () => {
    expect(layoutChord(KEYS, LABELS, [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], OPTS)).toEqual(
      empty,
    );
  });

  it('handles a single group holding everything', () => {
    const out = layoutChord(KEYS, LABELS, [[10, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], OPTS);
    expect(out.groups).toHaveLength(1);
    expect(out.ribbons).toHaveLength(1);
    expect(out.ribbons[0].isSelf).toBe(true);
    expect(out.movedShare).toBe(0);
    expect(out.ribbons[0].path).not.toMatch(/NaN/);
  });

  it('reports a fully churned book', () => {
    const out = layoutChord(
      KEYS,
      LABELS,
      [[0, 10, 0, 0], [10, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      OPTS,
    );
    expect(out.movedShare).toBe(1);
  });

  it('ignores negative and non-finite cells', () => {
    const out = layoutChord(
      KEYS,
      LABELS,
      [[5, -3, NaN as number, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
      OPTS,
    );
    expect(out.total).toBe(5);
    expect(out.ribbons).toHaveLength(1);
  });

  it('tolerates a ragged or missing matrix', () => {
    expect(layoutChord(KEYS, LABELS, [[1]], OPTS).total).toBe(1);
    expect(layoutChord(KEYS, LABELS, undefined as never, OPTS)).toEqual(empty);
  });

  it('falls back to the key when a label is missing', () => {
    const out = layoutChord(KEYS, {}, M, OPTS);
    expect(out.groups[0].label).toBe('VIP');
  });
});
