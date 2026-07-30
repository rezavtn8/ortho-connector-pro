import { describe, it, expect } from "vitest";
import {
  calculateOptimalSizes,
  getCustomizationRanges,
  type LabelDimensions,
} from "../labelSizing";

const STANDARD: LabelDimensions = { width: 2.625, height: 1 }; // Avery 5160
const SHIPPING: LabelDimensions = { width: 4, height: 3.333 };

describe("calculateOptimalSizes", () => {
  it("computes standard label sizes", () => {
    const s = calculateOptimalSizes(STANDARD);
    expect(s.isLargeLabel).toBe(false);
    expect(s.logoZoneHeight).toBe(0);
    expect(s.logoHeight).toBe(Math.round(96 * 0.25));
    expect(s.mainFontSize).toBe(9); // heightPx = 96 < 100
    expect(s.returnFontSize).toBe(7);
    expect(s.brandingFontSize).toBe(6);
    expect(s.maxLogoWidth).toBe(Math.round(2.625 * 96 * 0.8));
  });

  it("flags labels 2.5in or taller as large and enables the logo zone", () => {
    const s = calculateOptimalSizes(SHIPPING);
    expect(s.isLargeLabel).toBe(true);
    expect(s.logoZoneHeight).toBe(Math.round(3.333 * 96 * 0.45));
    expect(s.logoHeight).toBe(Math.round(3.333 * 96 * 0.35));
  });

  it("uses 2.5in exactly as the large-label boundary", () => {
    expect(calculateOptimalSizes({ width: 4, height: 2.49 }).isLargeLabel).toBe(false);
    expect(calculateOptimalSizes({ width: 4, height: 2.5 }).isLargeLabel).toBe(true);
  });

  it("steps the base font size across height buckets", () => {
    const font = (h: number) => calculateOptimalSizes({ width: 4, height: h }).mainFontSize;
    expect(font(0.9)).toBe(9); // 86px  < 100
    expect(font(1.3)).toBe(11); // 125px < 150
    expect(font(2)).toBe(14); // 192px < 240
    expect(font(3)).toBe(16); // 288px < 320
    expect(font(4)).toBe(18); // 384px
  });

  it("scales logo height with the logo multiplier", () => {
    const base = calculateOptimalSizes(STANDARD, 1).logoHeight;
    const doubled = calculateOptimalSizes(STANDARD, 2).logoHeight;
    expect(doubled).toBe(Math.round(base * 2));
  });

  it("clamps the logo multiplier to [0.25, 2.5]", () => {
    const low = calculateOptimalSizes(STANDARD, 0.01).logoHeight;
    const high = calculateOptimalSizes(STANDARD, 99).logoHeight;
    expect(low).toBe(calculateOptimalSizes(STANDARD, 0.25).logoHeight);
    expect(high).toBe(calculateOptimalSizes(STANDARD, 2.5).logoHeight);
  });

  it("clamps the font multiplier to [0.5, 2.0]", () => {
    const low = calculateOptimalSizes(STANDARD, 1, 0.01).mainFontSize;
    const high = calculateOptimalSizes(STANDARD, 1, 99).mainFontSize;
    expect(low).toBe(calculateOptimalSizes(STANDARD, 1, 0.5).mainFontSize);
    expect(high).toBe(calculateOptimalSizes(STANDARD, 1, 2).mainFontSize);
  });

  it("keeps a font hierarchy of main > return > branding", () => {
    const s = calculateOptimalSizes(SHIPPING);
    expect(s.mainFontSize).toBeGreaterThan(s.returnFontSize);
    expect(s.returnFontSize).toBeGreaterThan(s.brandingFontSize);
  });

  it("enforces minimum padding and spacing", () => {
    const s = calculateOptimalSizes({ width: 0.5, height: 0.5 });
    expect(s.padding).toBeGreaterThanOrEqual(4);
    expect(s.spacing).toBeGreaterThanOrEqual(3);
  });

  it("falls back to defaults for missing or zero dimensions", () => {
    const fallback = calculateOptimalSizes(
      undefined as unknown as LabelDimensions
    );
    expect(fallback).toEqual(calculateOptimalSizes(STANDARD));

    const zeroed = calculateOptimalSizes({ width: 0, height: 0 });
    expect(zeroed).toEqual(calculateOptimalSizes(STANDARD));
  });

  it("clamps sub-minimum dimensions to 0.5in", () => {
    const tiny = calculateOptimalSizes({ width: 0.1, height: 0.1 });
    const min = calculateOptimalSizes({ width: 0.5, height: 0.5 });
    expect(tiny).toEqual(min);
  });

  it("uses a wider max logo width on large labels", () => {
    expect(calculateOptimalSizes(SHIPPING).maxLogoWidth).toBe(
      Math.round(4 * 96 * 0.9)
    );
    expect(calculateOptimalSizes({ width: 4, height: 2 }).maxLogoWidth).toBe(
      Math.round(4 * 96 * 0.8)
    );
  });
});

describe("getCustomizationRanges", () => {
  it("returns standard defaults for small labels", () => {
    const r = getCustomizationRanges(STANDARD);
    expect(r.logoMultiplier).toEqual({ min: 0.25, max: 2.5, default: 1.0, step: 0.05 });
    expect(r.fontMultiplier).toEqual({ min: 0.5, max: 2.0, default: 1.0, step: 0.05 });
    expect(r.description).toBe("Small label - compact design");
  });

  it("raises defaults for large labels", () => {
    const r = getCustomizationRanges(SHIPPING);
    expect(r.logoMultiplier.default).toBe(1.2);
    expect(r.fontMultiplier.default).toBe(1.1);
    expect(r.description).toBe(
      "Extra large label - two-zone layout with prominent logo"
    );
  });

  it("describes each height bucket", () => {
    const desc = (h: number) => getCustomizationRanges({ width: 4, height: h }).description;
    expect(desc(1.3)).toBe("Medium label - balanced design");
    expect(desc(2)).toBe("Large label - spacious design");
  });

  it("keeps the multiplier ranges consistent with calculateOptimalSizes clamps", () => {
    const r = getCustomizationRanges(STANDARD);
    const atMax = calculateOptimalSizes(STANDARD, r.logoMultiplier.max);
    const beyondMax = calculateOptimalSizes(STANDARD, r.logoMultiplier.max + 1);
    expect(atMax.logoHeight).toBe(beyondMax.logoHeight);
  });
});
