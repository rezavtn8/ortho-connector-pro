import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Upload, X, Sparkles, Type, ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { calculateOptimalSizes, getCustomizationRanges } from "@/utils/labelSizing";
import { optimizeLabelLayout, explainOptimization } from "@/utils/labelOptimization";
import type { LogoPosition, ReturnAddressPosition } from "@/utils/labelOptimization";

export type { LogoPosition, ReturnAddressPosition };

export interface LabelCustomization {
  logoUrl?: string;
  logoSizeMultiplier: number;
  fontSizeMultiplier: number;
  logoPosition: LogoPosition;
  returnAddress?: string;
  returnAddressPosition: ReturnAddressPosition;
  brandingText?: string;
  showLogo: boolean;
  showReturnAddress: boolean;
  showBranding: boolean;
  showFromLabel: boolean;
  showToLabel: boolean;
  useAutoOptimization: boolean;
  useTwoZoneLayout: boolean;
}

interface LabelCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customization: LabelCustomization;
  onSave: (customization: LabelCustomization) => void;
  templateDimensions?: { width: number; height: number };
}

export const LabelCustomizationDialog = ({ 
  open, 
  onOpenChange, 
  customization,
  onSave,
  templateDimensions = { width: 2.625, height: 1 }
}: LabelCustomizationDialogProps) => {
  const [localCustomization, setLocalCustomization] = useState<LabelCustomization>(customization);
  
  // Get customization ranges based on label size
  const ranges = getCustomizationRanges(templateDimensions);
  const isLargeLabel = templateDimensions.height >= 2.5;
  
  // Auto-optimize on content changes (only when auto-optimization is enabled)
  useEffect(() => {
    if (!localCustomization.useAutoOptimization) return;
    
    const optimized = optimizeLabelLayout(
      templateDimensions,
      !!localCustomization.logoUrl,
      !!localCustomization.returnAddress,
      localCustomization.returnAddress
    );
    
    setLocalCustomization(prev => ({
      ...prev,
      logoPosition: optimized.logoPosition,
      returnAddressPosition: optimized.returnAddressPosition,
      logoSizeMultiplier: optimized.logoSizeMultiplier,
      fontSizeMultiplier: optimized.fontSizeMultiplier,
      showFromLabel: optimized.showFromLabel,
      showToLabel: optimized.showToLabel,
      useTwoZoneLayout: optimized.useTwoZoneLayout,
    }));
  }, [
    templateDimensions.width,
    templateDimensions.height,
    localCustomization.logoUrl,
    localCustomization.returnAddress,
    localCustomization.useAutoOptimization,
  ]);
  
  const optimizationExplanation = localCustomization.useAutoOptimization 
    ? explainOptimization(
        templateDimensions,
        optimizeLabelLayout(
          templateDimensions,
          !!localCustomization.logoUrl,
          !!localCustomization.returnAddress,
          localCustomization.returnAddress
        )
      )
    : `Manual mode: ${ranges.description}`;

  // Calculate current sizes for display
  const calculatedSizes = calculateOptimalSizes(
    templateDimensions,
    localCustomization.logoSizeMultiplier,
    localCustomization.fontSizeMultiplier
  );

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

  const fontSizePercent = Math.round(localCustomization.fontSizeMultiplier * 100);
  const logoSizePercent = Math.round(localCustomization.logoSizeMultiplier * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Customize Mailing Labels
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">{optimizationExplanation}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Auto-optimization toggle */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">Auto-Optimization</div>
                  <div className="text-xs text-muted-foreground">
                    Automatically determines optimal layout and sizing for {templateDimensions.height}" × {templateDimensions.width}" labels
                  </div>
                </div>
              </div>
              <Switch
                checked={localCustomization.useAutoOptimization}
                onCheckedChange={(checked) => 
                  setLocalCustomization(prev => ({ ...prev, useAutoOptimization: checked }))
                }
              />
            </div>
          </div>

          {/* Manual Size Controls - shown when auto-optimization is off */}
          {!localCustomization.useAutoOptimization && (
            <div className="space-y-5 p-4 border border-border rounded-lg bg-muted/30">
              <div className="text-sm font-medium flex items-center gap-2">
                <Type className="h-4 w-4" />
                Manual Size Adjustments
              </div>
              
              {/* Font Size Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Font Size</Label>
                  <span className="text-sm font-medium text-primary">{fontSizePercent}%</span>
                </div>
                <Slider
                  value={[localCustomization.fontSizeMultiplier]}
                  onValueChange={([value]) => 
                    setLocalCustomization(prev => ({ ...prev, fontSizeMultiplier: value }))
                  }
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span className="text-foreground">{calculatedSizes.mainFontSize}px main text</span>
                  <span>200%</span>
                </div>
              </div>
              
              {/* Logo Size Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <ImageIcon className="h-3 w-3" />
                    Logo Size
                  </Label>
                  <span className="text-sm font-medium text-primary">{logoSizePercent}%</span>
                </div>
                <Slider
                  value={[localCustomization.logoSizeMultiplier]}
                  onValueChange={([value]) => 
                    setLocalCustomization(prev => ({ ...prev, logoSizeMultiplier: value }))
                  }
                  min={0.25}
                  max={2.5}
                  step={0.05}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>25%</span>
                  <span className="text-foreground">{calculatedSizes.logoHeight}px height</span>
                  <span>250%</span>
                </div>
              </div>

              {/* Two-zone layout toggle for large labels */}
              {isLargeLabel && localCustomization.showLogo && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <Label className="text-sm">Two-Zone Layout</Label>
                    <p className="text-xs text-muted-foreground">Logo in top half, address in bottom half</p>
                  </div>
                  <Switch
                    checked={localCustomization.useTwoZoneLayout}
                    onCheckedChange={(checked) => 
                      setLocalCustomization(prev => ({ ...prev, useTwoZoneLayout: checked }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* Logo Section */}
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
              <div className="space-y-3">
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
                
                {/* Large label notice */}
                {isLargeLabel && localCustomization.logoUrl && (
                  <p className="text-xs text-primary bg-primary/10 p-2 rounded">
                    Large label detected! Logo will appear prominently in the top half when two-zone layout is enabled.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Return Address Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Return Address</Label>
              <Switch
                checked={localCustomization.showReturnAddress}
                onCheckedChange={(checked) => 
                  setLocalCustomization(prev => ({ ...prev, showReturnAddress: checked }))
                }
              />
            </div>

            {localCustomization.showReturnAddress && (
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
            )}
          </div>

          {/* Branding Section */}
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
              />
            )}
          </div>
        </div>

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
