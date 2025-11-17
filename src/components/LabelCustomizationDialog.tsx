import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Upload, X, Save, Trash2, Download, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { calculateOptimalSizes, getCustomizationRanges } from "@/utils/labelSizing";

export type LogoPosition = "top-left" | "top-center" | "top-right" | "center";
export type ReturnAddressPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface LabelCustomization {
  logoUrl?: string;
  logoSizeMultiplier: number;  // 0.5 to 1.5
  fontSizeMultiplier: number;  // 0.8 to 1.2
  logoPosition: LogoPosition;
  returnAddress?: string;
  returnAddressPosition: ReturnAddressPosition;
  brandingText?: string;
  showLogo: boolean;
  showReturnAddress: boolean;
  showBranding: boolean;
  showFromLabel: boolean;
  showToLabel: boolean;
}

interface LabelCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customization: LabelCustomization;
  onSave: (customization: LabelCustomization) => void;
  templateDimensions?: { width: number; height: number };
}

interface SavedTemplate {
  name: string;
  customization: LabelCustomization;
  createdAt: string;
}

const TEMPLATES_STORAGE_KEY = "mailing_label_templates";

export const LabelCustomizationDialog = ({ 
  open, 
  onOpenChange, 
  customization,
  onSave,
  templateDimensions = { width: 2.625, height: 1 }
}: LabelCustomizationDialogProps) => {
  const [localCustomization, setLocalCustomization] = useState<LabelCustomization>(customization);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  
  // Calculate optimal sizes based on current template dimensions
  const calculatedSizes = calculateOptimalSizes(
    templateDimensions,
    localCustomization.logoSizeMultiplier,
    localCustomization.fontSizeMultiplier
  );
  
  const ranges = getCustomizationRanges(templateDimensions);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (stored) {
      try {
        setSavedTemplates(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load templates", e);
      }
    }
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    const newTemplate: SavedTemplate = {
      name: templateName,
      customization: localCustomization,
      createdAt: new Date().toISOString(),
    };

    const updatedTemplates = [...savedTemplates, newTemplate];
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    setSavedTemplates(updatedTemplates);
    setTemplateName("");
    toast.success("Template saved successfully");
  };

  const loadTemplate = (template: SavedTemplate) => {
    setLocalCustomization(template.customization);
    toast.success(`Loaded template: ${template.name}`);
  };

  const deleteTemplate = (templateName: string) => {
    const updatedTemplates = savedTemplates.filter(t => t.name !== templateName);
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    setSavedTemplates(updatedTemplates);
    toast.success("Template deleted");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo file size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalCustomization(prev => ({
          ...prev,
          logoUrl: reader.result as string,
          showLogo: true
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSave(localCustomization);
    onOpenChange(false);
    toast.success("Label customization applied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Mailing Labels</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="design" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            {/* Phase 1: Design Tab - Logo and Branding */}
            <TabsContent value="design" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Logo</Label>
                  <Switch
                    checked={localCustomization.showLogo}
                    onCheckedChange={(checked) => 
                      setLocalCustomization(prev => ({ ...prev, showLogo: checked }))
                    }
                  />
                </div>

                {localCustomization.showLogo && (
                  <div className="space-y-4 pl-4 border-l-2 border-border">
                    {localCustomization.logoUrl ? (
                      <div className="relative w-32 h-32 border border-border rounded-lg overflow-hidden bg-muted/30">
                        <img 
                          src={localCustomization.logoUrl} 
                          alt="Logo" 
                          className="w-full h-full object-contain p-2"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => setLocalCustomization(prev => ({ ...prev, logoUrl: undefined }))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <Label
                          htmlFor="logo-upload"
                          className="flex items-center justify-center gap-2 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Upload logo (max 2MB)</span>
                        </Label>
                      </div>
                    )}

                    {/* Dynamic Logo Sizing */}
                    <div className="space-y-4">
                      <div className="flex items-start gap-2">
                        <Label>Logo Size</Label>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <Info className="h-3 w-3" />
                            <span>Automatically scales to {calculatedSizes.logoHeight}px on this {templateDimensions.height}" label</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pl-4 border-l-2 border-border">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Smaller</span>
                          <span className="font-medium">
                            {Math.round(localCustomization.logoSizeMultiplier * 100)}%
                          </span>
                          <span className="text-muted-foreground">Larger</span>
                        </div>
                        <Slider
                          value={[localCustomization.logoSizeMultiplier]}
                          onValueChange={([value]) => 
                            setLocalCustomization(prev => ({ ...prev, logoSizeMultiplier: value }))
                          }
                          min={ranges.logoMultiplier.min}
                          max={ranges.logoMultiplier.max}
                          step={ranges.logoMultiplier.step}
                          className="flex-1"
                        />
                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded flex items-start gap-2">
                          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>
                            {ranges.description}. Logo will be {calculatedSizes.logoHeight}px tall 
                            (max width: {calculatedSizes.maxLogoWidth}px)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Logo Position</Label>
                      <Select 
                        value={localCustomization.logoPosition}
                        onValueChange={(value: LogoPosition) => 
                          setLocalCustomization(prev => ({ ...prev, logoPosition: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top-left">Top Left</SelectItem>
                          <SelectItem value="top-center">Top Center</SelectItem>
                          <SelectItem value="top-right">Top Right</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Branding Text</Label>
                  <Switch
                    checked={localCustomization.showBranding}
                    onCheckedChange={(checked) => 
                      setLocalCustomization(prev => ({ ...prev, showBranding: checked }))
                    }
                  />
                </div>

                {localCustomization.showBranding && (
                  <Input
                    placeholder="e.g., Your Company Name"
                    value={localCustomization.brandingText || ""}
                    onChange={(e) => setLocalCustomization(prev => ({ 
                      ...prev, 
                      brandingText: e.target.value 
                    }))}
                    className="ml-4"
                  />
                )}
              </div>
            </TabsContent>

            {/* Phase 2: Content Tab - Addresses and Labels */}
            <TabsContent value="content" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Return Address (From)</Label>
                  <Switch
                    checked={localCustomization.showReturnAddress}
                    onCheckedChange={(checked) => 
                      setLocalCustomization(prev => ({ ...prev, showReturnAddress: checked }))
                    }
                  />
                </div>

                {localCustomization.showReturnAddress && (
                  <div className="space-y-4 pl-4 border-l-2 border-border">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="show-from-label"
                        checked={localCustomization.showFromLabel}
                        onCheckedChange={(checked) => 
                          setLocalCustomization(prev => ({ ...prev, showFromLabel: checked }))
                        }
                      />
                      <Label htmlFor="show-from-label">Show "From:" label</Label>
                    </div>

                    <Textarea
                      placeholder="Your Name&#10;Your Address Line 1&#10;Your Address Line 2&#10;City, State ZIP"
                      value={localCustomization.returnAddress || ""}
                      onChange={(e) => setLocalCustomization(prev => ({ 
                        ...prev, 
                        returnAddress: e.target.value 
                      }))}
                      rows={4}
                      className="resize-none"
                    />

                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-to-label"
                    checked={localCustomization.showToLabel}
                    onCheckedChange={(checked) => 
                      setLocalCustomization(prev => ({ ...prev, showToLabel: checked }))
                    }
                  />
                  <Label htmlFor="show-to-label" className="text-base font-medium">Show "To:" label for recipient address</Label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Label>Font Scaling</Label>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Info className="h-3 w-3" />
                        <span>
                          Auto-sizes to {calculatedSizes.mainFontSize}px (main), 
                          {calculatedSizes.returnFontSize}px (return address)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pl-4 border-l-2 border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Smaller</span>
                      <span className="font-medium">
                        {Math.round(localCustomization.fontSizeMultiplier * 100)}%
                      </span>
                      <span className="text-muted-foreground">Larger</span>
                    </div>
                    <Slider
                      value={[localCustomization.fontSizeMultiplier]}
                      onValueChange={([value]) => 
                        setLocalCustomization(prev => ({ ...prev, fontSizeMultiplier: value }))
                      }
                      min={ranges.fontMultiplier.min}
                      max={ranges.fontMultiplier.max}
                      step={ranges.fontMultiplier.step}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Phase 3: Layout Tab - Positioning */}
            <TabsContent value="layout" className="space-y-6 mt-0">
              <div className="space-y-4">
                <Label className="text-base font-medium">Return Address Position</Label>
                <Select 
                  value={localCustomization.returnAddressPosition}
                  onValueChange={(value: ReturnAddressPosition) => 
                    setLocalCustomization(prev => ({ ...prev, returnAddressPosition: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Phase 2: Multi-Size Preview Section */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Layout Preview</Label>
                <p className="text-sm text-muted-foreground">
                  Preview how your design looks across different label sizes
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Small Label Preview (1" x 2.625") */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Small (1" × 2.625")</Label>
                    <div className="border-2 border-border rounded-lg p-3 bg-muted/20">
                      <div 
                        className="bg-background border border-border rounded"
                        style={{ 
                          width: "160px", 
                          height: "60px",
                          position: "relative",
                          padding: "4px"
                        }}
                      >
                        {localCustomization.showLogo && localCustomization.logoUrl && (
                          <div
                            style={{
                              position: "absolute",
                              ...(localCustomization.logoPosition === "top-left" && { top: "3px", left: "3px" }),
                              ...(localCustomization.logoPosition === "top-center" && { top: "3px", left: "50%", transform: "translateX(-50%)" }),
                              ...(localCustomization.logoPosition === "top-right" && { top: "3px", right: "3px" }),
                              ...(localCustomization.logoPosition === "center" && { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
                            }}
                          >
                            <img 
                              src={localCustomization.logoUrl} 
                              alt="Logo" 
                              style={{ 
                                height: `${calculateOptimalSizes({ width: 2.625, height: 1 }, localCustomization.logoSizeMultiplier, localCustomization.fontSizeMultiplier).logoHeight * 0.6}px`,
                                width: "auto"
                              }}
                            />
                          </div>
                        )}
                        {localCustomization.showReturnAddress && localCustomization.returnAddress && (
                          <div
                            style={{
                              position: "absolute",
                              fontSize: `${calculateOptimalSizes({ width: 2.625, height: 1 }, localCustomization.logoSizeMultiplier, localCustomization.fontSizeMultiplier).returnFontSize * 0.6}px`,
                              lineHeight: "1.2",
                              maxWidth: "40%",
                              ...(localCustomization.returnAddressPosition === "top-left" && { top: "2px", left: "2px" }),
                              ...(localCustomization.returnAddressPosition === "top-right" && { top: "2px", right: "2px", textAlign: "right" }),
                              ...(localCustomization.returnAddressPosition === "bottom-left" && { bottom: "2px", left: "2px" }),
                              ...(localCustomization.returnAddressPosition === "bottom-right" && { bottom: "2px", right: "2px", textAlign: "right" }),
                            }}
                          >
                            {localCustomization.showFromLabel && (
                              <div className="font-semibold">From:</div>
                            )}
                            {localCustomization.returnAddress.split('\n').slice(0, 2).map((line, i) => (
                              <div key={i} className="truncate">{line}</div>
                            ))}
                          </div>
                        )}
                        <div style={{ 
                          position: "absolute", 
                          fontSize: `${calculateOptimalSizes({ width: 2.625, height: 1 }, localCustomization.logoSizeMultiplier, localCustomization.fontSizeMultiplier).mainFontSize * 0.7}px`, 
                          lineHeight: "1.3", 
                          top: "50%", 
                          left: "50%", 
                          transform: "translate(-50%, -50%)", 
                          textAlign: "center" 
                        }}>
                          {localCustomization.showToLabel && <div className="font-semibold">To:</div>}
                          <div className="font-medium">Sample Office</div>
                          <div>123 Main St</div>
                          <div>City, ST 12345</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Large Label Preview (2" x 4") */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Large (2" × 4")</Label>
                    <div className="border-2 border-border rounded-lg p-3 bg-muted/20">
                      <div 
                        className="bg-background border border-border rounded"
                        style={{ 
                          width: "160px", 
                          height: "80px",
                          position: "relative",
                          padding: "6px"
                        }}
                      >
                        {/* Logo Preview */}
                        {localCustomization.showLogo && localCustomization.logoUrl && (
                          <div
                            style={{
                              position: "absolute",
                              ...(localCustomization.logoPosition === "top-left" && { top: "4px", left: "4px" }),
                              ...(localCustomization.logoPosition === "top-center" && { top: "4px", left: "50%", transform: "translateX(-50%)" }),
                              ...(localCustomization.logoPosition === "top-right" && { top: "4px", right: "4px" }),
                              ...(localCustomization.logoPosition === "center" && { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
                            }}
                          >
                            <img 
                              src={localCustomization.logoUrl} 
                              alt="Logo" 
                              style={{ 
                                height: `${calculateOptimalSizes({ width: 4, height: 2 }, localCustomization.logoSizeMultiplier, localCustomization.fontSizeMultiplier).logoHeight}px`,
                                width: "auto",
                                maxWidth: `${calculateOptimalSizes({ width: 4, height: 2 }, localCustomization.logoSizeMultiplier, localCustomization.fontSizeMultiplier).maxLogoWidth}px`
                              }}
                            />
                          </div>
                        )}

                        {/* Return Address Preview */}
                        {localCustomization.showReturnAddress && localCustomization.returnAddress && (
                          <div
                            style={{
                              position: "absolute",
                              fontSize: `${calculateOptimalSizes({ width: 4, height: 2 }, localCustomization.logoSizeMultiplier, localCustomization.fontSizeMultiplier).returnFontSize}px`,
                              lineHeight: "1.2",
                              maxWidth: "45%",
                              ...(localCustomization.returnAddressPosition === "top-left" && { top: "3px", left: "3px" }),
                              ...(localCustomization.returnAddressPosition === "top-right" && { top: "3px", right: "3px", textAlign: "right" }),
                              ...(localCustomization.returnAddressPosition === "bottom-left" && { bottom: "3px", left: "3px" }),
                              ...(localCustomization.returnAddressPosition === "bottom-right" && { bottom: "3px", right: "3px", textAlign: "right" }),
                            }}
                          >
                            {localCustomization.showFromLabel && (
                              <div className="font-semibold">From:</div>
                            )}
                            {localCustomization.returnAddress.split('\n').slice(0, 2).map((line, i) => (
                              <div key={i} className="truncate">{line}</div>
                            ))}
                          </div>
                        )}

                        {/* Main Address Preview */}
                        <div
                          style={{
                            position: "absolute",
                            fontSize: `${calculateOptimalSizes({ width: 4, height: 2 }, localCustomization.logoSizeMultiplier, localCustomization.fontSizeMultiplier).mainFontSize}px`,
                            lineHeight: "1.3",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            textAlign: "center"
                          }}
                        >
                          {localCustomization.showToLabel && (
                            <div className="font-semibold">To:</div>
                          )}
                          <div className="font-medium">Sample Office</div>
                          <div>123 Main Street</div>
                          <div>City, ST 12345</div>
                        </div>

                        {/* Branding Preview */}
                        {localCustomization.showBranding && localCustomization.brandingText && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "3px",
                              left: "50%",
                              transform: "translateX(-50%)",
                              fontSize: `${calculateOptimalSizes({ width: 4, height: 2 }, localCustomization.logoSizeMultiplier, localCustomization.fontSizeMultiplier).brandingFontSize}px`,
                              fontWeight: 600,
                            }}
                          >
                            {localCustomization.brandingText}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Phase 4: Templates Tab - Save and Load */}
            <TabsContent value="templates" className="space-y-6 mt-0">
              <div className="space-y-4">
                <Label className="text-base font-medium">Save Current Design</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Template name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                  <Button onClick={saveTemplate} className="gap-2">
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>

              {savedTemplates.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">Saved Templates</Label>
                  <div className="space-y-2">
                    {savedTemplates.map((template) => (
                      <div
                        key={template.name}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(template.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadTemplate(template)}
                            className="gap-2"
                          >
                            <Download className="h-3 w-3" />
                            Load
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteTemplate(template.name)}
                            className="gap-2"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Apply Customization
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
