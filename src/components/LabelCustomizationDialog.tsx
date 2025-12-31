import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, X, Sparkles, Type, ImageIcon, AlignLeft, AlignCenter, AlignRight, LayoutGrid, Building, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  calculateLabelLayout,
  suggestOptimalSettings,
  type LayoutMode,
  type ToAlignment,
  type FromPosition,
  type LineSpacing,
} from "@/utils/labelLayoutEngine";
import { useSavedLabelSettings } from "@/hooks/useSavedLabelSettings";

// Export types for external use
export type { LayoutMode, ToAlignment, FromPosition, LineSpacing };
export type LogoPosition = "top-left" | "top-center" | "top-right" | "center" | "top-half";
export type ReturnAddressPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface LabelCustomization {
  logoUrl?: string;
  logoSizeMultiplier: number;
  fontSizeMultiplier: number;
  fromFontSizeMultiplier: number;
  showLogo: boolean;
  showReturnAddress: boolean;
  showBranding: boolean;
  showFromLabel: boolean;
  showToLabel: boolean;
  returnAddress?: string;
  brandingText?: string;
  useAutoOptimization: boolean;
  // New layout controls
  layoutMode: LayoutMode;
  toAlignment: ToAlignment;
  fromPosition: FromPosition;
  lineSpacing: LineSpacing;
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
  const [hasAutoLoadedSettings, setHasAutoLoadedSettings] = useState(false);
  const savedSettings = useSavedLabelSettings();
  
  const hasSavedLogo = !savedSettings.isLoading && !!savedSettings.clinicLogoUrl;
  const hasSavedAddress = !savedSettings.isLoading && !!savedSettings.clinicAddress;
  const hasSavedClinicName = !savedSettings.isLoading && !!savedSettings.clinicName;
  const isLargeLabel = templateDimensions.height >= 2.5;
  
  // Auto-load saved settings on first dialog open when settings are available
  useEffect(() => {
    if (savedSettings.isLoading || hasAutoLoadedSettings) return;
    
    const updates: Partial<LabelCustomization> = {};
    
    // Auto-load logo from settings if not already set
    if (savedSettings.clinicLogoUrl && !localCustomization.logoUrl) {
      updates.logoUrl = savedSettings.clinicLogoUrl;
      updates.showLogo = true;
    }
    
    // Auto-load return address from settings if not already set
    if (savedSettings.clinicAddress && !localCustomization.returnAddress) {
      updates.returnAddress = savedSettings.clinicAddress;
      updates.showReturnAddress = true;
    }
    
    // Auto-load branding text from settings if not already set
    if (savedSettings.clinicName && !localCustomization.brandingText) {
      updates.brandingText = savedSettings.clinicName;
    }
    
    if (Object.keys(updates).length > 0) {
      setLocalCustomization(prev => ({ ...prev, ...updates }));
    }
    
    setHasAutoLoadedSettings(true);
  }, [savedSettings.isLoading, savedSettings.clinicLogoUrl, savedSettings.clinicAddress, savedSettings.clinicName, hasAutoLoadedSettings]);
  
  // Auto-optimize on content changes when enabled
  useEffect(() => {
    if (!localCustomization.useAutoOptimization) return;
    
    const suggestions = suggestOptimalSettings(
      templateDimensions,
      !!localCustomization.logoUrl,
      !!localCustomization.returnAddress
    );
    
    setLocalCustomization(prev => ({
      ...prev,
      layoutMode: suggestions.layoutMode || 'auto',
      fontSizeMultiplier: suggestions.fontSizeMultiplier || 1.0,
      logoSizeMultiplier: suggestions.logoSizeMultiplier || 1.0,
      lineSpacing: suggestions.lineSpacing || 'normal',
      toAlignment: suggestions.toAlignment || 'center',
      fromPosition: suggestions.fromPosition || 'top-left',
      showFromLabel: suggestions.showFromLabel ?? true,
      showToLabel: suggestions.showToLabel ?? true,
    }));
  }, [
    templateDimensions.width,
    templateDimensions.height,
    localCustomization.logoUrl,
    localCustomization.returnAddress,
    localCustomization.useAutoOptimization,
  ]);
  
  // Calculate layout for preview description
  const layout = calculateLabelLayout(
    templateDimensions,
    {
      showLogo: localCustomization.showLogo && !!localCustomization.logoUrl,
      showFromAddress: localCustomization.showReturnAddress && !!localCustomization.returnAddress,
      showToLabel: localCustomization.showToLabel,
      showFromLabel: localCustomization.showFromLabel,
      showBranding: localCustomization.showBranding && !!localCustomization.brandingText,
      logoSizeMultiplier: localCustomization.logoSizeMultiplier,
      fontSizeMultiplier: localCustomization.fontSizeMultiplier,
      fromFontSizeMultiplier: localCustomization.fromFontSizeMultiplier,
      lineSpacing: localCustomization.lineSpacing,
      toAlignment: localCustomization.toAlignment,
      fromPosition: localCustomization.fromPosition,
      layoutMode: localCustomization.layoutMode,
    },
    localCustomization.returnAddress?.split('\n').length || 0,
    4
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
  const fromFontSizePercent = Math.round(localCustomization.fromFontSizeMultiplier * 100);
  const logoSizePercent = Math.round(localCustomization.logoSizeMultiplier * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Customize Mailing Labels
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {layout.description} • {templateDimensions.width}" × {templateDimensions.height}"
          </p>
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
                    Automatically determines optimal layout and sizing
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

          {/* Manual Controls - shown when auto-optimization is off */}
          {!localCustomization.useAutoOptimization && (
            <div className="space-y-6 p-4 border border-border rounded-lg bg-muted/30">
              {/* Layout Mode */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <Label className="text-sm font-medium">Layout Mode</Label>
                </div>
                <Select 
                  value={localCustomization.layoutMode} 
                  onValueChange={(value: LayoutMode) => 
                    setLocalCustomization(prev => ({ ...prev, layoutMode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (intelligent based on label size)</SelectItem>
                    <SelectItem value="stacked">Stacked (Logo → From → To vertically)</SelectItem>
                    <SelectItem value="split">Split (From left, To right - for wide labels)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* To: Address Alignment */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">To Address Alignment</Label>
                <RadioGroup 
                  value={localCustomization.toAlignment}
                  onValueChange={(value: ToAlignment) => 
                    setLocalCustomization(prev => ({ ...prev, toAlignment: value }))
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="left" id="align-left" />
                    <Label htmlFor="align-left" className="flex items-center gap-1 cursor-pointer">
                      <AlignLeft className="h-4 w-4" /> Left
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="center" id="align-center" />
                    <Label htmlFor="align-center" className="flex items-center gap-1 cursor-pointer">
                      <AlignCenter className="h-4 w-4" /> Center
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="right" id="align-right" />
                    <Label htmlFor="align-right" className="flex items-center gap-1 cursor-pointer">
                      <AlignRight className="h-4 w-4" /> Right
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* From Address Position */}
              {localCustomization.showReturnAddress && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">From Address Position</Label>
                  <RadioGroup 
                    value={localCustomization.fromPosition}
                    onValueChange={(value: FromPosition) => 
                      setLocalCustomization(prev => ({ ...prev, fromPosition: value }))
                    }
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="top-left" id="from-left" />
                      <Label htmlFor="from-left" className="cursor-pointer">Top-Left</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="top-right" id="from-right" />
                      <Label htmlFor="from-right" className="cursor-pointer">Top-Right</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Line Spacing */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Line Spacing</Label>
                <Select 
                  value={localCustomization.lineSpacing} 
                  onValueChange={(value: LineSpacing) => 
                    setLocalCustomization(prev => ({ ...prev, lineSpacing: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact (tight spacing)</SelectItem>
                    <SelectItem value="normal">Normal (balanced)</SelectItem>
                    <SelectItem value="relaxed">Relaxed (spacious)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size Sliders */}
              <div className="space-y-5 pt-4 border-t border-border">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Size Adjustments
                </div>
                
                {/* Main Font Size */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Main Font Size (To address)</Label>
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
                    <span>200%</span>
                  </div>
                </div>
                
                {/* From Address Font Size */}
                {localCustomization.showReturnAddress && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">From Address Size</Label>
                      <span className="text-sm font-medium text-primary">{fromFontSizePercent}%</span>
                    </div>
                    <Slider
                      value={[localCustomization.fromFontSizeMultiplier]}
                      onValueChange={([value]) => 
                        setLocalCustomization(prev => ({ ...prev, fromFontSizeMultiplier: value }))
                      }
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>50%</span>
                      <span>150%</span>
                    </div>
                  </div>
                )}
                
                {/* Logo Size */}
                {localCustomization.showLogo && localCustomization.logoUrl && (
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
                      <span>250%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Label Toggles */}
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="text-sm font-medium">Visual Labels</div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show "From:" label</Label>
                  <Switch
                    checked={localCustomization.showFromLabel}
                    onCheckedChange={(checked) => 
                      setLocalCustomization(prev => ({ ...prev, showFromLabel: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show "To:" label</Label>
                  <Switch
                    checked={localCustomization.showToLabel}
                    onCheckedChange={(checked) => 
                      setLocalCustomization(prev => ({ ...prev, showToLabel: checked }))
                    }
                  />
                </div>
              </div>
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
                {/* Use saved logo from settings button - show when no logo OR when logo differs from settings */}
                {hasSavedLogo && localCustomization.logoUrl !== savedSettings.clinicLogoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-primary/50 text-primary hover:bg-primary/10"
                    onClick={() => setLocalCustomization(prev => ({ 
                      ...prev, 
                      logoUrl: savedSettings.clinicLogoUrl 
                    }))}
                  >
                    <Building className="h-4 w-4" />
                    {localCustomization.logoUrl ? 'Reset to Logo from Settings' : 'Use Logo from Settings'}
                  </Button>
                )}
                
                {localCustomization.logoUrl ? (
                  <div className="relative">
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
                    {hasSavedLogo && localCustomization.logoUrl === savedSettings.clinicLogoUrl && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-500" />
                        Using logo from Settings
                      </p>
                    )}
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
                
                {isLargeLabel && localCustomization.logoUrl && (
                  <p className="text-xs text-primary bg-primary/10 p-2 rounded">
                    Large label: Logo will appear prominently at the top in stacked layout.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Return Address Section */}
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
              <div className="space-y-3">
                {/* Use saved address from settings button - show when address differs from settings */}
                {hasSavedAddress && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-primary/50 text-primary hover:bg-primary/10"
                    onClick={() => setLocalCustomization(prev => ({ 
                      ...prev, 
                      returnAddress: `${savedSettings.clinicName || ''}\n${savedSettings.clinicAddress || ''}`.trim()
                    }))}
                  >
                    <Building className="h-4 w-4" />
                    {localCustomization.returnAddress ? 'Reset to Address from Settings' : 'Use Address from Settings'}
                  </Button>
                )}
                
                <Textarea
                  placeholder="Your Name&#10;Your Address Line 1&#10;City, State ZIP"
                  value={localCustomization.returnAddress || ""}
                  onChange={(e) => setLocalCustomization(prev => ({ 
                    ...prev, 
                    returnAddress: e.target.value 
                  }))}
                  rows={3}
                  className="resize-none"
                />
                
                {hasSavedAddress && localCustomization.returnAddress?.includes(savedSettings.clinicAddress || '') && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-500" />
                    Using address from Settings
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Branding Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Branding Text (Footer)</Label>
              <Switch
                checked={localCustomization.showBranding}
                onCheckedChange={(checked) => 
                  setLocalCustomization(prev => ({ ...prev, showBranding: checked }))
                }
              />
            </div>

            {localCustomization.showBranding && (
              <div className="space-y-3">
                {/* Use clinic name from settings - show when branding differs from settings */}
                {hasSavedClinicName && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-primary/50 text-primary hover:bg-primary/10"
                    onClick={() => setLocalCustomization(prev => ({ 
                      ...prev, 
                      brandingText: savedSettings.clinicName 
                    }))}
                  >
                    <Building className="h-4 w-4" />
                    {localCustomization.brandingText ? 'Reset to Clinic Name from Settings' : 'Use Clinic Name from Settings'}
                  </Button>
                )}
                
                <Input
                  placeholder="e.g., Your Company Name"
                  value={localCustomization.brandingText || ""}
                  onChange={(e) => setLocalCustomization(prev => ({ 
                    ...prev, 
                    brandingText: e.target.value 
                  }))}
                />
              </div>
            )}
          </div>

          {/* Layout Preview Description */}
          {layout.hasOverflow && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Content may overflow the label. Try reducing font sizes or disabling some elements.
              </p>
            </div>
          )}
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
