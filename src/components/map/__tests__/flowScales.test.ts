import { describe, it, expect } from 'vitest';
import {
  allocateParticles,
  normalize,
  particleOpacity,
  particlesFor,
  radiusFor,
  smoothstep,
  speedFor,
  widthFor,
} from '../flowScales';

describe('normalize', () => {
  it('maps the max to 1 and zero to 0', () => {
    expect(normalize(60, 60)).toBe(1);
    expect(normalize(0, 60)).toBe(0);
  });

  it('compresses the top end via sqrt', () => {
    // 60 vs 5 is a 12x ratio in raw counts but ~3.5x in visual weight.
    const ratio = normalize(60, 60) / normalize(5, 60);
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(4);
  });

  it('clamps rather than exceeding 1 or going negative', () => {
    expect(normalize(100, 60)).toBe(1);
    expect(normalize(-5, 60)).toBe(0);
  });

  it('does not divide by zero when there is no data', () => {
    expect(normalize(5, 0)).toBe(0);
  });
});

describe('visual scales', () => {
  it('keeps the smallest possible flow above the visibility floor', () => {
    const u = normalize(1, 500); // one patient against a busy network
    expect(widthFor(u)).toBeGreaterThanOrEqual(1.2);
    expect(particlesFor(u)).toBe(1); // never motionless
    expect(radiusFor(u)).toBeGreaterThanOrEqual(2);
  });

  it('is monotonic in volume', () => {
    const us = [0, 0.25, 0.5, 0.75, 1];
    for (let i = 1; i < us.length; i++) {
      expect(widthFor(us[i])).toBeGreaterThan(widthFor(us[i - 1]));
      expect(speedFor(us[i])).toBeGreaterThan(speedFor(us[i - 1]));
      expect(radiusFor(us[i])).toBeGreaterThan(radiusFor(us[i - 1]));
    }
  });

  it('caps width and particle count at the top of the range', () => {
    expect(widthFor(1)).toBeCloseTo(9, 5);
    expect(particlesFor(1)).toBe(8);
    expect(particlesFor(5)).toBe(10); // hard cap even if u somehow exceeds 1
  });

  it('keeps traversal slow enough to read as flow', () => {
    expect(1 / speedFor(1)).toBeGreaterThan(5); // fastest is still ~6s end to end
    expect(1 / speedFor(0)).toBeLessThan(20); // slowest is still ~16s
  });
});

describe('smoothstep / particleOpacity', () => {
  it('clamps at the edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
  });

  it('does not divide by zero on a degenerate range', () => {
    expect(smoothstep(1, 1, 0)).toBe(0);
    expect(smoothstep(1, 1, 2)).toBe(1);
  });

  it('fades in from the office and out into the clinic', () => {
    expect(particleOpacity(0)).toBeCloseTo(0, 6);
    expect(particleOpacity(0.5)).toBeCloseTo(1, 6);
    expect(particleOpacity(1)).toBeCloseTo(0, 6);
    expect(particleOpacity(0.03)).toBeLessThan(particleOpacity(0.06));
  });
});

describe('allocateParticles', () => {
  it('handles no flows', () => {
    expect(allocateParticles([], 400)).toEqual({ counts: [], animatedFlows: 0 });
  });

  it('gives every flow at least one particle before any gets a second', () => {
    const { counts } = allocateParticles([0.01, 0.02, 1], 400);
    expect(counts.every((c) => c >= 1)).toBe(true);
  });

  it('gives busier flows more particles', () => {
    const { counts } = allocateParticles([0.1, 1], 400);
    expect(counts[1]).toBeGreaterThan(counts[0]);
  });

  it('never exceeds the budget', () => {
    const weights = Array.from({ length: 120 }, (_, i) => (i + 1) / 120);
    const { counts } = allocateParticles(weights, 400);
    expect(counts.reduce((s, c) => s + c, 0)).toBeLessThanOrEqual(400);
  });

  it('reports how many flows are animated when flows outnumber the budget', () => {
    const weights = Array.from({ length: 500 }, (_, i) => i / 500);
    const { counts, animatedFlows } = allocateParticles(weights, 400);
    expect(animatedFlows).toBe(400);
    expect(counts.reduce((s, c) => s + c, 0)).toBe(400);
    // The busiest flows are the ones that keep their motion.
    expect(counts[499]).toBe(1);
    expect(counts[0]).toBe(0);
  });

  it('respects a tiny budget', () => {
    const { counts } = allocateParticles([0.2, 0.9, 0.5], 2);
    expect(counts.reduce((s, c) => s + c, 0)).toBe(2);
  });
});
