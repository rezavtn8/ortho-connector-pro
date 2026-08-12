import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings,
  FileDown,
  Eye,
  AlertTriangle,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { LabelCustomizationDialog, LabelCustomization } from "./LabelCustomizationDialog";
import { toast } from "@/hooks/use-toast";
import {
  downloadLabelsPDF,
  generatePdfBlob,
  AVERY_TEMPLATES,
  type LabelData,
} from "@/utils/pdfLabelGenerator";
import {
  calculateLabelLayout,
  getLayoutPixelValues,
  type LayoutOptions,
} from "@/utils/labelLayoutEngine";

interface MailingLabelPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The expanded print queue — copies applied and skipped slots already padded in. */
  data: LabelData[];
  templateKey: string;
  onTemplateChange: (templateKey: string) => void;
  customization: LabelCustomization;
  onCustomizationChange: (customization: LabelCustomization) => void;
}

const ZOOM_OPTIONS = [
  { value: "0.5", label: "50%" },
  { value: "0.65", label: "65%" },
  { value: "0.8", label: "80%" },
  { value: "1", label: "100%" },
];

export const MailingLabelPreview = ({
  open,
  onOpenChange,
  data,
  templateKey,
  onTemplateChange,
  customization,
  onCustomizationChange,
}: MailingLabelPreviewProps) => {
  const [showCustomization, setShowCustomization] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState("0.65");

  const closePdfPreview = useCallback(() => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setShowPdfPreview(false);
  }, [pdfBlobUrl]);

  // Release the blob when the whole preview closes, not just the inner dialog.
  useEffect(() => {
    if (!open && pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  }, [open, pdfBlobUrl]);

  const template = AVERY_TEMPLATES[templateKey] ?? AVERY_TEMPLATES["5160"];
  const labelsPerPage = template.cols * template.rows;
  const totalPages = Math.max(1, Math.ceil(data.length / labelsPerPage));

  // A template change can leave us past the last page.
  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, totalPages - 1));
  }, [totalPages]);

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

  const pixelLayout = useMemo(
    () => getLayoutPixelValues({ width: template.width, height: template.height }, layout),
    [template.width, template.height, layout]
  );

  const pdfCustomization = useMemo(() => ({
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
  }), [customization, layout.useTwoZoneLayout]);

  const handleExportPDF = async () => {
    if (data.length === 0) {
      toast({
        title: "No labels to export",
        description: "Select at least one office first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const filename = `mailing-labels-${templateKey}-${new Date().toISOString().split('T')[0]}.pdf`;
      await downloadLabelsPDF(data, templateKey, pdfCustomization, filename);

      toast({
        title: "PDF downloaded",
        description: `${data.length} label slots across ${totalPages} page${totalPages > 1 ? 's' : ''} using ${template.name}.`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "PDF generation failed",
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
        description: "Select at least one office first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const blob = await generatePdfBlob(data, templateKey, pdfCustomization);

      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(URL.createObjectURL(blob));
      setShowPdfPreview(true);
    } catch (error) {
      console.error('PDF preview error:', error);
      toast({
        title: "Preview failed",
        description: "There was an error generating the preview.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadFromPreview = () => {
    if (!pdfBlobUrl) return;
    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    link.download = `mailing-labels-${templateKey}-${new Date().toISOString().split('T')[0]}.pdf`;
    link.click();
  };

  const getZone = (type: 'logo' | 'from' | 'to' | 'branding') =>
    pixelLayout.zones.find(z => z.type === type);

  const renderLabel = (label: LabelData | undefined, labelIndex: number) => {
    const logoZone = getZone('logo');
    const fromZone = getZone('from');
    const toZone = getZone('to');
    const brandingZone = getZone('branding');

    if (!label || label.blank) {
      return (
        <div
          key={labelIndex}
          className="border border-dashed border-muted flex items-center justify-center overflow-hidden"
        >
          <span className="text-muted-foreground text-[10px]">
            {label?.blank ? 'Skipped' : 'Empty'}
          </span>
        </div>
      );
    }

    const padding = Math.max(4, pixelLayout.heightPx * 0.04);
    const cityStateZip = `${label.city}${label.city && label.state ? ', ' : ''}${label.state} ${label.zip}`.trim();

    return (
      <div
        key={labelIndex}
        className={`border border-dashed flex flex-col overflow-hidden ${
          layout.hasOverflow ? 'border-destructive' : 'border-muted'
        }`}
        style={{ padding: `${padding}px` }}
      >
        {/* Zone 1: Logo */}
        {layoutOptions.showLogo && customization.logoUrl && logoZone && (
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ height: `${logoZone.heightPx}px`, marginBottom: `${padding * 0.5}px` }}
          >
            <img
              src={customization.logoUrl}
              alt="Logo"
              style={{ maxHeight: '100%', maxWidth: '80%', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Zone 2: From address */}
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
            {customization.showFromLabel && <div className="font-semibold">From:</div>}
            {customization.returnAddress.split('\n').slice(0, 3).map((line, i) => (
              <div key={i} className="truncate">{line}</div>
            ))}
          </div>
        )}

        {/* Zone 3: To address */}
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
              {customization.showToLabel && <div className="font-semibold">To:</div>}
              <div className="font-medium truncate">{label.contact}</div>
              <div className="truncate">{label.address1}</div>
              {label.address2 && <div className="truncate">{label.address2}</div>}
              <div className="truncate">{cityStateZip}</div>
            </div>
          </div>
        )}

        {/* Zone 4: Branding footer */}
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

  const zoomValue = parseFloat(zoom);
  const pageLabels = data.slice(pageIndex * labelsPerPage, pageIndex * labelsPerPage + labelsPerPage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[95vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <DialogTitle className="text-xl font-semibold">Label preview</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {data.filter(d => !d.blank).length} labels • {totalPages} sheet{totalPages !== 1 ? "s" : ""} • {template.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{layout.description}</p>
              {layout.hasOverflow && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Content may overflow — reduce the font size in Customize
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={templateKey} onValueChange={onTemplateChange}>
                <SelectTrigger className="w-[260px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AVERY_TEMPLATES).map(([key, tmpl]) => (
                    <SelectItem key={key} value={key}>{tmpl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setShowCustomization(true)} className="gap-2">
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
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
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
                {isGenerating ? 'Generating…' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Sheet navigation — only the visible sheet is rendered, so a 40-sheet
            run does not put 1,200 label nodes in the DOM at once. */}
        <div className="flex items-center justify-between gap-4 px-6 py-2 border-b border-border flex-shrink-0 bg-muted/30">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(i => Math.max(0, i - 1))}
              disabled={pageIndex === 0}
              aria-label="Previous sheet"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums min-w-[110px] text-center">
              Sheet {pageIndex + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex(i => Math.min(totalPages - 1, i + 1))}
              disabled={pageIndex >= totalPages - 1}
              aria-label="Next sheet"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Select value={zoom} onValueChange={setZoom}>
              <SelectTrigger className="w-[90px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZOOM_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6 min-h-0 bg-muted/20">
          <div
            className="mx-auto"
            style={{ width: `calc(8.5in * ${zoomValue})`, height: `calc(11in * ${zoomValue})` }}
          >
            <div
              className="bg-white shadow-lg"
              style={{
                width: "8.5in",
                height: "11in",
                padding: `${template.marginTop}in ${template.marginLeft}in`,
                transform: `scale(${zoomValue})`,
                transformOrigin: "top left",
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
            </div>
          </div>
        </div>
      </DialogContent>

      <LabelCustomizationDialog
        open={showCustomization}
        onOpenChange={setShowCustomization}
        customization={customization}
        onSave={onCustomizationChange}
        templateDimensions={{ width: template.width, height: template.height }}
      />

      {/* In-app PDF preview */}
      <Dialog open={showPdfPreview} onOpenChange={(isOpen) => !isOpen && closePdfPreview()}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0" aria-describedby={undefined}>
          <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>PDF preview</DialogTitle>
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" onClick={handleDownloadFromPreview} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
                <Button variant="outline" size="icon" onClick={closePdfPreview}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted">
            {pdfBlobUrl && (
              <object data={pdfBlobUrl} type="application/pdf" className="w-full h-full">
                <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                  <p className="text-muted-foreground text-center">
                    Unable to display the PDF preview in this browser.
                  </p>
                  <Button onClick={handleDownloadFromPreview} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download PDF instead
                  </Button>
                </div>
              </object>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
