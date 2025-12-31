/**
 * Professional Mailing Label PDF Generator
 * Uses the shared layout engine to ensure PDF matches preview exactly.
 * Supports logos, custom sizing, and two-zone layouts for large labels.
 */

import jsPDF from 'jspdf';
import {
  calculateLabelLayout,
  getLayoutPixelValues,
  type LayoutOptions,
  type LabelDimensions,
  type CalculatedLayout,
} from './labelLayoutEngine';

export interface LabelData {
  contact: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

export interface LabelTemplate {
  name: string;
  width: number;      // Label width in inches
  height: number;     // Label height in inches
  cols: number;       // Number of columns
  rows: number;       // Number of rows per page
  marginTop: number;  // Top margin in inches
  marginLeft: number; // Left margin in inches
  gapX: number;       // Horizontal gap between labels
  gapY: number;       // Vertical gap between labels
}

export interface LabelCustomization {
  showLogo?: boolean;
  logoUrl?: string;
  logoSizeMultiplier?: number;
  showReturnAddress?: boolean;
  returnAddress?: string;
  showFromLabel?: boolean;
  showToLabel?: boolean;
  showBranding?: boolean;
  brandingText?: string;
  fontSizeMultiplier?: number;
  fromFontSizeMultiplier?: number;
  lineSpacing?: 'compact' | 'normal' | 'relaxed';
  toAlignment?: 'left' | 'center' | 'right';
  fromPosition?: 'top-left' | 'top-right';
  layoutMode?: 'auto' | 'stacked' | 'split';
  useTwoZoneLayout?: boolean;
}

// Standard Avery label templates with exact specifications
export const AVERY_TEMPLATES: Record<string, LabelTemplate> = {
  "5160": {
    name: "Avery 5160 (1\" x 2-5/8\")",
    width: 2.625,
    height: 1,
    cols: 3,
    rows: 10,
    marginTop: 0.5,
    marginLeft: 0.1875,
    gapX: 0.125,
    gapY: 0,
  },
  "5161": {
    name: "Avery 5161 (1\" x 4\")",
    width: 4,
    height: 1,
    cols: 2,
    rows: 10,
    marginTop: 0.5,
    marginLeft: 0.15625,
    gapX: 0.1875,
    gapY: 0,
  },
  "5163": {
    name: "Avery 5163 (2\" x 4\")",
    width: 4,
    height: 2,
    cols: 2,
    rows: 5,
    marginTop: 0.5,
    marginLeft: 0.15625,
    gapX: 0.1875,
    gapY: 0,
  },
  "5167": {
    name: "Avery 5167 (1/2\" x 1-3/4\")",
    width: 1.75,
    height: 0.5,
    cols: 4,
    rows: 20,
    marginTop: 0.5,
    marginLeft: 0.3125,
    gapX: 0.28125,
    gapY: 0,
  },
  "shipping-6up": {
    name: "Shipping Labels (3-1/3\" x 4\") - 6 per sheet",
    width: 4,
    height: 3.333,
    cols: 2,
    rows: 3,
    marginTop: 0.5,
    marginLeft: 0.15625,
    gapX: 0.1875,
    gapY: 0,
  },
};

// PDF uses 72 points per inch
const POINTS_PER_INCH = 72;

// Convert inches to PDF points
const inchesToPoints = (inches: number): number => inches * POINTS_PER_INCH;

// Truncate text to fit within width
const truncateText = (pdf: jsPDF, text: string, maxWidth: number): string => {
  if (!text) return '';
  
  const textWidth = pdf.getTextWidth(text);
  if (textWidth <= maxWidth) return text;
  
  let truncated = text;
  while (pdf.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
};

/**
 * Add logo to PDF at specified position
 */
function addLogoToPDF(
  pdf: jsPDF,
  logoUrl: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  centerX?: number
): void {
  try {
    if (!logoUrl.startsWith('data:image')) {
      return;
    }
    
    const formatMatch = logoUrl.match(/data:image\/(\w+);/);
    const format = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
    
    if (centerX !== undefined) {
      pdf.addImage(logoUrl, format, centerX - maxWidth / 2, y, maxWidth, maxHeight);
    } else {
      pdf.addImage(logoUrl, format, x, y, maxWidth, maxHeight);
    }
  } catch (error) {
    console.warn('Failed to add logo to PDF:', error);
  }
}

/**
 * Convert screen pixels to PDF points
 * Screen uses 96 DPI, PDF uses 72 points per inch
 */
function pixelsToPoints(pixels: number): number {
  return (pixels / 96) * 72;
}

/**
 * Generate a professional PDF with mailing labels using the shared layout engine
 */
export function generateLabelsPDF(
  labels: LabelData[],
  templateKey: string,
  customization: LabelCustomization = {}
): jsPDF {
  if (!labels || labels.length === 0) {
    return new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter',
    });
  }

  const template = AVERY_TEMPLATES[templateKey] || AVERY_TEMPLATES["5160"];
  const labelsPerPage = template.cols * template.rows;
  const totalPages = Math.ceil(labels.length / labelsPerPage);
  
  // Build layout options matching the preview
  const layoutOptions: LayoutOptions = {
    showLogo: !!customization.showLogo && !!customization.logoUrl,
    showFromAddress: !!customization.showReturnAddress && !!customization.returnAddress,
    showToLabel: customization.showToLabel !== false,
    showFromLabel: customization.showFromLabel !== false,
    showBranding: !!customization.showBranding && !!customization.brandingText,
    logoSizeMultiplier: Math.max(0.25, Math.min(2.5, customization.logoSizeMultiplier || 1)),
    fontSizeMultiplier: Math.max(0.5, Math.min(2.0, customization.fontSizeMultiplier || 1)),
    fromFontSizeMultiplier: Math.max(0.5, Math.min(1.5, customization.fromFontSizeMultiplier || 1)),
    lineSpacing: customization.lineSpacing || 'normal',
    toAlignment: customization.toAlignment || 'center',
    fromPosition: customization.fromPosition || 'top-left',
    layoutMode: customization.layoutMode || 'auto',
  };
  
  const dimensions: LabelDimensions = {
    width: template.width,
    height: template.height,
  };
  
  // Calculate layout using the shared engine
  const fromLines = customization.returnAddress?.split('\n').length || 0;
  const layout = calculateLabelLayout(dimensions, layoutOptions, fromLines, 4);
  const pixelLayout = getLayoutPixelValues(dimensions, layout);
  
  // Create PDF in Letter size
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  // Template dimensions in points
  const labelWidthPt = inchesToPoints(template.width);
  const labelHeightPt = inchesToPoints(template.height);
  const marginTopPt = inchesToPoints(template.marginTop);
  const marginLeftPt = inchesToPoints(template.marginLeft);
  const gapXPt = inchesToPoints(template.gapX);
  const gapYPt = inchesToPoints(template.gapY);
  
  // Calculate padding in points (matches preview: max(4px, 4% of height))
  const paddingPt = pixelsToPoints(Math.max(4, pixelLayout.heightPx * 0.04));
  const contentWidthPt = labelWidthPt - (paddingPt * 2);
  
  // Get zones from layout
  const logoZone = pixelLayout.zones.find(z => z.type === 'logo');
  const fromZone = pixelLayout.zones.find(z => z.type === 'from');
  const toZone = pixelLayout.zones.find(z => z.type === 'to');
  const brandingZone = pixelLayout.zones.find(z => z.type === 'branding');

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    if (pageIndex > 0) {
      pdf.addPage();
    }
    
    const startIndex = pageIndex * labelsPerPage;
    const pageLabels = labels.slice(startIndex, startIndex + labelsPerPage);
    
    pageLabels.forEach((label, index) => {
      const col = index % template.cols;
      const row = Math.floor(index / template.cols);
      
      // Calculate label position
      const labelX = marginLeftPt + (col * (labelWidthPt + gapXPt));
      const labelY = marginTopPt + (row * (labelHeightPt + gapYPt));
      
      // Content area with padding
      const contentX = labelX + paddingPt;
      let currentY = labelY + paddingPt;
      const centerX = labelX + (labelWidthPt / 2);
      
      // Zone 1: Logo (if enabled)
      if (layoutOptions.showLogo && customization.logoUrl && logoZone) {
        const logoHeightPt = pixelsToPoints(logoZone.heightPx);
        const logoWidthPt = contentWidthPt * 0.8;
        
        addLogoToPDF(
          pdf,
          customization.logoUrl,
          contentX,
          currentY,
          logoWidthPt,
          logoHeightPt,
          centerX
        );
        
        currentY += logoHeightPt + paddingPt * 0.5;
      }
      
      // Zone 2: From Address (if enabled)
      if (layoutOptions.showFromAddress && customization.returnAddress && fromZone) {
        const fromFontSizePt = pixelsToPoints(fromZone.fontSize);
        const fromLineHeightPt = pixelsToPoints(fromZone.lineHeight);
        
        pdf.setFontSize(fromFontSizePt);
        
        const fromX = customization.fromPosition === 'top-left' 
          ? contentX 
          : labelX + labelWidthPt - paddingPt;
        const fromAlign = customization.fromPosition === 'top-left' ? 'left' : 'right';
        
        if (layoutOptions.showFromLabel) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('From:', fromX, currentY + fromFontSizePt, { align: fromAlign });
          currentY += fromLineHeightPt;
        }
        
        pdf.setFont('helvetica', 'normal');
        const returnLines = customization.returnAddress.split('\n').slice(0, 3);
        returnLines.forEach(line => {
          const truncated = truncateText(pdf, line, contentWidthPt * 0.45);
          pdf.text(truncated, fromX, currentY + fromFontSizePt, { align: fromAlign });
          currentY += fromLineHeightPt;
        });
        
        currentY += paddingPt * 0.5;
      }
      
      // Zone 3: To Address (centered in remaining space)
      if (toZone) {
        const toFontSizePt = pixelsToPoints(toZone.fontSize);
        const toLineHeightPt = pixelsToPoints(toZone.lineHeight);
        
        // Build address lines
        const addressLines: string[] = [];
        if (label.contact) addressLines.push(label.contact);
        if (label.address1) addressLines.push(label.address1);
        if (label.address2) addressLines.push(label.address2);
        const cityStateZip = `${label.city}${label.city && label.state ? ', ' : ''}${label.state} ${label.zip}`.trim();
        if (cityStateZip) addressLines.push(cityStateZip);
        
        const toTotalLines = (layoutOptions.showToLabel ? 1 : 0) + addressLines.length;
        const toContentHeightPt = toTotalLines * toLineHeightPt;
        
        // Calculate remaining space for centering
        const brandingReservePt = brandingZone 
          ? pixelsToPoints(brandingZone.heightPx) + paddingPt * 0.25
          : 0;
        const bottomY = labelY + labelHeightPt - paddingPt - brandingReservePt;
        const availableHeightPt = bottomY - currentY;
        
        // Vertically center the "to" content
        let toStartY = currentY + (availableHeightPt - toContentHeightPt) / 2 + toFontSizePt;
        
        // Horizontal alignment
        const toAlign = customization.toAlignment || 'center';
        let toX: number;
        if (toAlign === 'center') {
          toX = centerX;
        } else if (toAlign === 'right') {
          toX = labelX + labelWidthPt - paddingPt;
        } else {
          toX = contentX;
        }
        
        pdf.setFontSize(toFontSizePt);
        
        // "To:" label
        if (layoutOptions.showToLabel) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('To:', toX, toStartY, { align: toAlign });
          toStartY += toLineHeightPt;
        }
        
        // Contact name (bold)
        if (label.contact) {
          pdf.setFont('helvetica', 'bold');
          const truncatedContact = truncateText(pdf, label.contact, contentWidthPt);
          pdf.text(truncatedContact, toX, toStartY, { align: toAlign });
          toStartY += toLineHeightPt;
        }
        
        // Address lines (normal)
        pdf.setFont('helvetica', 'normal');
        
        if (label.address1) {
          const truncatedAddr1 = truncateText(pdf, label.address1, contentWidthPt);
          pdf.text(truncatedAddr1, toX, toStartY, { align: toAlign });
          toStartY += toLineHeightPt;
        }
        
        if (label.address2) {
          const truncatedAddr2 = truncateText(pdf, label.address2, contentWidthPt);
          pdf.text(truncatedAddr2, toX, toStartY, { align: toAlign });
          toStartY += toLineHeightPt;
        }
        
        if (cityStateZip) {
          const truncatedCSZ = truncateText(pdf, cityStateZip, contentWidthPt);
          pdf.text(truncatedCSZ, toX, toStartY, { align: toAlign });
        }
      }
      
      // Zone 4: Branding Footer (if enabled)
      if (layoutOptions.showBranding && customization.brandingText && brandingZone) {
        const brandingFontSizePt = pixelsToPoints(brandingZone.fontSize);
        const brandY = labelY + labelHeightPt - paddingPt;
        
        pdf.setFontSize(brandingFontSizePt);
        pdf.setFont('helvetica', 'bold');
        const truncatedBrand = truncateText(pdf, customization.brandingText, contentWidthPt);
        pdf.text(truncatedBrand, centerX, brandY, { align: 'center' });
      }
    });
  }
  
  return pdf;
}

/**
 * Generate and download PDF
 */
export function downloadLabelsPDF(
  labels: LabelData[],
  templateKey: string,
  customization: LabelCustomization = {},
  filename: string = 'mailing-labels.pdf'
): void {
  const pdf = generateLabelsPDF(labels, templateKey, customization);
  pdf.save(filename);
}

/**
 * Generate PDF and open in new tab for preview
 */
export function previewLabelsPDF(
  labels: LabelData[],
  templateKey: string,
  customization: LabelCustomization = {}
): void {
  const pdf = generateLabelsPDF(labels, templateKey, customization);
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
