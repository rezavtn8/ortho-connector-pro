/**
 * Professional Mailing Label PDF Generator
 * Generates pixel-perfect Avery-compatible label sheets for printing
 */

import jsPDF from 'jspdf';

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
  showReturnAddress?: boolean;
  returnAddress?: string;
  showFromLabel?: boolean;
  showToLabel?: boolean;
  showBranding?: boolean;
  brandingText?: string;
  fontSizeMultiplier?: number;
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
};

// Convert inches to PDF points (72 points per inch)
const inchesToPoints = (inches: number): number => inches * 72;

// Calculate optimal font size based on label dimensions
const calculateFontSize = (template: LabelTemplate, multiplier: number = 1): number => {
  const baseSize = Math.min(template.width * 3.5, template.height * 7);
  return Math.max(6, Math.min(12, baseSize)) * multiplier;
};

// Calculate line height based on font size
const getLineHeight = (fontSize: number): number => fontSize * 1.3;

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
 * Generate a professional PDF with mailing labels
 */
export function generateLabelsPDF(
  labels: LabelData[],
  templateKey: string,
  customization: LabelCustomization = {}
): jsPDF {
  // Defensive check for empty labels array
  if (!labels || labels.length === 0) {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter',
    });
    return pdf;
  }

  const template = AVERY_TEMPLATES[templateKey] || AVERY_TEMPLATES["5160"];
  const labelsPerPage = template.cols * template.rows;
  const totalPages = Math.ceil(labels.length / labelsPerPage);
  
  // Create PDF in Letter size (8.5 x 11 inches)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt', // Points for precise positioning
    format: 'letter',
  });

  // Page dimensions in points
  const pageWidth = inchesToPoints(8.5);
  const pageHeight = inchesToPoints(11);
  
  // Template dimensions in points
  const labelWidth = inchesToPoints(template.width);
  const labelHeight = inchesToPoints(template.height);
  const marginTop = inchesToPoints(template.marginTop);
  const marginLeft = inchesToPoints(template.marginLeft);
  const gapX = inchesToPoints(template.gapX);
  const gapY = inchesToPoints(template.gapY);
  
  // Calculate font sizes
  const fontMultiplier = customization.fontSizeMultiplier || 1;
  const mainFontSize = calculateFontSize(template, fontMultiplier);
  const smallFontSize = mainFontSize * 0.75;
  const lineHeight = getLineHeight(mainFontSize);
  const smallLineHeight = getLineHeight(smallFontSize);
  
  // Padding inside each label
  const padding = inchesToPoints(0.05);
  const contentWidth = labelWidth - (padding * 2);

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
      const x = marginLeft + (col * (labelWidth + gapX));
      const y = marginTop + (row * (labelHeight + gapY));
      
      // Content area
      const contentX = x + padding;
      const contentY = y + padding;
      const contentHeight = labelHeight - (padding * 2);
      
      // Calculate vertical centering for main address
      const addressLines = [
        label.contact,
        label.address1,
        label.address2,
        `${label.city}${label.city && label.state ? ', ' : ''}${label.state} ${label.zip}`.trim(),
      ].filter(line => line && line.trim());
      
      const showToLabel = customization.showToLabel !== false;
      const totalLines = addressLines.length + (showToLabel ? 1 : 0);
      const totalTextHeight = totalLines * lineHeight;
      
      // Start Y position for centered text
      let textY = contentY + (contentHeight - totalTextHeight) / 2 + mainFontSize;
      
      // Handle return address if enabled
      if (customization.showReturnAddress && customization.returnAddress) {
        pdf.setFontSize(smallFontSize);
        pdf.setFont('helvetica', 'normal');
        
        const returnLines = customization.returnAddress.split('\n').slice(0, 3);
        let returnY = contentY + smallFontSize;
        
        if (customization.showFromLabel) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('From:', contentX, returnY);
          returnY += smallLineHeight;
          pdf.setFont('helvetica', 'normal');
        }
        
        returnLines.forEach(line => {
          const truncated = truncateText(pdf, line, contentWidth * 0.45);
          pdf.text(truncated, contentX, returnY);
          returnY += smallLineHeight;
        });
      }
      
      // Draw main address - centered
      pdf.setFontSize(mainFontSize);
      const centerX = x + (labelWidth / 2);
      
      // "To:" label
      if (showToLabel) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('To:', centerX, textY, { align: 'center' });
        textY += lineHeight;
      }
      
      // Contact name (bold)
      if (label.contact) {
        pdf.setFont('helvetica', 'bold');
        const truncatedContact = truncateText(pdf, label.contact, contentWidth);
        pdf.text(truncatedContact, centerX, textY, { align: 'center' });
        textY += lineHeight;
      }
      
      // Address lines (normal)
      pdf.setFont('helvetica', 'normal');
      
      if (label.address1) {
        const truncatedAddr1 = truncateText(pdf, label.address1, contentWidth);
        pdf.text(truncatedAddr1, centerX, textY, { align: 'center' });
        textY += lineHeight;
      }
      
      if (label.address2) {
        const truncatedAddr2 = truncateText(pdf, label.address2, contentWidth);
        pdf.text(truncatedAddr2, centerX, textY, { align: 'center' });
        textY += lineHeight;
      }
      
      // City, State ZIP
      const cityStateZip = `${label.city}${label.city && label.state ? ', ' : ''}${label.state} ${label.zip}`.trim();
      if (cityStateZip) {
        const truncatedCSZ = truncateText(pdf, cityStateZip, contentWidth);
        pdf.text(truncatedCSZ, centerX, textY, { align: 'center' });
      }
      
      // Branding footer
      if (customization.showBranding && customization.brandingText) {
        pdf.setFontSize(smallFontSize * 0.9);
        pdf.setFont('helvetica', 'bold');
        const brandY = y + labelHeight - padding - 2;
        const truncatedBrand = truncateText(pdf, customization.brandingText, contentWidth);
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
