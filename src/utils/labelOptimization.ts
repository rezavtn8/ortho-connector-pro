import { LabelDimensions, calculateOptimalSizes } from './labelSizing';

export type LogoPosition = "top-left" | "top-center" | "top-right" | "center";
export type ReturnAddressPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface OptimizedLayout {
  logoPosition: LogoPosition;
  returnAddressPosition: ReturnAddressPosition;
  logoSizeMultiplier: number;
  fontSizeMultiplier: number;
  showFromLabel: boolean;
  showToLabel: boolean;
  reasoning: string;
}

/**
 * Phase 1: Intelligent Layout Selection
 * Automatically determines the best positions for all elements based on label dimensions
 */
function selectOptimalLayout(dimensions: LabelDimensions, hasLogo: boolean, hasReturnAddress: boolean): OptimizedLayout {
  const aspectRatio = dimensions.width / dimensions.height;
  const heightPx = dimensions.height * 96;
  
  let layout: OptimizedLayout;
  
  // Small vertical labels (< 1.2" tall, narrow)
  if (heightPx < 115 && aspectRatio < 2.5) {
    layout = {
      logoPosition: "top-center",
      returnAddressPosition: "top-left",
      logoSizeMultiplier: 0.8,
      fontSizeMultiplier: 0.9,
      showFromLabel: false,
      showToLabel: false,
      reasoning: "Compact layout - centered logo, minimal labels"
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
      reasoning: "Balanced layout - logo right, return address left, with labels"
    };
  }
  // Large labels (2" or taller)
  else if (heightPx >= 180) {
    layout = {
      logoPosition: "top-center",
      returnAddressPosition: "bottom-left",
      logoSizeMultiplier: 1.2,
      fontSizeMultiplier: 1.1,
      showFromLabel: true,
      showToLabel: true,
      reasoning: "Spacious layout - prominent centered logo, separated return address"
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
      reasoning: "Wide layout - logo left, return address opposite corner"
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
      reasoning: "Standard layout - classic opposing corners"
    };
  }
  
  // Adjust if no logo
  if (!hasLogo) {
    layout.returnAddressPosition = "top-left";
  }
  
  // Adjust if no return address
  if (!hasReturnAddress) {
    layout.logoPosition = "top-center";
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
  if (totalArea > 30000 && !hasLogo) {
    sizeAdjustment += 0.15;
  } else if (totalArea > 25000) {
    sizeAdjustment += 0.1;
  }
  
  // Very small labels need smaller everything
  if (heightPx < 80) {
    sizeAdjustment -= 0.2;
  }
  
  return {
    ...layout,
    logoSizeMultiplier: Math.max(0.6, Math.min(1.4, layout.logoSizeMultiplier + sizeAdjustment)),
    fontSizeMultiplier: Math.max(0.8, Math.min(1.2, layout.fontSizeMultiplier + sizeAdjustment * 0.5)),
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
  const size = dimensions.height < 1.2 ? "small" : dimensions.height < 2 ? "medium" : "large";
  const aspectRatio = dimensions.width / dimensions.height;
  const shape = aspectRatio < 1.5 ? "square" : aspectRatio < 2.5 ? "rectangular" : "wide";
  
  return `Auto-optimized for ${size} ${shape} labels (${dimensions.width}" × ${dimensions.height}"): ${layout.reasoning}`;
}
