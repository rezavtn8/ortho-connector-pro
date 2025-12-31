import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Settings, FileDown, Eye, AlertTriangle, X, Download } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { LabelCustomizationDialog, LabelCustomization } from "./LabelCustomizationDialog";
import { toast } from "@/hooks/use-toast";
import { downloadLabelsPDF, generatePdfBlob } from "@/utils/pdfLabelGenerator";
import {
  calculateLabelLayout,
  getLayoutPixelValues,
  type LayoutOptions,
} from "@/utils/labelLayoutEngine";

interface MailingLabelData {
  contact: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

interface MailingLabelPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MailingLabelData[];
}

const AVERY_TEMPLATES = {
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

export const MailingLabelPreview = ({ open, onOpenChange, data }: MailingLabelPreviewProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof AVERY_TEMPLATES>("5160");
  const [showCustomization, setShowCustomization] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [customization, setCustomization] = useState<LabelCustomization>({
    showLogo: false,
    showReturnAddress: false,
    showBranding: false,
    showFromLabel: true,
    showToLabel: true,
    logoSizeMultiplier: 1.0,
    fontSizeMultiplier: 1.0,
    fromFontSizeMultiplier: 1.0,
    lineSpacing: 'normal',
    toAlignment: 'center',
    fromPosition: 'top-left',
    layoutMode: 'auto',
    useAutoOptimization: true,
  });
  
  // Cleanup blob URL when dialog closes
  const closePdfPreview = useCallback(() => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setShowPdfPreview(false);
  }, [pdfBlobUrl]);
  
  const template = AVERY_TEMPLATES[selectedTemplate];
  const labelsPerPage = template.cols * template.rows;
  const totalPages = Math.ceil(data.length / labelsPerPage);
  const isLargeLabel = template.height >= 2.5;
  
  // Calculate layout using the unified engine
  const layoutOptions: LayoutOptions = useMemo(() => ({
    showLogo: customization.showLogo && !!customization.logoUrl,
    showFromAddress: customization.showReturnAddress && !!customization.returnAddress,
    showToLabel: customization.showToLabel,
    showFromLabel: customization.showFromLabel,
    showBranding: customization.showBranding && !!customization.brandingText,
    logoSizeMultiplier: customization.logoSizeMultiplier,
    fontSizeMultiplier: customization.fontSizeMultiplier,
    fromFontSizeMultiplier: customization.fromFontSizeMultiplier,
    lineSpacing: customization.lineSpacing,
    toAlignment: customization.toAlignment,
    fromPosition: customization.fromPosition,
    layoutMode: customization.layoutMode,
  }), [customization]);
  
  const layout = useMemo(() => {
    const fromLines = customization.returnAddress?.split('\n').length || 0;
    return calculateLabelLayout(
      { width: template.width, height: template.height },
      layoutOptions,
      fromLines,
      4 // Typical address lines
    );
  }, [template.width, template.height, layoutOptions, customization.returnAddress]);
  
  const pixelLayout = useMemo(() => 
    getLayoutPixelValues({ width: template.width, height: template.height }, layout),
    [template.width, template.height, layout]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (data.length === 0) {
      toast({
        title: "No labels to export",
        description: "Add some addresses first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const filename = `mailing-labels-${selectedTemplate}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      downloadLabelsPDF(
        data,
        selectedTemplate,
        {
          showLogo: customization.showLogo,
          logoUrl: customization.logoUrl,
          logoSizeMultiplier: customization.logoSizeMultiplier,
          showReturnAddress: customization.showReturnAddress,
          returnAddress: customization.returnAddress,
          showFromLabel: customization.showFromLabel,
          showToLabel: customization.showToLabel,
          showBranding: customization.showBranding,
          brandingText: customization.brandingText,
          fontSizeMultiplier: customization.fontSizeMultiplier,
          fromFontSizeMultiplier: customization.fromFontSizeMultiplier,
          lineSpacing: customization.lineSpacing,
          toAlignment: customization.toAlignment,
          fromPosition: customization.fromPosition,
          layoutMode: customization.layoutMode,
          useTwoZoneLayout: layout.useTwoZoneLayout,
        },
        filename
      );
      
      toast({
        title: "PDF Generated Successfully",
        description: `Downloaded ${data.length} labels in ${totalPages} page${totalPages > 1 ? 's' : ''} using ${template.name}.`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "PDF Generation Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewPDF = async () => {
    if (data.length === 0) {
      toast({
        title: "No labels to preview",
        description: "Add some addresses first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const blob = await generatePdfBlob(
        data,
        selectedTemplate,
        {
          showLogo: customization.showLogo,
          logoUrl: customization.logoUrl,
          logoSizeMultiplier: customization.logoSizeMultiplier,
          showReturnAddress: customization.showReturnAddress,
          returnAddress: customization.returnAddress,
          showFromLabel: customization.showFromLabel,
          showToLabel: customization.showToLabel,
          showBranding: customization.showBranding,
          brandingText: customization.brandingText,
          fontSizeMultiplier: customization.fontSizeMultiplier,
          fromFontSizeMultiplier: customization.fromFontSizeMultiplier,
          lineSpacing: customization.lineSpacing,
          toAlignment: customization.toAlignment,
          fromPosition: customization.fromPosition,
          layoutMode: customization.layoutMode,
          useTwoZoneLayout: layout.useTwoZoneLayout,
        }
      );
      
      // Clean up previous blob URL if exists
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setShowPdfPreview(true);
    } catch (error) {
      console.error('PDF preview error:', error);
      toast({
        title: "Preview Failed",
        description: "There was an error generating the preview.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleDownloadFromPreview = () => {
    if (pdfBlobUrl) {
      const link = document.createElement('a');
      link.href = pdfBlobUrl;
      link.download = `mailing-labels-${selectedTemplate}-${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
    }
  };

  // Get zone by type from pixelLayout (includes heightPx, widthPx, etc.)
  const getZone = (type: 'logo' | 'from' | 'to' | 'branding') => 
    pixelLayout.zones.find(z => z.type === type);

  // Render a single label with flexbox stacking layout
  const renderLabel = (label: MailingLabelData | undefined, labelIndex: number) => {
    const logoZone = getZone('logo');
    const fromZone = getZone('from');
    const toZone = getZone('to');
    const brandingZone = getZone('branding');
    
    if (!label) {
      return (
        <div
          key={labelIndex}
          className="border border-dashed border-muted print:border-transparent flex items-center justify-center"
          style={{ overflow: 'hidden' }}
        >
          <span className="text-muted-foreground print:hidden text-xs">Empty</span>
        </div>
      );
    }

    const padding = Math.max(4, pixelLayout.heightPx * 0.04);
    
    // Build address display
    const cityStateZip = `${label.city}${label.city && label.state ? ', ' : ''}${label.state} ${label.zip}`.trim();

    return (
      <div
        key={labelIndex}
        className={`border border-dashed print:border-transparent flex flex-col overflow-hidden ${
          layout.hasOverflow ? 'border-destructive' : 'border-muted'
        }`}
        style={{ padding: `${padding}px` }}
      >
        {/* Zone 1: Logo (if enabled) - ALWAYS FIRST */}
        {layoutOptions.showLogo && customization.logoUrl && logoZone && (
          <div 
            className="flex-shrink-0 flex items-center justify-center"
            style={{ 
              height: `${logoZone.heightPx}px`,
              marginBottom: `${padding * 0.5}px`,
            }}
          >
            <img 
              src={customization.logoUrl} 
              alt="Logo" 
              style={{ 
                maxHeight: '100%',
                maxWidth: '80%',
                objectFit: 'contain',
              }}
            />
          </div>
        )}
        
        {/* Zone 2: From Address (if enabled) - ALWAYS BEFORE TO */}
        {layoutOptions.showFromAddress && customization.returnAddress && fromZone && (
          <div 
            className="flex-shrink-0"
            style={{ 
              fontSize: `${fromZone.fontSize}px`,
              lineHeight: `${fromZone.lineHeight}px`,
              textAlign: fromZone.align,
              marginBottom: `${padding * 0.5}px`,
              paddingLeft: customization.fromPosition === 'top-left' ? '2px' : undefined,
              paddingRight: customization.fromPosition === 'top-right' ? '2px' : undefined,
            }}
          >
            {customization.showFromLabel && (
              <div className="font-semibold">From:</div>
            )}
            {customization.returnAddress.split('\n').slice(0, 3).map((line, i) => (
              <div key={i} className="truncate">{line}</div>
            ))}
          </div>
        )}
        
        {/* Zone 3: To Address - CENTERED IN REMAINING SPACE */}
        {toZone && (
          <div 
            className="flex-1 flex flex-col items-center justify-center min-h-0"
            style={{ 
              fontSize: `${toZone.fontSize}px`,
              lineHeight: `${toZone.lineHeight}px`,
              textAlign: customization.toAlignment,
            }}
          >
            <div 
              className="w-full"
              style={{ 
                textAlign: customization.toAlignment,
                paddingLeft: customization.toAlignment === 'left' ? '4px' : undefined,
                paddingRight: customization.toAlignment === 'right' ? '4px' : undefined,
              }}
            >
              {customization.showToLabel && (
                <div className="font-semibold">To:</div>
              )}
              <div className="font-medium truncate">{label.contact}</div>
              <div className="truncate">{label.address1}</div>
              {label.address2 && <div className="truncate">{label.address2}</div>}
              <div className="truncate">{cityStateZip}</div>
            </div>
          </div>
        )}
        
        {/* Zone 4: Branding Footer (if enabled) - ALWAYS LAST */}
        {layoutOptions.showBranding && customization.brandingText && brandingZone && (
          <div 
            className="flex-shrink-0 text-center truncate font-semibold"
            style={{ 
              fontSize: `${brandingZone.fontSize}px`,
              lineHeight: `${brandingZone.lineHeight}px`,
              marginTop: `${padding * 0.25}px`,
            }}
          >
            {customization.brandingText}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full flex flex-col" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <DialogTitle className="text-xl font-semibold">Mailing Label Preview</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {data.length} labels • {totalPages} page{totalPages !== 1 ? "s" : ""} • {template.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {layout.description}
              </p>
              {layout.hasOverflow && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Content may overflow - consider reducing font size
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedTemplate} onValueChange={(value) => setSelectedTemplate(value as keyof typeof AVERY_TEMPLATES)}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AVERY_TEMPLATES).map(([key, tmpl]) => (
                    <SelectItem key={key} value={key}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowCustomization(true)} 
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Customize
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handlePreviewPDF} 
                disabled={isGenerating || data.length === 0}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview PDF
              </Button>
              <Button 
                variant="default"
                size="sm"
                onClick={handleExportPDF} 
                disabled={isGenerating || data.length === 0}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Download PDF'}
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handlePrint} 
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="print-area space-y-8">
            {Array.from({ length: totalPages }).map((_, pageIndex) => {
              const startIndex = pageIndex * labelsPerPage;
              const pageLabels = data.slice(startIndex, startIndex + labelsPerPage);
              
              return (
                <div
                  key={pageIndex}
                  className="label-page mx-auto bg-white shadow-lg print:shadow-none"
                  style={{
                    width: "8.5in",
                    height: "11in",
                    padding: `${template.marginTop}in ${template.marginLeft}in`,
                  }}
                >
                  <div
                    className="grid h-full"
                    style={{
                      gridTemplateColumns: `repeat(${template.cols}, ${template.width}in)`,
                      gridTemplateRows: `repeat(${template.rows}, ${template.height}in)`,
                      columnGap: `${template.gapX}in`,
                      rowGap: `${template.gapY}in`,
                    }}
                  >
                    {Array.from({ length: labelsPerPage }).map((_, labelIndex) => 
                      renderLabel(pageLabels[labelIndex], labelIndex)
                    )}
                  </div>
                  <div className="text-center text-xs text-muted-foreground mt-2 print:hidden">
                    Page {pageIndex + 1} of {totalPages}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>

      <LabelCustomizationDialog
        open={showCustomization}
        onOpenChange={setShowCustomization}
        customization={customization}
        onSave={setCustomization}
        templateDimensions={{ width: template.width, height: template.height }}
      />

      {/* In-App PDF Preview Dialog */}
      <Dialog open={showPdfPreview} onOpenChange={(open) => !open && closePdfPreview()}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0" aria-describedby={undefined}>
          <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>PDF Preview</DialogTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={handleDownloadFromPreview}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={closePdfPreview}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {pdfBlobUrl && (
              <iframe
                src={pdfBlobUrl}
                className="w-full h-full border-0"
                title="PDF Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Professional Print Styles */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 8.5in !important;
            height: 11in !important;
          }
          
          body * {
            visibility: hidden !important;
          }
          
          .print-area,
          .print-area * {
            visibility: visible !important;
          }
          
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 8.5in !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .label-page {
            page-break-after: always !important;
            page-break-inside: avoid !important;
            margin: 0 !important;
            padding-top: ${template.marginTop}in !important;
            padding-left: ${template.marginLeft}in !important;
            padding-right: ${template.marginLeft}in !important;
            box-shadow: none !important;
            border: none !important;
          }
          
          .label-page:last-child {
            page-break-after: auto !important;
          }
          
          @page {
            size: letter;
            margin: 0;
          }
        }
      `}</style>
    </Dialog>
  );
};
