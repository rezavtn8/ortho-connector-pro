import { LabelDimensions, calculateOptimalSizes } from './labelSizing';

export type LogoPosition = "top-left" | "top-center" | "top-right" | "center" | "top-half";
export type ReturnAddressPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface OptimizedLayout {
  logoPosition: LogoPosition;
  returnAddressPosition: ReturnAddressPosition;
  logoSizeMultiplier: number;
  fontSizeMultiplier: number;
  showFromLabel: boolean;
  showToLabel: boolean;
  reasoning: string;
  useTwoZoneLayout: boolean; // For large labels with logo in top half
}

/**
 * Phase 1: Intelligent Layout Selection
 * Automatically determines the best positions for all elements based on label dimensions
 */
function selectOptimalLayout(dimensions: LabelDimensions, hasLogo: boolean, hasReturnAddress: boolean): OptimizedLayout {
  const aspectRatio = dimensions.width / dimensions.height;
  const heightPx = dimensions.height * 96;
  
  let layout: OptimizedLayout;
  
  // Extra large shipping labels (>= 2.5" tall, like 3-1/3" x 4")
  if (heightPx >= 240 && hasLogo) {
    layout = {
      logoPosition: "top-half",
      returnAddressPosition: "bottom-left",
      logoSizeMultiplier: 1.5,
      fontSizeMultiplier: 1.2,
      showFromLabel: true,
      showToLabel: true,
      reasoning: "Two-zone layout - prominent logo in top half, address below",
      useTwoZoneLayout: true
    };
  }
  // Large labels (2" to 2.5" tall)
  else if (heightPx >= 180 && heightPx < 240) {
    layout = {
      logoPosition: "top-center",
      returnAddressPosition: "bottom-left",
      logoSizeMultiplier: 1.3,
      fontSizeMultiplier: 1.15,
      showFromLabel: true,
      showToLabel: true,
      reasoning: "Spacious layout - prominent centered logo, separated return address",
      useTwoZoneLayout: false
    };
  }
  // Small vertical labels (< 1.2" tall, narrow)
  else if (heightPx < 115 && aspectRatio < 2.5) {
    layout = {
      logoPosition: "top-center",
      returnAddressPosition: "top-left",
      logoSizeMultiplier: 0.8,
      fontSizeMultiplier: 0.9,
      showFromLabel: false,
      showToLabel: false,
      reasoning: "Compact layout - centered logo, minimal labels",
      useTwoZoneLayout: false
    };
  }
  // Medium square-ish labels (1.5" to 2" tall, balanced width)
  else if (heightPx >= 115 && heightPx < 180 && aspectRatio >= 1.5 && aspectRatio < 2.5) {
    layout = {
      logoPosition: hasReturnAddress ? "top-right" : "top-center",
      returnAddressPosition: "top-left",
      logoSizeMultiplier: 1.0,
      fontSizeMultiplier: 1.0,
      showFromLabel: true,
      showToLabel: true,
      reasoning: "Balanced layout - logo right, return address left, with labels",
      useTwoZoneLayout: false
    };
  }
  // Wide horizontal labels
  else if (aspectRatio >= 2.5) {
    layout = {
      logoPosition: "top-left",
      returnAddressPosition: "bottom-right",
      logoSizeMultiplier: 0.9,
      fontSizeMultiplier: 0.95,
      showFromLabel: false,
      showToLabel: true,
      reasoning: "Wide layout - logo left, return address opposite corner",
      useTwoZoneLayout: false
    };
  }
  // Default fallback
  else {
    layout = {
      logoPosition: "top-left",
      returnAddressPosition: "top-right",
      logoSizeMultiplier: 1.0,
      fontSizeMultiplier: 1.0,
      showFromLabel: true,
      showToLabel: true,
      reasoning: "Standard layout - classic opposing corners",
      useTwoZoneLayout: false
    };
  }
  
  // Adjust if no logo
  if (!hasLogo) {
    layout.returnAddressPosition = "top-left";
    layout.useTwoZoneLayout = false;
  }
  
  // Adjust if no return address
  if (!hasReturnAddress) {
    layout.logoPosition = hasLogo && heightPx >= 240 ? "top-half" : "top-center";
  }
  
  return layout;
}

/**
 * Phase 2: Content-Aware Sizing
 * Adjusts sizing based on content density and label real estate
 */
function optimizeSizing(
  dimensions: LabelDimensions, 
  layout: OptimizedLayout,
  hasLogo: boolean,
  returnAddressLines: number
): OptimizedLayout {
  const heightPx = dimensions.height * 96;
  const widthPx = dimensions.width * 96;
  const totalArea = heightPx * widthPx;
  
  let sizeAdjustment = 0;
  
  // Reduce sizes if content is dense
  if (hasLogo && returnAddressLines > 3) {
    sizeAdjustment -= 0.15;
  } else if (hasLogo && returnAddressLines > 2) {
    sizeAdjustment -= 0.1;
  }
  
  // Increase sizes if lots of space available
  if (totalArea > 50000 && !hasLogo) {
    // Extra large labels without logo
    sizeAdjustment += 0.25;
  } else if (totalArea > 35000 && !hasLogo) {
    sizeAdjustment += 0.2;
  } else if (totalArea > 30000 && !hasLogo) {
    sizeAdjustment += 0.15;
  } else if (totalArea > 25000) {
    sizeAdjustment += 0.1;
  }
  
  // Very small labels need smaller everything
  if (heightPx < 80) {
    sizeAdjustment -= 0.2;
  }
  
  // For two-zone layout, boost logo size further
  if (layout.useTwoZoneLayout) {
    return {
      ...layout,
      logoSizeMultiplier: Math.max(0.8, Math.min(2.0, layout.logoSizeMultiplier + sizeAdjustment)),
      fontSizeMultiplier: Math.max(0.6, Math.min(1.8, layout.fontSizeMultiplier + sizeAdjustment * 0.5)),
    };
  }
  
  return {
    ...layout,
    logoSizeMultiplier: Math.max(0.6, Math.min(1.5, layout.logoSizeMultiplier + sizeAdjustment)),
    fontSizeMultiplier: Math.max(0.8, Math.min(1.4, layout.fontSizeMultiplier + sizeAdjustment * 0.5)),
  };
}

/**
 * Phase 3: Conflict Resolution & Polish
 * Ensures elements don't overlap and adjusts for edge cases
 */
function resolveLayoutConflicts(
  dimensions: LabelDimensions,
  layout: OptimizedLayout,
  hasLogo: boolean,
  hasReturnAddress: boolean
): OptimizedLayout {
  const heightPx = dimensions.height * 96;
  
  // Two-zone layout doesn't have overlap issues
  if (layout.useTwoZoneLayout) {
    return layout;
  }
  
  // Check for potential overlaps with top-positioned elements
  if (layout.logoPosition === "top-center" && layout.returnAddressPosition === "top-left") {
    // If label is too narrow, move return address to bottom
    if (dimensions.width < 3) {
      layout.returnAddressPosition = "bottom-left";
      layout.reasoning += " (Moved return address to avoid overlap)";
    }
  }
  
  if (layout.logoPosition === "top-left" && layout.returnAddressPosition === "top-left") {
    // Same corner conflict
    layout.returnAddressPosition = "top-right";
    layout.reasoning += " (Separated conflicting elements)";
  }
  
  // On very small labels, remove redundant labels
  if (heightPx < 90) {
    layout.showFromLabel = false;
    layout.showToLabel = false;
  }
  
  // Ensure branding doesn't conflict with bottom elements
  if (layout.returnAddressPosition.includes("bottom")) {
    // Reduce bottom spacing for branding
    layout.fontSizeMultiplier = Math.max(0.85, layout.fontSizeMultiplier - 0.05);
  }
  
  return layout;
}

/**
 * Main optimization function - combines all 3 phases
 */
export function optimizeLabelLayout(
  dimensions: LabelDimensions,
  hasLogo: boolean,
  hasReturnAddress: boolean,
  returnAddressText?: string
): OptimizedLayout {
  const returnAddressLines = returnAddressText ? returnAddressText.split('\n').length : 0;
  
  // Phase 1: Select optimal layout
  let layout = selectOptimalLayout(dimensions, hasLogo, hasReturnAddress);
  
  // Phase 2: Optimize sizing based on content
  layout = optimizeSizing(dimensions, layout, hasLogo, returnAddressLines);
  
  // Phase 3: Resolve conflicts and polish
  layout = resolveLayoutConflicts(dimensions, layout, hasLogo, hasReturnAddress);
  
  return layout;
}

/**
 * Get human-readable explanation of the optimization
 */
export function explainOptimization(dimensions: LabelDimensions, layout: OptimizedLayout): string {
  const heightPx = dimensions.height * 96;
  let size: string;
  if (heightPx < 115) {
    size = "small";
  } else if (heightPx < 180) {
    size = "medium";
  } else if (heightPx < 240) {
    size = "large";
  } else {
    size = "extra large shipping";
  }
  
  const aspectRatio = dimensions.width / dimensions.height;
  const shape = aspectRatio < 1.5 ? "square" : aspectRatio < 2.5 ? "rectangular" : "wide";
  
  if (layout.useTwoZoneLayout) {
    return `Auto-optimized for ${size} ${shape} labels (${dimensions.width}" × ${dimensions.height}"): Logo zone in top half, address zone below`;
  }
  
  return `Auto-optimized for ${size} ${shape} labels (${dimensions.width}" × ${dimensions.height}"): ${layout.reasoning}`;
}
