import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Settings } from "lucide-react";
import { useState } from "react";
import { LabelCustomizationDialog, LabelCustomization } from "./LabelCustomizationDialog";

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
  });
  
  const template = AVERY_TEMPLATES[selectedTemplate];
  const labelsPerPage = template.cols * template.rows;
  const totalPages = Math.ceil(data.length / labelsPerPage);

  const handlePrint = () => {
    window.print();
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
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print Labels
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="space-y-8">
            {Array.from({ length: totalPages }).map((_, pageIndex) => {
              const startIndex = pageIndex * labelsPerPage;
              const pageLabels = data.slice(startIndex, startIndex + labelsPerPage);
              
              return (
                <div
                  key={pageIndex}
                  className="mx-auto bg-white shadow-lg"
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
                          className="border border-dashed border-muted flex flex-col p-1"
                          style={{
                            fontSize: template.height < 1 ? "7px" : template.height < 1.5 ? "9px" : "10px",
                            lineHeight: template.height < 1 ? "1.2" : "1.3",
                          }}
                        >
                          {label ? (
                            <div className="flex flex-col h-full">
                              {/* Top section with logo and return address */}
                              {(customization.showLogo || customization.showReturnAddress) && (
                                <div className="flex items-start justify-between mb-1 pb-1 border-b border-dashed border-muted">
                                  {customization.showLogo && customization.logoUrl && (
                                    <img 
                                      src={customization.logoUrl} 
                                      alt="Logo" 
                                      className="h-4 w-auto object-contain"
                                      style={{ maxHeight: template.height < 1.5 ? "12px" : "16px" }}
                                    />
                                  )}
                                  {customization.showReturnAddress && customization.returnAddress && (
                                    <div className="text-left" style={{ fontSize: "0.7em" }}>
                                      {customization.returnAddress.split('\n').slice(0, 2).map((line, i) => (
                                        <div key={i} className="truncate">{line}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Main address section */}
                              <div className="flex-1 flex items-center">
                                <div className="text-left w-full px-1">
                                  <div className="font-medium truncate">{label.contact}</div>
                                  <div className="truncate">{label.address1}</div>
                                  {label.address2 && <div className="truncate">{label.address2}</div>}
                                  <div className="truncate">
                                    {label.city}{label.city && label.state ? ", " : ""}{label.state} {label.zip}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Branding footer */}
                              {customization.showBranding && customization.brandingText && (
                                <div className="text-center mt-1 pt-1 border-t border-dashed border-muted">
                                  <div className="truncate font-medium" style={{ fontSize: "0.8em" }}>
                                    {customization.brandingText}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Empty</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-center text-xs text-muted-foreground mt-2">
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
      />

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </Dialog>
  );
};
