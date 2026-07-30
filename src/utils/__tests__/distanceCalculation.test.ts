import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  DISTANCE_OPTIONS,
} from "../distanceCalculation";

describe("calculateDistance", () => {
  it("returns 0 for identical points", () => {
    expect(calculateDistance(34.0522, -118.2437, 34.0522, -118.2437)).toBe(0);
  });

  it("is symmetric", () => {
    const a = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    const b = calculateDistance(34.0522, -118.2437, 40.7128, -74.006);
    expect(a).toBe(b);
  });

  it("computes NYC to LA at roughly 2445 miles", () => {
    const d = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(2400);
    expect(d).toBeLessThan(2500);
  });

  it("computes one degree of latitude at roughly 69 miles", () => {
    const d = calculateDistance(0, 0, 1, 0);
    expect(d).toBeCloseTo(69.1, 0);
  });

  it("handles antipodal points (half circumference)", () => {
    const d = calculateDistance(0, 0, 0, 180);
    expect(d).toBeCloseTo(Math.PI * 3959, 0);
  });

  it("rounds to one decimal place", () => {
    const d = calculateDistance(34.0522, -118.2437, 34.0722, -118.2537);
    expect(Number.isFinite(d)).toBe(true);
    expect(Math.round(d * 10) / 10).toBe(d);
  });

  it("handles negative coordinates across hemispheres", () => {
    const d = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    // Sydney to Melbourne ~443 miles
    expect(d).toBeGreaterThan(420);
    expect(d).toBeLessThan(465);
  });

  it("crosses the antimeridian correctly", () => {
    const d = calculateDistance(0, 179.5, 0, -179.5);
    expect(d).toBeCloseTo(69.1, 0);
  });
});

describe("DISTANCE_OPTIONS", () => {
  it("exposes five ascending options", () => {
    expect(DISTANCE_OPTIONS).toHaveLength(5);
    const values = DISTANCE_OPTIONS.map((o) => o.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values).toEqual([1, 3, 5, 10, 25]);
  });

  it("has a label and description for every option", () => {
    for (const option of DISTANCE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description).toContain("mile");
    }
  });
});
