import { describe, it, expect } from 'vitest';
import { bearingDegrees, compassPoint, distanceMiles } from '../geo';
import { heatStep, heatThresholds, HEAT_FILL } from '../insightsColors';

const IRVINE = { latitude: 33.6846, longitude: -117.8265 };

describe('distanceMiles', () => {
  it('is zero for the same point', () => {
    expect(distanceMiles(IRVINE, IRVINE)).toBeCloseTo(0, 6);
  });

  it('measures a degree of latitude at about 69 miles', () => {
    const north = { latitude: IRVINE.latitude + 1, longitude: IRVINE.longitude };
    expect(distanceMiles(IRVINE, north)).toBeGreaterThan(68);
    expect(distanceMiles(IRVINE, north)).toBeLessThan(70);
  });

  it('compresses a degree of longitude at this latitude', () => {
    // cos(33.68) ~ 0.832, so a degree east is ~57 miles, not 69. A plot that treated
    // the two as equal would stretch the catchment east-west by a fifth.
    const east = { latitude: IRVINE.latitude, longitude: IRVINE.longitude + 1 };
    expect(distanceMiles(IRVINE, east)).toBeGreaterThan(56);
    expect(distanceMiles(IRVINE, east)).toBeLessThan(59);
  });

  it('does not round away sub-mile differences', () => {
    const near = { latitude: IRVINE.latitude + 0.001, longitude: IRVINE.longitude };
    const d = distanceMiles(IRVINE, near)!;
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(0.1);
  });

  it('returns null rather than NaN for unusable coordinates', () => {
    expect(distanceMiles(IRVINE, { latitude: NaN, longitude: 0 })).toBeNull();
    expect(distanceMiles(IRVINE, { latitude: 999, longitude: 0 })).toBeNull();
    expect(distanceMiles(IRVINE, null as never)).toBeNull();
  });
});

describe('bearingDegrees', () => {
  it('reads due north as 0 and due south as 180', () => {
    expect(
      bearingDegrees(IRVINE, { latitude: IRVINE.latitude + 1, longitude: IRVINE.longitude }),
    ).toBeCloseTo(0, 4);
    expect(
      bearingDegrees(IRVINE, { latitude: IRVINE.latitude - 1, longitude: IRVINE.longitude }),
    ).toBeCloseTo(180, 4);
  });

  it('reads due east as 90 and due west as 270', () => {
    // Within half a degree, not exact: the great circle to a point on the same
    // parallel sets off very slightly poleward, so the initial bearing is 89.7 rather
    // than 90. That is the correct spherical answer, and the reason this is a bearing
    // function rather than a delta.
    expect(
      bearingDegrees(IRVINE, { latitude: IRVINE.latitude, longitude: IRVINE.longitude + 1 }),
    ).toBeCloseTo(90, 0);
    expect(
      bearingDegrees(IRVINE, { latitude: IRVINE.latitude, longitude: IRVINE.longitude - 1 }),
    ).toBeCloseTo(270, 0);
  });

  it('uses the forward azimuth, not a flat atan2 of the deltas', () => {
    // Equal degree offsets north and east. Flat maths would call this exactly 45;
    // the true bearing leans east because a degree of longitude is shorter here.
    const ne = { latitude: IRVINE.latitude + 1, longitude: IRVINE.longitude + 1 };
    const b = bearingDegrees(IRVINE, ne)!;
    expect(b).toBeGreaterThan(37);
    expect(b).toBeLessThan(45);
  });

  it('always returns 0..360', () => {
    for (const dLng of [-3, -1, 1, 3]) {
      for (const dLat of [-2, 0, 2]) {
        if (!dLat && !dLng) continue;
        const b = bearingDegrees(IRVINE, {
          latitude: IRVINE.latitude + dLat,
          longitude: IRVINE.longitude + dLng,
        })!;
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(360);
      }
    }
  });

  it('returns null for unusable coordinates', () => {
    expect(bearingDegrees(IRVINE, { latitude: 0, longitude: Infinity })).toBeNull();
  });
});

describe('compassPoint', () => {
  it('snaps to the nearest of eight points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(44)).toBe('NE');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(181)).toBe('S');
    expect(compassPoint(315)).toBe('NW');
  });

  it('wraps past a full turn and below zero', () => {
    expect(compassPoint(360)).toBe('N');
    expect(compassPoint(359)).toBe('N');
    expect(compassPoint(-90)).toBe('W');
  });

  it('does not throw on rubbish', () => {
    expect(compassPoint(NaN)).toBe('N');
  });
});

describe('heatStep', () => {
  it('gives zero its own treatment rather than the lightest shade', () => {
    // "No referrals" and "one referral" are different facts; rendering them as
    // neighbouring blues asks the reader to tell them apart by eye.
    expect(heatStep(0, 40)).toBe(-1);
    expect(heatStep(1, 40)).toBeGreaterThanOrEqual(0);
  });

  it('puts the maximum in the darkest bin', () => {
    expect(heatStep(40, 40)).toBe(HEAT_FILL.length - 1);
  });

  it('spreads a skewed distribution across the bins rather than piling it in one', () => {
    // The realistic shape: one office at 40/mo and a long tail at 1-3.
    const bins = new Set([1, 2, 3, 8, 20, 40].map((v) => heatStep(v, 40)));
    expect(bins.size).toBeGreaterThanOrEqual(4);
  });

  it('clamps values above the max instead of overflowing the ramp', () => {
    expect(heatStep(999, 40)).toBe(HEAT_FILL.length - 1);
  });

  it('survives a zero or non-finite max', () => {
    expect(heatStep(5, 0)).toBe(0);
    expect(heatStep(NaN, 40)).toBe(-1);
  });
});

describe('heatThresholds', () => {
  it('returns one ascending threshold per bin, ending at the max', () => {
    const t = heatThresholds(40);
    expect(t).toHaveLength(HEAT_FILL.length);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
    expect(t[t.length - 1]).toBe(40);
  });

  it('is empty when there is nothing to scale', () => {
    expect(heatThresholds(0)).toEqual([]);
  });
});
