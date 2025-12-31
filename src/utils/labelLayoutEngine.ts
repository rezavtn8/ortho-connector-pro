/**
 * Unified Label Layout Engine
 * Single source of truth for layout calculations used by both preview and PDF generator.
 * Implements strict visual hierarchy: Logo → From → To (top to bottom, never overlapping)
 */

export type LayoutMode = 'auto' | 'stacked' | 'split';
export type ToAlignment = 'left' | 'center' | 'right';
export type FromPosition = 'top-left' | 'top-right';
export type LineSpacing = 'compact' | 'normal' | 'relaxed';

export interface LabelDimensions {
  width: number;  // in inches
  height: number; // in inches
}

export interface LayoutOptions {
  showLogo: boolean;
  showFromAddress: boolean;
  showToLabel: boolean;
  showFromLabel: boolean;
  showBranding: boolean;
  logoSizeMultiplier: number;
  fontSizeMultiplier: number;
  fromFontSizeMultiplier: number;
  lineSpacing: LineSpacing;
  toAlignment: ToAlignment;
  fromPosition: FromPosition;
  layoutMode: LayoutMode;
}

export interface LayoutZone {
  type: 'logo' | 'from' | 'to' | 'branding';
  // Percentages of label dimensions
  top: number;      // percentage from top (0-100)
  left: number;     // percentage from left (0-100)
  width: number;    // percentage of label width (0-100)
  height: number;   // percentage of label height (0-100)
  fontSize: number; // in pixels
  lineHeight: number;
  align: ToAlignment;
  visible: boolean;
}

export interface CalculatedLayout {
  zones: LayoutZone[];
  useTwoZoneLayout: boolean;
  totalContentHeight: number; // in pixels
  labelHeightPx: number;
  hasOverflow: boolean;
  description: string;
}

const DPI = 96; // Screen DPI for preview

/**
 * Get line height multiplier based on spacing preference
 */
function getLineHeightMultiplier(spacing: LineSpacing): number {
  switch (spacing) {
    case 'compact': return 1.15;
    case 'normal': return 1.35;
    case 'relaxed': return 1.55;
    default: return 1.35;
  }
}

/**
 * Calculate base font size based on label dimensions
 */
function calculateBaseFontSize(heightPx: number): number {
  if (heightPx < 80) return 8;
  if (heightPx < 120) return 10;
  if (heightPx < 180) return 12;
  if (heightPx < 260) return 14;
  if (heightPx < 350) return 16;
  return 18;
}

/**
 * Calculate optimal logo height based on label dimensions and context
 */
function calculateLogoHeight(
  heightPx: number,
  hasFromAddress: boolean,
  useTwoZone: boolean,
  multiplier: number
): number {
  let basePercent: number;
  
  if (useTwoZone) {
    // Two-zone: logo gets more space (30-40% of label)
    basePercent = hasFromAddress ? 0.30 : 0.38;
  } else {
    // Standard: logo is smaller (15-25%)
    basePercent = hasFromAddress ? 0.18 : 0.25;
  }
  
  const baseHeight = heightPx * basePercent;
  return Math.round(baseHeight * Math.max(0.25, Math.min(2.5, multiplier)));
}

/**
 * Determine if two-zone layout should be used
 */
function shouldUseTwoZoneLayout(
  dimensions: LabelDimensions,
  options: LayoutOptions
): boolean {
  if (options.layoutMode === 'stacked') return true;
  if (options.layoutMode === 'split') return false;
  
  // Auto mode: use two-zone for large labels with logo
  const heightPx = dimensions.height * DPI;
  return heightPx >= 240 && options.showLogo;
}

/**
 * Calculate the layout for a label based on dimensions and options
 * This is the main function that both preview and PDF generator should use
 * Auto-adjusts logo size if content overflows
 */
export function calculateLabelLayout(
  dimensions: LabelDimensions,
  options: LayoutOptions,
  fromAddressLines: number = 0,
  toAddressLines: number = 4,
  _autoAdjustAttempt: number = 0 // Internal: tracks auto-adjustment iterations
): CalculatedLayout {
  const widthPx = dimensions.width * DPI;
  const heightPx = dimensions.height * DPI;
  const padding = Math.max(4, heightPx * 0.04);
  
  const useTwoZone = shouldUseTwoZoneLayout(dimensions, options);
  const lineHeightMult = getLineHeightMultiplier(options.lineSpacing);
  
  // Calculate font sizes
  const baseFontSize = calculateBaseFontSize(heightPx);
  const mainFontSize = Math.round(baseFontSize * Math.max(0.5, Math.min(2.0, options.fontSizeMultiplier)));
  const fromFontSize = Math.round(baseFontSize * 0.8 * Math.max(0.5, Math.min(1.5, options.fromFontSizeMultiplier)));
  const brandingFontSize = Math.round(baseFontSize * 0.7 * options.fontSizeMultiplier);
  
  const mainLineHeight = mainFontSize * lineHeightMult;
  const fromLineHeight = fromFontSize * lineHeightMult;
  const brandingLineHeight = brandingFontSize * lineHeightMult;
  
  // Calculate logo height (may be reduced in auto-adjustment)
  const effectiveLogoMultiplier = options.logoSizeMultiplier * Math.pow(0.75, _autoAdjustAttempt);
  const logoHeight = options.showLogo 
    ? calculateLogoHeight(heightPx, options.showFromAddress, useTwoZone, effectiveLogoMultiplier)
    : 0;
  
  const zones: LayoutZone[] = [];
  let currentTop = (padding / heightPx) * 100; // Start with padding as percentage
  
  // Zone 1: Logo (if enabled)
  if (options.showLogo) {
    const logoHeightPercent = (logoHeight / heightPx) * 100;
    zones.push({
      type: 'logo',
      top: currentTop,
      left: 0,
      width: 100,
      height: logoHeightPercent,
      fontSize: 0,
      lineHeight: 0,
      align: 'center',
      visible: true,
    });
    currentTop += logoHeightPercent + (padding / heightPx) * 50; // Add small gap
  }
  
  // Zone 2: From Address (if enabled)
  if (options.showFromAddress) {
    const fromLabelLine = options.showFromLabel ? 1 : 0;
    const fromTotalLines = fromLabelLine + Math.min(fromAddressLines, 3);
    const fromHeightPx = fromTotalLines * fromLineHeight + padding;
    const fromHeightPercent = (fromHeightPx / heightPx) * 100;
    
    // Position depends on layout mode
    const fromLeft = options.fromPosition === 'top-left' ? 2 : 50;
    const fromWidth = options.fromPosition === 'top-left' ? 45 : 48;
    const fromAlign = options.fromPosition === 'top-left' ? 'left' : 'right';
    
    zones.push({
      type: 'from',
      top: currentTop,
      left: fromLeft,
      width: fromWidth,
      height: fromHeightPercent,
      fontSize: fromFontSize,
      lineHeight: fromLineHeight,
      align: fromAlign as ToAlignment,
      visible: true,
    });
    currentTop += fromHeightPercent + (padding / heightPx) * 50;
  }
  
  // Zone 3: Branding (reserve space at bottom if enabled)
  let brandingHeightPercent = 0;
  if (options.showBranding) {
    const brandingHeightPx = brandingLineHeight + padding;
    brandingHeightPercent = (brandingHeightPx / heightPx) * 100;
    
    zones.push({
      type: 'branding',
      top: 100 - brandingHeightPercent - (padding / heightPx) * 100,
      left: 0,
      width: 100,
      height: brandingHeightPercent,
      fontSize: brandingFontSize,
      lineHeight: brandingLineHeight,
      align: 'center',
      visible: true,
    });
  }
  
  // Zone 4: To Address (fills remaining space, centered)
  const toBottomPadding = (padding / heightPx) * 100;
  const toAvailableTop = currentTop;
  const toAvailableBottom = options.showBranding 
    ? 100 - brandingHeightPercent - toBottomPadding
    : 100 - toBottomPadding;
  const toHeightPercent = toAvailableBottom - toAvailableTop;
  
  const toContentLines = (options.showToLabel ? 1 : 0) + toAddressLines;
  const toContentHeightPx = toContentLines * mainLineHeight;
  
  zones.push({
    type: 'to',
    top: toAvailableTop,
    left: 0,
    width: 100,
    height: toHeightPercent,
    fontSize: mainFontSize,
    lineHeight: mainLineHeight,
    align: options.toAlignment,
    visible: true,
  });
  
  // Calculate total content height for overflow detection
  const totalContentHeightPx = 
    (options.showLogo ? logoHeight + padding : 0) +
    (options.showFromAddress ? (zones.find(z => z.type === 'from')?.height || 0) * heightPx / 100 : 0) +
    toContentHeightPx +
    (options.showBranding ? brandingLineHeight + padding : 0);
  
  const hasOverflow = totalContentHeightPx > heightPx - padding * 2;
  
  // Auto-adjust: if overflow and we have a logo, try reducing logo size (max 4 attempts)
  if (hasOverflow && options.showLogo && _autoAdjustAttempt < 4) {
    return calculateLabelLayout(
      dimensions,
      options,
      fromAddressLines,
      toAddressLines,
      _autoAdjustAttempt + 1
    );
  }
  
  // Generate description
  let description = '';
  if (useTwoZone) {
    description = 'Stacked layout: Logo → ';
    if (options.showFromAddress) description += 'From → ';
    description += 'To (centered)';
  } else if (!options.showLogo && !options.showFromAddress) {
    description = 'Centered: To address only';
  } else {
    description = 'Flow layout: ';
    if (options.showLogo) description += 'Logo → ';
    if (options.showFromAddress) description += 'From → ';
    description += 'To';
  }
  
  // Note if we auto-adjusted
  if (_autoAdjustAttempt > 0) {
    description += ` (logo auto-reduced ${Math.round((1 - Math.pow(0.75, _autoAdjustAttempt)) * 100)}%)`;
  }
  
  if (hasOverflow) {
    description += ' ⚠️ Content may overflow';
  }
  
  return {
    zones,
    useTwoZoneLayout: useTwoZone,
    totalContentHeight: totalContentHeightPx,
    labelHeightPx: heightPx,
    hasOverflow,
    description,
  };
}

/**
 * Get default layout options
 */
export function getDefaultLayoutOptions(): LayoutOptions {
  return {
    showLogo: false,
    showFromAddress: false,
    showToLabel: true,
    showFromLabel: true,
    showBranding: false,
    logoSizeMultiplier: 1.0,
    fontSizeMultiplier: 1.0,
    fromFontSizeMultiplier: 1.0,
    lineSpacing: 'normal',
    toAlignment: 'center',
    fromPosition: 'top-left',
    layoutMode: 'auto',
  };
}

/**
 * Calculate pixel values for CSS/PDF rendering
 */
export function getLayoutPixelValues(
  dimensions: LabelDimensions,
  layout: CalculatedLayout
): {
  widthPx: number;
  heightPx: number;
  zones: Array<LayoutZone & {
    topPx: number;
    leftPx: number;
    widthPx: number;
    heightPx: number;
  }>;
} {
  const widthPx = dimensions.width * DPI;
  const heightPx = dimensions.height * DPI;
  
  return {
    widthPx,
    heightPx,
    zones: layout.zones.map(zone => ({
      ...zone,
      topPx: (zone.top / 100) * heightPx,
      leftPx: (zone.left / 100) * widthPx,
      widthPx: (zone.width / 100) * widthPx,
      heightPx: (zone.height / 100) * heightPx,
    })),
  };
}

/**
 * Suggest optimal settings for auto-optimization
 */
export function suggestOptimalSettings(
  dimensions: LabelDimensions,
  hasLogo: boolean,
  hasFromAddress: boolean
): Partial<LayoutOptions> {
  const heightPx = dimensions.height * DPI;
  const widthPx = dimensions.width * DPI;
  const aspectRatio = widthPx / heightPx;
  
  const isLarge = heightPx >= 240;
  const isWide = aspectRatio >= 2.5;
  const isSmall = heightPx < 100;
  
  // Suggest layout mode
  let layoutMode: LayoutMode = 'auto';
  if (isWide && hasLogo && hasFromAddress) {
    layoutMode = 'split';
  } else if (isLarge && hasLogo) {
    layoutMode = 'stacked';
  }
  
  // Suggest font size
  let fontSizeMultiplier = 1.0;
  if (isLarge && !hasLogo && !hasFromAddress) {
    fontSizeMultiplier = 1.3; // More room, bigger text
  } else if (isSmall) {
    fontSizeMultiplier = 0.9;
  }
  
  // Suggest logo size
  let logoSizeMultiplier = 1.0;
  if (isLarge) {
    logoSizeMultiplier = hasFromAddress ? 1.2 : 1.5;
  } else if (isSmall) {
    logoSizeMultiplier = 0.7;
  }
  
  // Suggest line spacing
  let lineSpacing: LineSpacing = 'normal';
  if (isLarge && !hasFromAddress) {
    lineSpacing = 'relaxed';
  } else if (isSmall) {
    lineSpacing = 'compact';
  }
  
  return {
    layoutMode,
    fontSizeMultiplier,
    logoSizeMultiplier,
    lineSpacing,
    toAlignment: 'center',
    fromPosition: 'top-left',
    showFromLabel: !isSmall,
    showToLabel: !isSmall,
  };
}
