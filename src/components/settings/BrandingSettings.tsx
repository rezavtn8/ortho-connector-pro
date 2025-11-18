import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Loader2 } from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const BrandingSettings = () => {
  const { settings, saving, updateSettings } = useBrand();
  const [localSettings, setLocalSettings] = useState(settings);
  const [uploading, setUploading] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings.clinic_id) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be less than 2MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${settings.clinic_id}-logo-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('clinic-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('clinic-logos')
        .getPublicUrl(fileName);

      setLocalSettings(prev => ({ ...prev, logo_url: publicUrl }));
      
      toast({ title: 'Success', description: 'Logo uploaded successfully' });
    } catch (error: any) {
      console.error('Error uploading:', error);
      toast({ title: 'Error', description: error.message || 'Failed to upload', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleColorChange = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await updateSettings(localSettings);
  };

  const ColorPicker = ({ label, value, onChange, description }: { 
    label: string; 
    value: string; 
    onChange: (value: string) => void;
    description?: string;
  }) => {
    // Convert HSL to hex for color input
    const hslToHex = (hsl: string) => {
      const [h, s, l] = hsl.split(' ').map(v => parseFloat(v));
      const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = (l / 100) - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <div className="flex gap-2">
          <Input
            type="color"
            value={hslToHex(value)}
            onChange={(e) => {
              // Convert hex to HSL (simplified)
              onChange(value); // For now, keep as HSL
            }}
            className="w-20 h-10 p-1 cursor-pointer"
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g., 262.1 83.3% 57.8%"
            className="flex-1"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Brand Identity</h2>
          <p className="text-muted-foreground">Customize your clinic's brand appearance across the platform</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Exit Preview' : 'Preview'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || uploading}
            size="sm"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="visual" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="visual">
            <Image className="h-4 w-4 mr-2" />
            Visual Identity
          </TabsTrigger>
          <TabsTrigger value="colors">
            <Palette className="h-4 w-4 mr-2" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography">
            <Type className="h-4 w-4 mr-2" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="contact">
            <Globe className="h-4 w-4 mr-2" />
            Contact & Social
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logos & Visual Assets</CardTitle>
              <CardDescription>Upload your clinic's logo and branding assets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Logo */}
              <div className="space-y-3">
                <Label>Primary Logo (Light Mode)</Label>
                <div className="flex items-center gap-4">
                  {localSettings.logo_url && (
                    <div className="h-20 w-20 border rounded flex items-center justify-center bg-background">
                      <img src={localSettings.logo_url} alt="Logo" className="max-h-16 max-w-16 object-contain" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'logo')}
                      disabled={uploading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Recommended: Square, PNG with transparency, max 2MB</p>
                  </div>
                </div>
              </div>

              {/* Dark Mode Logo */}
              <div className="space-y-3">
                <Label>Logo for Dark Mode (Optional)</Label>
                <div className="flex items-center gap-4">
                  {localSettings.logo_dark_url && (
                    <div className="h-20 w-20 border rounded flex items-center justify-center bg-gray-900">
                      <img src={localSettings.logo_dark_url} alt="Dark Logo" className="max-h-16 max-w-16 object-contain" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'logo_dark')}
                      disabled={uploading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Use a light-colored version for dark backgrounds</p>
                  </div>
                </div>
              </div>

              {/* Favicon */}
              <div className="space-y-3">
                <Label>Favicon</Label>
                <div className="flex items-center gap-4">
                  {localSettings.favicon_url && (
                    <div className="h-12 w-12 border rounded flex items-center justify-center bg-background">
                      <img src={localSettings.favicon_url} alt="Favicon" className="max-h-8 max-w-8 object-contain" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'favicon')}
                      disabled={uploading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">32x32px, ICO or PNG format</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
              <CardDescription>Define your clinic's color palette (HSL format)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ColorPicker
                label="Primary Color"
                value={localSettings.primary_color}
                onChange={(v) => handleColorChange('primary_color', v)}
                description="Main brand color used for buttons, links, and accents"
              />
              <ColorPicker
                label="Secondary Color"
                value={localSettings.secondary_color}
                onChange={(v) => handleColorChange('secondary_color', v)}
                description="Supporting color for secondary actions"
              />
              <ColorPicker
                label="Accent Color"
                value={localSettings.accent_color}
                onChange={(v) => handleColorChange('accent_color', v)}
                description="Highlights and special elements"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="typography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Brand Typography</CardTitle>
              <CardDescription>Set your clinic's name and messaging</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand_name">Clinic/Brand Name</Label>
                <Input
                  id="brand_name"
                  value={localSettings.brand_name || ''}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, brand_name: e.target.value }))}
                  placeholder="Your Clinic Name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={localSettings.tagline || ''}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, tagline: e.target.value }))}
                  placeholder="Your Brand Tagline"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand_voice">Brand Voice</Label>
                <Input
                  id="brand_voice"
                  value={localSettings.brand_voice || ''}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, brand_voice: e.target.value }))}
                  placeholder="e.g., Professional, Friendly, Clinical"
                />
                <p className="text-xs text-muted-foreground">Used for AI-generated content</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Your clinic's contact details and social media</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={localSettings.phone || ''}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={localSettings.email || ''}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contact@clinic.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website_url">Website</Label>
                <Input
                  id="website_url"
                  value={localSettings.website_url || ''}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, website_url: e.target.value }))}
                  placeholder="https://www.yourclinic.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={localSettings.address || ''}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Medical Plaza&#10;Suite 100&#10;City, State 12345"
                  rows={3}
                />
              </div>

              <div className="pt-4 border-t">
                <Label className="text-base mb-3 block">Social Media</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input
                      id="facebook"
                      value={localSettings.social_links?.facebook || ''}
                      onChange={(e) => setLocalSettings(prev => ({ 
                        ...prev, 
                        social_links: { ...prev.social_links, facebook: e.target.value }
                      }))}
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      value={localSettings.social_links?.instagram || ''}
                      onChange={(e) => setLocalSettings(prev => ({ 
                        ...prev, 
                        social_links: { ...prev.social_links, instagram: e.target.value }
                      }))}
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter/X</Label>
                    <Input
                      id="twitter"
                      value={localSettings.social_links?.twitter || ''}
                      onChange={(e) => setLocalSettings(prev => ({ 
                        ...prev, 
                        social_links: { ...prev.social_links, twitter: e.target.value }
                      }))}
                      placeholder="https://twitter.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      value={localSettings.social_links?.linkedin || ''}
                      onChange={(e) => setLocalSettings(prev => ({ 
                        ...prev, 
                        social_links: { ...prev.social_links, linkedin: e.target.value }
                      }))}
                      placeholder="https://linkedin.com/company/..."
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
