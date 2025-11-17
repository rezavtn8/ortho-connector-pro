import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X } from "lucide-react";
import { useState } from "react";

export interface LabelCustomization {
  logoUrl?: string;
  returnAddress?: string;
  brandingText?: string;
  showLogo: boolean;
  showReturnAddress: boolean;
  showBranding: boolean;
}

interface LabelCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customization: LabelCustomization;
  onSave: (customization: LabelCustomization) => void;
}

export const LabelCustomizationDialog = ({ 
  open, 
  onOpenChange, 
  customization,
  onSave 
}: LabelCustomizationDialogProps) => {
  const [localCustomization, setLocalCustomization] = useState<LabelCustomization>(customization);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize Mailing Labels</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Logo Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Logo</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocalCustomization(prev => ({ ...prev, showLogo: !prev.showLogo }))}
              >
                {localCustomization.showLogo ? "Hide" : "Show"}
              </Button>
            </div>
            
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
                  <span className="text-sm text-muted-foreground">Click to upload logo</span>
                </Label>
              </div>
            )}
          </div>

          {/* Return Address */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="return-address" className="text-base font-medium">Return Address</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocalCustomization(prev => ({ ...prev, showReturnAddress: !prev.showReturnAddress }))}
              >
                {localCustomization.showReturnAddress ? "Hide" : "Show"}
              </Button>
            </div>
            <Textarea
              id="return-address"
              placeholder="Your Name&#10;Your Address Line 1&#10;Your Address Line 2&#10;City, State ZIP"
              value={localCustomization.returnAddress || ""}
              onChange={(e) => setLocalCustomization(prev => ({ ...prev, returnAddress: e.target.value }))}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Branding Text */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="branding-text" className="text-base font-medium">Branding Text</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocalCustomization(prev => ({ ...prev, showBranding: !prev.showBranding }))}
              >
                {localCustomization.showBranding ? "Hide" : "Show"}
              </Button>
            </div>
            <Input
              id="branding-text"
              placeholder="e.g., Your Company Name"
              value={localCustomization.brandingText || ""}
              onChange={(e) => setLocalCustomization(prev => ({ ...prev, brandingText: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Customization
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
