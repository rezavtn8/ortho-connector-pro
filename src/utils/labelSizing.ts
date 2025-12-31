// Dynamic label sizing calculations based on label dimensions
export interface LabelDimensions {
  width: number;  // in inches
  height: number; // in inches
}

export interface CalculatedSizes {
  logoHeight: number;        // in pixels
  mainFontSize: number;      // in pixels
  returnFontSize: number;    // in pixels
  brandingFontSize: number;  // in pixels
  padding: number;           // in pixels
  spacing: number;           // in pixels
  maxLogoWidth: number;      // in pixels
  isLargeLabel: boolean;     // for two-zone layout
  logoZoneHeight: number;    // in pixels (for large labels)
}

const DPI = 96; // Screen DPI for preview

/**
 * Calculate optimal sizes for a label based on its physical dimensions
 * This ensures labels look proportional and professional at any size
 * 
 * Extended ranges for user customization:
 * - logoSizeMultiplier: 0.25 to 2.5 (default 1.0)
 * - fontSizeMultiplier: 0.5 to 2.0 (default 1.0)
 */
export function calculateOptimalSizes(
  dimensions: LabelDimensions,
  logoSizeMultiplier: number = 1.0,  // 0.25 to 2.5 range
  fontSizeMultiplier: number = 1.0   // 0.5 to 2.0 range
): CalculatedSizes {
  // Defensive checks for invalid dimensions
  const safeWidth = Math.max(0.5, dimensions?.width || 2.625);
  const safeHeight = Math.max(0.5, dimensions?.height || 1);
  const safeLogoMultiplier = Math.max(0.25, Math.min(2.5, logoSizeMultiplier || 1.0));
  const safeFontMultiplier = Math.max(0.5, Math.min(2.0, fontSizeMultiplier || 1.0));
  
  const widthPx = safeWidth * DPI;
  const heightPx = safeHeight * DPI;
  
  // Base calculations on the smaller dimension for consistency
  const baseDimension = Math.min(widthPx, heightPx);
  
  // Determine if this is a "large" label that benefits from two-zone layout
  const isLargeLabel = safeHeight >= 2.5; // 2.5" or taller
  
  // Logo sizing with enhanced range for large labels
  let baseLogoHeight: number;
  if (isLargeLabel) {
    // For large labels, logo can take up to 40% of height
    baseLogoHeight = heightPx * 0.35;
  } else if (heightPx >= 150) {
    // Medium-large labels
    baseLogoHeight = heightPx * 0.30;
  } else {
    // Standard labels: 20-25% of label height
    baseLogoHeight = heightPx * 0.25;
  }
  const logoHeight = Math.round(baseLogoHeight * safeLogoMultiplier);
  
  // Logo zone height for two-zone layout (large labels only)
  const logoZoneHeight = isLargeLabel ? Math.round(heightPx * 0.45) : 0;
  
  // Font sizing based on label size with extended ranges for large labels
  let baseFontSize: number;
  if (heightPx < 100) {
    // Small labels (< 1" high)
    baseFontSize = 9;
  } else if (heightPx < 150) {
    // Medium labels (1-1.5" high)
    baseFontSize = 11;
  } else if (heightPx < 240) {
    // Large labels (1.5-2.5" high)
    baseFontSize = 14;
  } else if (heightPx < 320) {
    // Extra large labels (2.5-3.33" high)
    baseFontSize = 16;
  } else {
    // Huge labels (> 3.33" high)
    baseFontSize = 18;
  }
  
  const mainFontSize = Math.round(baseFontSize * safeFontMultiplier);
  const returnFontSize = Math.round((baseFontSize - 2) * safeFontMultiplier);
  const brandingFontSize = Math.round((baseFontSize - 3) * safeFontMultiplier);
  
  // Spacing calculations - more generous for larger labels
  const paddingMultiplier = isLargeLabel ? 0.06 : 0.05;
  const spacingMultiplier = isLargeLabel ? 0.04 : 0.03;
  
  const padding = Math.max(4, Math.round(baseDimension * paddingMultiplier));
  const spacing = Math.max(3, Math.round(baseDimension * spacingMultiplier));
  
  // Max logo width: 80% for standard, 90% for large labels
  const maxLogoWidthPercent = isLargeLabel ? 0.90 : 0.80;
  const maxLogoWidth = Math.round(widthPx * maxLogoWidthPercent);
  
  return {
    logoHeight,
    mainFontSize,
    returnFontSize,
    brandingFontSize,
    padding,
    spacing,
    maxLogoWidth,
    isLargeLabel,
    logoZoneHeight
  };
}

/**
 * Get recommended ranges for user customization based on label size
 */
export function getCustomizationRanges(dimensions: LabelDimensions) {
  const heightPx = dimensions.height * DPI;
  const isLargeLabel = dimensions.height >= 2.5;
  
  return {
    logoMultiplier: {
      min: 0.25,
      max: 2.5,
      default: isLargeLabel ? 1.2 : 1.0,
      step: 0.05
    },
    fontMultiplier: {
      min: 0.5,
      max: 2.0,
      default: isLargeLabel ? 1.1 : 1.0,
      step: 0.05
    },
    description: heightPx < 100 
      ? "Small label - compact design"
      : heightPx < 150 
      ? "Medium label - balanced design"
      : heightPx < 240
      ? "Large label - spacious design"
      : "Extra large label - two-zone layout with prominent logo"
  };
}
