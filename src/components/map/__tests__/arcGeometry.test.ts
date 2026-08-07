import { describe, it, expect } from 'vitest';
import { buildArc, pointOnArc, project, unproject, POINTS, type LngLat } from '../arcGeometry';

const OFFICE: LngLat = [-122.42, 37.77];
const HUB: LngLat = [-122.2, 37.85];

/** Segment lengths measured in mercator space, where resampling is defined. */
function mercatorSegments(coords: Float64Array): number[] {
  const segs: number[] = [];
  for (let i = 0; i < coords.length / 2 - 1; i++) {
    const a = project(coords[i * 2], coords[i * 2 + 1]);
    const b = project(coords[(i + 1) * 2], coords[(i + 1) * 2 + 1]);
    segs.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return segs;
}

describe('project / unproject', () => {
  it('round-trips lng/lat', () => {
    for (const [lng, lat] of [[0, 0], [-122.42, 37.77], [151.2, -33.87], [10, 60]] as const) {
      const [x, y] = project(lng, lat);
      const [lng2, lat2] = unproject(x, y);
      expect(lng2).toBeCloseTo(lng, 9);
      expect(lat2).toBeCloseTo(lat, 9);
    }
  });

  it('puts the origin at the centre of the unit square', () => {
    const [x, y] = project(0, 0);
    expect(x).toBeCloseTo(0.5, 12);
    expect(y).toBeCloseTo(0.5, 12);
  });
});

describe('buildArc', () => {
  it('emits POINTS points in both representations', () => {
    const arc = buildArc(OFFICE, HUB);
    expect(arc.coords.length).toBe(POINTS * 2);
    expect(arc.line).toHaveLength(POINTS);
  });

  it('starts exactly at the office', () => {
    const arc = buildArc(OFFICE, HUB);
    expect(arc.coords[0]).toBeCloseTo(OFFICE[0], 9);
    expect(arc.coords[1]).toBeCloseTo(OFFICE[1], 9);
  });

  it('stops short of the hub so arcs do not knot at the centre', () => {
    const arc = buildArc(OFFICE, HUB);
    const endLng = arc.coords[(POINTS - 1) * 2];
    const endLat = arc.coords[(POINTS - 1) * 2 + 1];
    const gap = Math.hypot(endLng - HUB[0], endLat - HUB[1]);
    const chord = Math.hypot(HUB[0] - OFFICE[0], HUB[1] - OFFICE[1]);
    expect(gap).toBeGreaterThan(0); // never lands on the hub
    expect(gap).toBeLessThan(chord * 0.12); // but stays close to it
  });

  it('is resampled to equal arc-length spacing within 2%', () => {
    const segs = mercatorSegments(buildArc(OFFICE, HUB).coords);
    const mean = segs.reduce((s, v) => s + v, 0) / segs.length;
    for (const s of segs) {
      expect(Math.abs(s - mean) / mean).toBeLessThan(0.02);
    }
  });

  it('stays uniform for a long arc too', () => {
    const segs = mercatorSegments(buildArc([-122.4, 37.8], [-71.0, 42.4]).coords);
    const mean = segs.reduce((s, v) => s + v, 0) / segs.length;
    for (const s of segs) {
      expect(Math.abs(s - mean) / mean).toBeLessThan(0.02);
    }
  });

  it('bulges off the straight chord', () => {
    const arc = buildArc(OFFICE, HUB);
    const mid = Math.floor(POINTS / 2);
    const [mx, my] = [arc.coords[mid * 2], arc.coords[mid * 2 + 1]];
    const chordMid = [(OFFICE[0] + HUB[0]) / 2, (OFFICE[1] + HUB[1]) / 2];
    expect(Math.hypot(mx - chordMid[0], my - chordMid[1])).toBeGreaterThan(0.005);
  });

  it('produces the same normalized shape at low and high latitude', () => {
    // Same chord in mercator space at two very different latitudes: because the
    // Bezier is computed in mercator, the normalized curves must coincide.
    const shape = (lat: number) => {
      const a: LngLat = [0, lat];
      const b: LngLat = [0.5, lat];
      const arc = buildArc(a, b);
      const pa = project(a[0], a[1]);
      const pb = project(b[0], b[1]);
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      return Array.from({ length: POINTS }, (_, i) => {
        const p = project(arc.coords[i * 2], arc.coords[i * 2 + 1]);
        return [(p[0] - pa[0]) / len, (p[1] - pa[1]) / len];
      });
    };

    const low = shape(25);
    const high = shape(60);
    for (let i = 0; i < POINTS; i++) {
      expect(low[i][0]).toBeCloseTo(high[i][0], 6);
      expect(low[i][1]).toBeCloseTo(high[i][1], 6);
    }
  });

  it('curves the same way regardless of direction, never mirroring', () => {
    const sideOf = (from: LngLat, to: LngLat) => {
      const arc = buildArc(from, to);
      const mid = Math.floor(POINTS / 2);
      const a = project(from[0], from[1]);
      const b = project(to[0], to[1]);
      const m = project(arc.coords[mid * 2], arc.coords[mid * 2 + 1]);
      // Sign of the cross product => which side of the chord the apex sits on.
      return Math.sign((b[0] - a[0]) * (m[1] - a[1]) - (b[1] - a[1]) * (m[0] - a[0]));
    };
    expect(sideOf(OFFICE, HUB)).toBe(sideOf(HUB, OFFICE));
  });

  it('handles a degenerate chord without producing NaN', () => {
    const arc = buildArc(OFFICE, OFFICE);
    expect(arc.coords.length).toBe(POINTS * 2);
    for (const v of arc.coords) expect(Number.isFinite(v)).toBe(true);
  });

  it('takes a larger bulge when asked', () => {
    const apex = (bulge: number) => {
      const arc = buildArc(OFFICE, HUB, bulge);
      const mid = Math.floor(POINTS / 2);
      const chordMid = [(OFFICE[0] + HUB[0]) / 2, (OFFICE[1] + HUB[1]) / 2];
      return Math.hypot(arc.coords[mid * 2] - chordMid[0], arc.coords[mid * 2 + 1] - chordMid[1]);
    };
    expect(apex(0.4)).toBeGreaterThan(apex(0.1));
  });
});

describe('pointOnArc', () => {
  const arc = buildArc(OFFICE, HUB);
  const out: [number, number] = [0, 0];

  it('returns the first coordinate at p = 0', () => {
    pointOnArc(arc.coords, 0, out);
    expect(out[0]).toBeCloseTo(arc.coords[0], 12);
    expect(out[1]).toBeCloseTo(arc.coords[1], 12);
  });

  it('returns the last coordinate at p = 1', () => {
    pointOnArc(arc.coords, 1, out);
    expect(out[0]).toBeCloseTo(arc.coords[(POINTS - 1) * 2], 12);
    expect(out[1]).toBeCloseTo(arc.coords[(POINTS - 1) * 2 + 1], 12);
  });

  it('clamps out-of-range progress instead of producing garbage', () => {
    pointOnArc(arc.coords, -0.5, out);
    expect(out[0]).toBeCloseTo(arc.coords[0], 12);
    pointOnArc(arc.coords, 1.5, out);
    expect(out[0]).toBeCloseTo(arc.coords[(POINTS - 1) * 2], 12);
  });

  it('advances monotonically along the arc', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      pointOnArc(arc.coords, i / 100, out);
      const d = Math.hypot(out[0] - OFFICE[0], out[1] - OFFICE[1]);
      expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = d;
    }
  });

  it('travels in roughly equal steps for equal progress steps', () => {
    const steps: number[] = [];
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0, 0];
    for (let i = 0; i < 40; i++) {
      pointOnArc(arc.coords, i / 40, a);
      pointOnArc(arc.coords, (i + 1) / 40, b);
      steps.push(Math.hypot(...(project(b[0], b[1]).map((v, k) => v - project(a[0], a[1])[k]) as [number, number])));
    }
    const mean = steps.reduce((s, v) => s + v, 0) / steps.length;
    for (const s of steps) expect(Math.abs(s - mean) / mean).toBeLessThan(0.05);
  });
});
