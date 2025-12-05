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
}

const DPI = 96; // Screen DPI for preview

/**
 * Calculate optimal sizes for a label based on its physical dimensions
 * This ensures labels look proportional and professional at any size
 */
export function calculateOptimalSizes(
  dimensions: LabelDimensions,
  logoSizeMultiplier: number = 1.0,  // 0.5 to 1.5 range
  fontSizeMultiplier: number = 1.0   // 0.8 to 1.2 range
): CalculatedSizes {
  // Defensive checks for invalid dimensions
  const safeWidth = Math.max(0.5, dimensions?.width || 2.625);
  const safeHeight = Math.max(0.5, dimensions?.height || 1);
  const safeLogoMultiplier = Math.max(0.5, Math.min(1.5, logoSizeMultiplier || 1.0));
  const safeFontMultiplier = Math.max(0.8, Math.min(1.2, fontSizeMultiplier || 1.0));
  
  const widthPx = safeWidth * DPI;
  const heightPx = safeHeight * DPI;
  
  // Base calculations on the smaller dimension for consistency
  const baseDimension = Math.min(widthPx, heightPx);
  
  // Logo sizing: 20-35% of label height, scaled by multiplier
  const baseLogoHeight = heightPx * 0.25;
  const logoHeight = Math.round(baseLogoHeight * safeLogoMultiplier);
  
  // Font sizing based on label size with smart scaling
  let baseFontSize: number;
  if (heightPx < 100) {
    // Small labels (< 1" high)
    baseFontSize = 9;
  } else if (heightPx < 150) {
    // Medium labels (1-1.5" high)
    baseFontSize = 11;
  } else {
    // Large labels (> 1.5" high)
    baseFontSize = 13;
  }
  
  const mainFontSize = Math.round(baseFontSize * safeFontMultiplier);
  const returnFontSize = Math.round((baseFontSize - 2) * safeFontMultiplier);
  const brandingFontSize = Math.round((baseFontSize - 3) * safeFontMultiplier);
  
  // Spacing calculations
  const padding = Math.max(4, Math.round(baseDimension * 0.05));
  const spacing = Math.max(3, Math.round(baseDimension * 0.03));
  
  // Max logo width: 80% of label width
  const maxLogoWidth = Math.round(widthPx * 0.8);
  
  return {
    logoHeight,
    mainFontSize,
    returnFontSize,
    brandingFontSize,
    padding,
    spacing,
    maxLogoWidth
  };
}

/**
 * Get recommended ranges for user customization based on label size
 */
export function getCustomizationRanges(dimensions: LabelDimensions) {
  const heightPx = dimensions.height * DPI;
  
  return {
    logoMultiplier: {
      min: 0.5,
      max: 1.5,
      default: 1.0,
      step: 0.1
    },
    fontMultiplier: {
      min: 0.8,
      max: 1.2,
      default: 1.0,
      step: 0.1
    },
    description: heightPx < 100 
      ? "Small label - compact design"
      : heightPx < 150 
      ? "Medium label - balanced design"
      : "Large label - spacious design"
  };
}
