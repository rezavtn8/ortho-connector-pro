import { describe, it, expect } from "vitest";
import {
  calculateLabelLayout,
  getDefaultLayoutOptions,
  getLayoutPixelValues,
  suggestOptimalSettings,
  type LabelDimensions,
  type LayoutOptions,
} from "../labelLayoutEngine";

const DPI = 96;
const STANDARD: LabelDimensions = { width: 2.625, height: 1 };
const SHIPPING: LabelDimensions = { width: 4, height: 3.333 };

const opts = (overrides: Partial<LayoutOptions> = {}): LayoutOptions => ({
  ...getDefaultLayoutOptions(),
  ...overrides,
});

describe("getDefaultLayoutOptions", () => {
  it("returns sane defaults", () => {
    const d = getDefaultLayoutOptions();
    expect(d.showLogo).toBe(false);
    expect(d.showFromAddress).toBe(false);
    expect(d.showToLabel).toBe(true);
    expect(d.layoutMode).toBe("auto");
    expect(d.toAlignment).toBe("center");
    expect(d.lineSpacing).toBe("normal");
  });

  it("returns a fresh object each call", () => {
    const a = getDefaultLayoutOptions();
    const b = getDefaultLayoutOptions();
    expect(a).not.toBe(b);
    a.showLogo = true;
    expect(b.showLogo).toBe(false);
  });
});

describe("calculateLabelLayout - zones", () => {
  it("emits only a 'to' zone with default options", () => {
    const layout = calculateLabelLayout(STANDARD, opts());
    expect(layout.zones.map((z) => z.type)).toEqual(["to"]);
    expect(layout.labelHeightPx).toBeCloseTo(96);
  });

  it("emits zones in visual order: logo, from, branding, to", () => {
    const layout = calculateLabelLayout(
      SHIPPING,
      opts({ showLogo: true, showFromAddress: true, showBranding: true }),
      3
    );
    expect(layout.zones.map((z) => z.type)).toEqual([
      "logo",
      "from",
      "branding",
      "to",
    ]);
  });

  it("stacks logo above from above to without overlap", () => {
    const layout = calculateLabelLayout(
      SHIPPING,
      opts({ showLogo: true, showFromAddress: true }),
      2
    );
    const logo = layout.zones.find((z) => z.type === "logo")!;
    const from = layout.zones.find((z) => z.type === "from")!;
    const to = layout.zones.find((z) => z.type === "to")!;
    expect(from.top).toBeGreaterThanOrEqual(logo.top + logo.height);
    expect(to.top).toBeGreaterThanOrEqual(from.top + from.height);
  });

  it("places the branding zone near the bottom", () => {
    const layout = calculateLabelLayout(SHIPPING, opts({ showBranding: true }));
    const branding = layout.zones.find((z) => z.type === "branding")!;
    expect(branding.top + branding.height).toBeLessThanOrEqual(100);
    expect(branding.top).toBeGreaterThan(70);
  });

  it("reserves space so the 'to' zone stops above branding", () => {
    const withBranding = calculateLabelLayout(SHIPPING, opts({ showBranding: true }));
    const without = calculateLabelLayout(SHIPPING, opts({ showBranding: false }));
    const toWith = withBranding.zones.find((z) => z.type === "to")!;
    const toWithout = without.zones.find((z) => z.type === "to")!;
    expect(toWith.height).toBeLessThan(toWithout.height);
  });

  it("honors the requested to-alignment", () => {
    for (const align of ["left", "center", "right"] as const) {
      const layout = calculateLabelLayout(STANDARD, opts({ toAlignment: align }));
      expect(layout.zones.find((z) => z.type === "to")!.align).toBe(align);
    }
  });

  it("positions the from zone left or right based on fromPosition", () => {
    const left = calculateLabelLayout(
      SHIPPING,
      opts({ showFromAddress: true, fromPosition: "top-left" }),
      2
    ).zones.find((z) => z.type === "from")!;
    const right = calculateLabelLayout(
      SHIPPING,
      opts({ showFromAddress: true, fromPosition: "top-right" }),
      2
    ).zones.find((z) => z.type === "from")!;
    expect(left.left).toBe(2);
    expect(left.align).toBe("left");
    expect(right.left).toBe(50);
    expect(right.align).toBe("right");
  });

  it("caps the from address at 3 rendered lines", () => {
    const three = calculateLabelLayout(
      SHIPPING,
      opts({ showFromAddress: true }),
      3
    ).zones.find((z) => z.type === "from")!;
    const ten = calculateLabelLayout(
      SHIPPING,
      opts({ showFromAddress: true }),
      10
    ).zones.find((z) => z.type === "from")!;
    expect(ten.height).toBe(three.height);
  });
});

describe("calculateLabelLayout - fonts and spacing", () => {
  it("scales the main font with the font multiplier", () => {
    const base = calculateLabelLayout(SHIPPING, opts({ fontSizeMultiplier: 1 }));
    const big = calculateLabelLayout(SHIPPING, opts({ fontSizeMultiplier: 1.5 }));
    const baseFont = base.zones.find((z) => z.type === "to")!.fontSize;
    const bigFont = big.zones.find((z) => z.type === "to")!.fontSize;
    expect(bigFont).toBeGreaterThan(baseFont);
  });

  it("clamps the font multiplier to [0.5, 2.0]", () => {
    const low = calculateLabelLayout(SHIPPING, opts({ fontSizeMultiplier: 0.1 }));
    const atLow = calculateLabelLayout(SHIPPING, opts({ fontSizeMultiplier: 0.5 }));
    const high = calculateLabelLayout(SHIPPING, opts({ fontSizeMultiplier: 50 }));
    const atHigh = calculateLabelLayout(SHIPPING, opts({ fontSizeMultiplier: 2 }));
    const font = (l: ReturnType<typeof calculateLabelLayout>) =>
      l.zones.find((z) => z.type === "to")!.fontSize;
    expect(font(low)).toBe(font(atLow));
    expect(font(high)).toBe(font(atHigh));
  });

  it("increases line height with looser spacing", () => {
    const lh = (spacing: "compact" | "normal" | "relaxed") =>
      calculateLabelLayout(SHIPPING, opts({ lineSpacing: spacing })).zones.find(
        (z) => z.type === "to"
      )!.lineHeight;
    expect(lh("compact")).toBeLessThan(lh("normal"));
    expect(lh("normal")).toBeLessThan(lh("relaxed"));
  });

  it("steps the base font size across label height buckets", () => {
    const font = (h: number) =>
      calculateLabelLayout({ width: 4, height: h }, opts()).zones.find(
        (z) => z.type === "to"
      )!.fontSize;
    expect(font(0.7)).toBe(8); // 67px  < 80
    expect(font(1)).toBe(10); // 96px  < 120
    expect(font(1.5)).toBe(12); // 144px < 180
    expect(font(2.5)).toBe(14); // 240px < 260
    expect(font(3.5)).toBe(16); // 336px < 350
    expect(font(4)).toBe(18); // 384px
  });
});

describe("calculateLabelLayout - two-zone mode", () => {
  it("uses two-zone automatically for tall labels with a logo", () => {
    expect(
      calculateLabelLayout(SHIPPING, opts({ showLogo: true })).useTwoZoneLayout
    ).toBe(true);
  });

  it("does not use two-zone for tall labels without a logo", () => {
    expect(
      calculateLabelLayout(SHIPPING, opts({ showLogo: false })).useTwoZoneLayout
    ).toBe(false);
  });

  it("does not use two-zone for short labels", () => {
    expect(
      calculateLabelLayout(STANDARD, opts({ showLogo: true })).useTwoZoneLayout
    ).toBe(false);
  });

  it("forces two-zone in stacked mode and disables it in split mode", () => {
    expect(
      calculateLabelLayout(STANDARD, opts({ layoutMode: "stacked" })).useTwoZoneLayout
    ).toBe(true);
    expect(
      calculateLabelLayout(SHIPPING, opts({ layoutMode: "split", showLogo: true }))
        .useTwoZoneLayout
    ).toBe(false);
  });

  it("gives the logo more height in two-zone than in split mode", () => {
    const stacked = calculateLabelLayout(
      SHIPPING,
      opts({ showLogo: true, layoutMode: "stacked" })
    ).zones.find((z) => z.type === "logo")!;
    const split = calculateLabelLayout(
      SHIPPING,
      opts({ showLogo: true, layoutMode: "split" })
    ).zones.find((z) => z.type === "logo")!;
    expect(stacked.height).toBeGreaterThan(split.height);
  });
});

describe("calculateLabelLayout - overflow and auto-adjust", () => {
  it("reports no overflow for a simple short address on a big label", () => {
    const layout = calculateLabelLayout(SHIPPING, opts(), 0, 3);
    expect(layout.hasOverflow).toBe(false);
    expect(layout.description).not.toContain("overflow");
  });

  it("reports overflow when content cannot fit and there is no logo to shrink", () => {
    const layout = calculateLabelLayout(STANDARD, opts(), 0, 30);
    expect(layout.hasOverflow).toBe(true);
    expect(layout.description).toContain("overflow");
  });

  it("auto-reduces the logo when content overflows", () => {
    const layout = calculateLabelLayout(
      { width: 2.625, height: 1 },
      opts({ showLogo: true, logoSizeMultiplier: 2.5 }),
      0,
      12
    );
    expect(layout.description).toContain("logo auto-reduced");
  });

  it("stops auto-adjusting after 4 attempts instead of recursing forever", () => {
    const layout = calculateLabelLayout(
      { width: 2.625, height: 1 },
      opts({ showLogo: true, logoSizeMultiplier: 2.5, fontSizeMultiplier: 2 }),
      3,
      40
    );
    expect(layout.hasOverflow).toBe(true);
    // 1 - 0.75^4 = 68.4% -> 68
    expect(layout.description).toContain("logo auto-reduced 68%");
  });

  it("always reports a positive label height", () => {
    const layout = calculateLabelLayout(SHIPPING, opts());
    expect(layout.labelHeightPx).toBeCloseTo(3.333 * DPI);
    expect(layout.totalContentHeight).toBeGreaterThan(0);
  });
});

describe("calculateLabelLayout - description", () => {
  it("describes a to-only label", () => {
    expect(calculateLabelLayout(STANDARD, opts()).description).toContain(
      "Centered: To address only"
    );
  });

  it("describes a flow layout", () => {
    const d = calculateLabelLayout(
      STANDARD,
      opts({ showLogo: true, showFromAddress: true }),
      2,
      2
    ).description;
    expect(d).toContain("Logo →");
    expect(d).toContain("From →");
  });

  it("describes a stacked layout", () => {
    const d = calculateLabelLayout(
      SHIPPING,
      opts({ showLogo: true, layoutMode: "stacked" })
    ).description;
    expect(d).toContain("Stacked layout");
  });
});

describe("getLayoutPixelValues", () => {
  it("converts zone percentages to pixels", () => {
    const layout = calculateLabelLayout(SHIPPING, opts({ showBranding: true }));
    const px = getLayoutPixelValues(SHIPPING, layout);
    expect(px.widthPx).toBeCloseTo(4 * DPI);
    expect(px.heightPx).toBeCloseTo(3.333 * DPI);
    expect(px.zones).toHaveLength(layout.zones.length);

    px.zones.forEach((zone, i) => {
      const src = layout.zones[i];
      expect(zone.topPx).toBeCloseTo((src.top / 100) * px.heightPx);
      expect(zone.leftPx).toBeCloseTo((src.left / 100) * px.widthPx);
      expect(zone.widthPx).toBeCloseTo((src.width / 100) * px.widthPx);
      expect(zone.heightPx).toBeCloseTo((src.height / 100) * px.heightPx);
    });
  });

  it("preserves non-geometric zone fields", () => {
    const layout = calculateLabelLayout(SHIPPING, opts({ toAlignment: "left" }));
    const px = getLayoutPixelValues(SHIPPING, layout);
    const to = px.zones.find((z) => z.type === "to")!;
    expect(to.align).toBe("left");
    expect(to.visible).toBe(true);
    expect(to.fontSize).toBeGreaterThan(0);
  });
});

describe("suggestOptimalSettings", () => {
  it("suggests split for wide labels with logo and from address", () => {
    const s = suggestOptimalSettings({ width: 4, height: 1 }, true, true);
    expect(s.layoutMode).toBe("split");
  });

  it("suggests stacked for large labels with a logo", () => {
    const s = suggestOptimalSettings({ width: 4, height: 3.333 }, true, false);
    expect(s.layoutMode).toBe("stacked");
    expect(s.logoSizeMultiplier).toBe(1.5);
  });

  it("suggests a smaller logo multiplier when a from address is present", () => {
    const s = suggestOptimalSettings({ width: 4, height: 3.333 }, true, true);
    expect(s.logoSizeMultiplier).toBe(1.2);
  });

  it("increases font size on roomy labels with no logo or from address", () => {
    const s = suggestOptimalSettings({ width: 4, height: 3.333 }, false, false);
    expect(s.fontSizeMultiplier).toBe(1.3);
    expect(s.lineSpacing).toBe("relaxed");
    expect(s.layoutMode).toBe("auto");
  });

  it("compacts small labels and hides the to/from labels", () => {
    const s = suggestOptimalSettings({ width: 2.625, height: 0.9 }, false, false);
    expect(s.fontSizeMultiplier).toBe(0.9);
    expect(s.logoSizeMultiplier).toBe(0.7);
    expect(s.lineSpacing).toBe("compact");
    expect(s.showFromLabel).toBe(false);
    expect(s.showToLabel).toBe(false);
  });

  it("keeps labels visible on non-small labels", () => {
    const s = suggestOptimalSettings({ width: 4, height: 2 }, false, false);
    expect(s.showFromLabel).toBe(true);
    expect(s.showToLabel).toBe(true);
    expect(s.toAlignment).toBe("center");
    expect(s.fromPosition).toBe("top-left");
  });

  it("produces suggestions that are valid layout options", () => {
    const suggestion = suggestOptimalSettings(SHIPPING, true, true);
    const layout = calculateLabelLayout(SHIPPING, opts(suggestion), 3, 4);
    expect(layout.zones.length).toBeGreaterThan(0);
  });
});
