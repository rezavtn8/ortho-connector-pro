import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Settings, FileDown } from "lucide-react";
import { useState } from "react";
import { LabelCustomizationDialog, LabelCustomization, LogoPosition, ReturnAddressPosition } from "./LabelCustomizationDialog";
import { calculateOptimalSizes } from "@/utils/labelSizing";
import { toast } from "@/hooks/use-toast";
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
};

export const MailingLabelPreview = ({ open, onOpenChange, data }: MailingLabelPreviewProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof AVERY_TEMPLATES>("5160");
  const [showCustomization, setShowCustomization] = useState(false);
  const [customization, setCustomization] = useState<LabelCustomization>({
    showLogo: false,
    showReturnAddress: false,
    showBranding: false,
    showFromLabel: true,
    showToLabel: true,
    logoSizeMultiplier: 1.0,
    fontSizeMultiplier: 1.0,
    logoPosition: "top-left" as LogoPosition,
    returnAddressPosition: "top-left" as ReturnAddressPosition,
  });
  
  const template = AVERY_TEMPLATES[selectedTemplate];
  const labelsPerPage = template.cols * template.rows;
  const totalPages = Math.ceil(data.length / labelsPerPage);
  
  // Calculate dynamic sizes for current template
  const calculatedSizes = calculateOptimalSizes(
    { width: template.width, height: template.height },
    customization.logoSizeMultiplier,
    customization.fontSizeMultiplier
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    toast({
      title: "Exporting to PDF",
      description: "Select 'Save as PDF' as your printer destination.",
    });
    // Use print dialog - user can choose "Save as PDF" as destination
    setTimeout(() => window.print(), 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">Mailing Label Preview</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {data.length} labels • {totalPages} page{totalPages !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedTemplate} onValueChange={(value) => setSelectedTemplate(value as keyof typeof AVERY_TEMPLATES)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AVERY_TEMPLATES).map(([key, template]) => (
                    <SelectItem key={key} value={key}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => setShowCustomization(true)} 
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Customize
              </Button>
              <Button variant="outline" onClick={handleExportPDF} className="gap-2">
                <FileDown className="h-4 w-4" />
                Save PDF
              </Button>
              <Button onClick={handlePrint} className="gap-2">
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
                    {Array.from({ length: labelsPerPage }).map((_, labelIndex) => {
                      const label = pageLabels[labelIndex];
                      
                      return (
                        <div
                          key={labelIndex}
                          className="border border-dashed border-muted print:border-transparent relative"
                          style={{
                            fontSize: `${calculatedSizes.mainFontSize}px`,
                            lineHeight: "1.3",
                            padding: `${calculatedSizes.padding}px`,
                          }}
                        >
                          {label ? (
                            <div className="h-full relative">
                              {/* Logo positioning with dynamic sizing */}
                              {customization.showLogo && customization.logoUrl && (
                                <div
                                  style={{
                                    position: "absolute",
                                    ...(customization.logoPosition === "top-left" && { top: "2px", left: "2px" }),
                                    ...(customization.logoPosition === "top-center" && { top: "2px", left: "50%", transform: "translateX(-50%)" }),
                                    ...(customization.logoPosition === "top-right" && { top: "2px", right: "2px" }),
                                    ...(customization.logoPosition === "center" && { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
                                    zIndex: 1,
                                  }}
                                >
                                  <img 
                                    src={customization.logoUrl} 
                                    alt="Logo" 
                                    style={{ 
                                      height: `${calculatedSizes.logoHeight}px`,
                                      width: "auto",
                                      maxWidth: `${calculatedSizes.maxLogoWidth}px`,
                                    }}
                                  />
                                </div>
                              )}

                              {/* Return Address with positioning */}
                              {customization.showReturnAddress && customization.returnAddress && (
                                <div
                                  style={{
                                    position: "absolute",
                                    fontSize: `${calculatedSizes.returnFontSize}px`,
                                    lineHeight: "1.2",
                                    maxWidth: "45%",
                                    ...(customization.returnAddressPosition === "top-left" && { top: "2px", left: "2px" }),
                                    ...(customization.returnAddressPosition === "top-right" && { top: "2px", right: "2px", textAlign: "right" }),
                                    ...(customization.returnAddressPosition === "bottom-left" && { bottom: "2px", left: "2px" }),
                                    ...(customization.returnAddressPosition === "bottom-right" && { bottom: "2px", right: "2px", textAlign: "right" }),
                                    zIndex: 1,
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
                              
                              {/* Main recipient address - centered */}
                              <div
                                style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: "50%",
                                  transform: "translate(-50%, -50%)",
                                  textAlign: "center",
                                  width: "90%",
                                }}
                              >
                                {customization.showToLabel && (
                                  <div className="font-semibold mb-1">To:</div>
                                )}
                                <div className="font-medium truncate">{label.contact}</div>
                                <div className="truncate">{label.address1}</div>
                                {label.address2 && <div className="truncate">{label.address2}</div>}
                                <div className="truncate">
                                  {label.city}{label.city && label.state ? ", " : ""}{label.state} {label.zip}
                                </div>
                              </div>
                              
                              {/* Branding footer */}
                              {customization.showBranding && customization.brandingText && (
                                <div
                                  style={{
                                    position: "absolute",
                                    bottom: "2px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    fontSize: "0.7em",
                                    fontWeight: 600,
                                  }}
                                >
                                  <div className="truncate">{customization.brandingText}</div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground print:hidden text-xs">Empty</span>
                          )}
                        </div>
                      );
                    })}
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

      <style>{`
        @media print {
          /* Hide everything except print area */
          body * {
            visibility: hidden !important;
          }
          
          .print-area,
          .print-area * {
            visibility: visible !important;
          }
          
          .print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            z-index: 9999 !important;
          }
          
          .label-page {
            page-break-after: always;
            margin: 0 !important;
            box-shadow: none !important;
          }
          
          .label-page:last-child {
            page-break-after: auto;
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
