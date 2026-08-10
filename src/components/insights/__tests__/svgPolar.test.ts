import { describe, it, expect } from 'vitest';
import {
  annulusSectorPath,
  arcPath,
  clamp,
  niceTicks,
  polar,
  truncateLabel,
  TAU,
} from '../svgPolar';

const hasNaN = (d: string) => /NaN|Infinity|undefined/.test(d);

describe('polar', () => {
  it('puts angle 0 at 12 o’clock', () => {
    const p = polar(0, 0, 10, 0);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(-10, 9);
  });

  it('increases clockwise on screen', () => {
    const quarter = polar(0, 0, 10, Math.PI / 2);
    expect(quarter.x).toBeCloseTo(10, 9); // 3 o'clock
    expect(quarter.y).toBeCloseTo(0, 9);

    const half = polar(0, 0, 10, Math.PI);
    expect(half.y).toBeCloseTo(10, 9); // 6 o'clock
  });

  it('offsets by the center', () => {
    const p = polar(100, 50, 10, 0);
    expect(p).toEqual({ x: 100, y: 40 });
  });

  it('returns finite numbers for non-finite input', () => {
    const p = polar(0, 0, NaN, NaN);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});

describe('arcPath', () => {
  it('sets the large-arc flag above a half turn and clears it below', () => {
    expect(arcPath(0, 0, 10, 0, Math.PI * 0.9)).toMatch(/ 0 1 /);
    expect(arcPath(0, 0, 10, 0, Math.PI * 1.5)).toMatch(/ 1 1 /);
  });

  it('does not collapse a full turn to a point', () => {
    const d = arcPath(0, 0, 10, 0, TAU);
    // Two arc commands, because a single A between identical endpoints draws nothing.
    expect(d.match(/A /g)).toHaveLength(2);
  });

  it('honors the sweep flag, which is what keeps lower-half textPath labels upright', () => {
    expect(arcPath(0, 0, 10, 0, 1, 0)).toMatch(/ 0 0 /);
  });

  it('never emits NaN', () => {
    expect(hasNaN(arcPath(0, 0, NaN, NaN, NaN))).toBe(false);
  });
});

describe('annulusSectorPath', () => {
  it('closes a normal sector', () => {
    const d = annulusSectorPath(0, 0, 5, 10, 0, 1);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(hasNaN(d)).toBe(false);
  });

  it('returns a valid degenerate path when the radii are equal', () => {
    const d = annulusSectorPath(0, 0, 10, 10, 0, 1);
    expect(hasNaN(d)).toBe(false);
    expect(d.startsWith('M ')).toBe(true);
  });

  it('returns a valid degenerate path for a zero angular span', () => {
    const d = annulusSectorPath(0, 0, 5, 10, 1, 1);
    expect(hasNaN(d)).toBe(false);
    expect(d).not.toContain('A ');
  });

  it('tolerates reversed radii and reversed angles', () => {
    const forward = annulusSectorPath(0, 0, 5, 10, 0, 1);
    expect(annulusSectorPath(0, 0, 10, 5, 1, 0)).toBe(forward);
  });

  it('sets the large-arc flag past a half turn', () => {
    expect(annulusSectorPath(0, 0, 5, 10, 0, Math.PI * 1.5)).toMatch(/A 10 10 0 1 1/);
  });

  it('never emits NaN for non-finite input', () => {
    expect(hasNaN(annulusSectorPath(0, 0, NaN, NaN, NaN, NaN))).toBe(false);
  });
});

describe('niceTicks', () => {
  it('always returns at least a zero tick', () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(-5)).toEqual([0]);
    expect(niceTicks(NaN)).toEqual([0]);
  });

  it('steps on 1 / 2 / 5 x 10^k', () => {
    expect(niceTicks(10, 4)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(100, 4)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(4, 4)).toEqual([0, 1, 2, 3, 4]);
  });

  it('never exceeds the max, so no ring implies headroom that is not there', () => {
    for (const max of [7, 13, 47, 99, 1234, 0.4]) {
      for (const t of niceTicks(max)) expect(t).toBeLessThanOrEqual(max + 1e-9);
    }
  });

  it('stays bounded for a pathological max', () => {
    expect(niceTicks(1e12).length).toBeLessThanOrEqual(64);
    expect(niceTicks(1, 1000).length).toBeLessThanOrEqual(64);
  });
});

describe('truncateLabel', () => {
  it('leaves short text alone', () => {
    expect(truncateLabel('Bright Smiles', 24)).toBe('Bright Smiles');
  });

  it('cuts with an ellipsis and respects the budget', () => {
    const out = truncateLabel('Bright Smiles Family Dentistry', 12);
    expect(out).toBe('Bright Smil…');
    expect(Array.from(out)).toHaveLength(12);
  });

  it('never splits a surrogate pair', () => {
    const out = truncateLabel('🏥🏥🏥🏥🏥', 3);
    expect(out).toBe('🏥🏥…');
    // A naive slice(0, 2) would leave half a pair and render a replacement glyph.
    expect(out).not.toContain('�');
    expect([...out].every((c) => c.codePointAt(0)! !== 0xd83c)).toBe(true);
  });

  it('handles degenerate budgets and non-strings', () => {
    expect(truncateLabel('abc', 0)).toBe('');
    expect(truncateLabel(undefined as unknown as string, 5)).toBe('');
    expect(truncateLabel('abcdef', 1)).toBe('a…');
  });
});

describe('clamp', () => {
  it('bounds and defaults non-finite input to the low end', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(NaN, 2, 10)).toBe(2);
  });
});
