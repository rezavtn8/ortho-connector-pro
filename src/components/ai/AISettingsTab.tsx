import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, X, Save, Sparkles, Users, Award, Target, MessageCircle, Lightbulb, RefreshCw, Building2, UserCircle } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function AISettingsTab() {
  const { user } = useAuth();
  const { settings, loading, updateSettings, refetch } = useAISettings();
  const [tone, setTone] = useState(settings?.communication_style || 'professional');
  const [highlights, setHighlights] = useState<string[]>(settings?.competitive_advantages || []);
  const [values, setValues] = useState<string[]>(settings?.practice_values || []);
  const [specialties, setSpecialties] = useState<string[]>(settings?.specialties || []);
  const [targetAudience, setTargetAudience] = useState(settings?.target_audience || '');
  const [brandVoice, setBrandVoice] = useState<string[]>(
    settings?.brand_voice?.traits || ['Professional', 'Trustworthy', 'Caring']
  );
  
  const [newHighlight, setNewHighlight] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newVoiceTrait, setNewVoiceTrait] = useState('');
  const [saving, setSaving] = useState(false);

  // Business info state
  const [businessInfo, setBusinessInfo] = useState<{
    practiceName: string;
    ownerName: string;
    degrees: string;
    jobTitle: string;
  } | null>(null);

  // Fetch business information
  useEffect(() => {
    const fetchBusinessInfo = async () => {
      if (!user?.id) return;
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select(`
          first_name,
          last_name,
          full_name,
          degrees,
          job_title,
          clinics!inner(name)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile) {
        const clinicData = profile.clinics as any;
        setBusinessInfo({
          practiceName: clinicData?.name || 'Not set',
          ownerName: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Not set',
          degrees: profile.degrees || 'Not set',
          jobTitle: profile.job_title || 'Not set',
        });
      }
    };

    fetchBusinessInfo();
  }, [user]);

  // Update local state when settings load
  useEffect(() => {
    if (settings) {
      setTone(settings.communication_style || 'professional');
      setHighlights(settings.competitive_advantages || []);
      setValues(settings.practice_values || []);
      setSpecialties(settings.specialties || []);
      setTargetAudience(settings.target_audience || '');
      setBrandVoice(settings.brand_voice?.traits || ['Professional', 'Trustworthy', 'Caring']);
    }
  }, [settings]);

  const toneOptions = [
    { value: 'professional', label: '🎯 Professional', description: 'Formal and business-focused' },
    { value: 'warm', label: '☀️ Warm', description: 'Friendly and approachable' },
    { value: 'confident', label: '💪 Confident', description: 'Assertive and expert' },
    { value: 'compassionate', label: '❤️ Compassionate', description: 'Empathetic and caring' },
    { value: 'innovative', label: '🚀 Innovative', description: 'Forward-thinking and modern' },
  ];

  const presetHighlights = [
    '15+ years of experience',
    'Same-day emergency care',
    'Board-certified specialists',
    'State-of-the-art technology',
    'Family-friendly environment',
    'Extended evening hours',
    'Multi-lingual staff',
    'Insurance accepted',
  ];

  const presetValues = [
    'Patient-centered care',
    'Continuous education',
    'Community involvement',
    'Ethical practice',
    'Innovation & excellence',
    'Compassionate service',
  ];

  const presetSpecialties = [
    'Orthodontics',
    'Cosmetic Dentistry',
    'Implantology',
    'Pediatric Care',
    'Emergency Services',
    'Preventive Care',
  ];

  const presetVoiceTraits = [
    'Professional',
    'Trustworthy',
    'Caring',
    'Innovative',
    'Expert',
    'Approachable',
    'Detail-oriented',
    'Patient-focused',
  ];

  const addItem = (
    newItem: string,
    setNewItem: (val: string) => void,
    items: string[],
    setItems: (items: string[]) => void,
    maxItems = 10
  ) => {
    const trimmed = newItem.trim();
    if (trimmed && !items.includes(trimmed)) {
      if (items.length >= maxItems) {
        toast({
          title: 'Limit Reached',
          description: `Maximum ${maxItems} items allowed`,
          variant: 'destructive',
        });
        return;
      }
      setItems([...items, trimmed]);
      setNewItem('');
    }
  };

  const removeItem = (index: number, items: string[], setItems: (items: string[]) => void) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addPreset = (preset: string, items: string[], setItems: (items: string[]) => void, maxItems = 10) => {
    if (!items.includes(preset) && items.length < maxItems) {
      setItems([...items, preset]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        communication_style: tone,
        competitive_advantages: highlights,
        practice_values: values,
        specialties: specialties,
        target_audience: targetAudience,
        brand_voice: { traits: brandVoice },
      });
      toast({
        title: '✅ Settings Saved',
        description: 'Your AI assistant has been configured successfully.',
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: '❌ Save Failed',
        description: 'Unable to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset to default settings? This will clear all your customizations.')) {
      setTone('professional');
      setHighlights([]);
      setValues([]);
      setSpecialties([]);
      setTargetAudience('');
      setBrandVoice(['Professional', 'Trustworthy', 'Caring']);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              AI Assistant Configuration
            </h2>
            <p className="text-muted-foreground mt-1">
              Personalize how your AI understands and represents your practice
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Business Information Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Business Information</CardTitle>
            </div>
            <CardDescription>
              Your practice details used by AI for personalized responses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Practice Name
                </Label>
                <p className="text-lg font-semibold">
                  {businessInfo?.practiceName || 'Loading...'}
                </p>
                {businessInfo?.practiceName === 'Not set' && (
                  <p className="text-xs text-muted-foreground">
                    Set this in Settings → Clinic Information
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Owner / Doctor
                </Label>
                <div>
                  <p className="text-lg font-semibold">
                    {businessInfo?.ownerName || 'Loading...'}
                  </p>
                  {businessInfo?.degrees && businessInfo.degrees !== 'Not set' && (
                    <p className="text-sm text-muted-foreground">
                      {businessInfo.degrees}
                    </p>
                  )}
                  {businessInfo?.jobTitle && businessInfo.jobTitle !== 'Not set' && (
                    <p className="text-sm text-muted-foreground">
                      {businessInfo.jobTitle}
                    </p>
                  )}
                </div>
                {businessInfo?.ownerName === 'Not set' && (
                  <p className="text-xs text-muted-foreground">
                    Set this in Settings → Profile Settings
                  </p>
                )}
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 mt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                AI will use "{businessInfo?.practiceName}" and "{businessInfo?.ownerName}" in all generated content
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Communication Tone */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <CardTitle>Communication Tone</CardTitle>
            </div>
            <CardDescription>
              Define the voice and personality of AI-generated content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Primary Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select communication tone" />
                </SelectTrigger>
                <SelectContent>
                  {toneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand Voice Traits */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Brand Voice Traits (max 6)
              </Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newVoiceTrait}
                  onChange={(e) => setNewVoiceTrait(e.target.value)}
                  placeholder="Add custom trait..."
                  onKeyPress={(e) =>
                    e.key === 'Enter' &&
                    addItem(newVoiceTrait, setNewVoiceTrait, brandVoice, setBrandVoice, 6)
                  }
                  maxLength={30}
                />
                <Button
                  onClick={() => addItem(newVoiceTrait, setNewVoiceTrait, brandVoice, setBrandVoice, 6)}
                  disabled={!newVoiceTrait.trim() || brandVoice.length >= 6}
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                {presetVoiceTraits
                  .filter((p) => !brandVoice.includes(p))
                  .slice(0, 4)
                  .map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => addPreset(preset, brandVoice, setBrandVoice, 6)}
                      disabled={brandVoice.length >= 6}
                      className="text-xs"
                    >
                      + {preset}
                    </Button>
                  ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {brandVoice.map((trait, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1">
                    {trait}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 ml-2 hover:bg-transparent"
                      onClick={() => removeItem(index, brandVoice, setBrandVoice)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Competitive Advantages */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <CardTitle>Competitive Advantages</CardTitle>
            </div>
            <CardDescription>
              Key differentiators that set your practice apart (max 8)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newHighlight}
                onChange={(e) => setNewHighlight(e.target.value)}
                placeholder="e.g., Same-day emergency care"
                onKeyPress={(e) =>
                  e.key === 'Enter' &&
                  addItem(newHighlight, setNewHighlight, highlights, setHighlights, 8)
                }
                maxLength={100}
              />
              <Button
                onClick={() => addItem(newHighlight, setNewHighlight, highlights, setHighlights, 8)}
                disabled={!newHighlight.trim() || highlights.length >= 8}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Preset Suggestions */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick Add:</Label>
              <div className="flex flex-wrap gap-2">
                {presetHighlights
                  .filter((p) => !highlights.includes(p))
                  .slice(0, 4)
                  .map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => addPreset(preset, highlights, setHighlights, 8)}
                      disabled={highlights.length >= 8}
                      className="text-xs"
                    >
                      + {preset}
                    </Button>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {highlights.map((highlight, index) => (
                <Badge key={index} variant="default" className="px-3 py-1">
                  {highlight}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-2 hover:bg-transparent"
                    onClick={() => removeItem(index, highlights, setHighlights)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>

            {highlights.length === 0 && (
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No advantages added yet</p>
                <p className="text-xs">Add what makes your practice unique</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Practice Specialties */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>Practice Specialties</CardTitle>
            </div>
            <CardDescription>
              Areas of expertise and specialized services (max 8)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                placeholder="e.g., Orthodontics"
                onKeyPress={(e) =>
                  e.key === 'Enter' &&
                  addItem(newSpecialty, setNewSpecialty, specialties, setSpecialties, 8)
                }
                maxLength={50}
              />
              <Button
                onClick={() => addItem(newSpecialty, setNewSpecialty, specialties, setSpecialties, 8)}
                disabled={!newSpecialty.trim() || specialties.length >= 8}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick Add:</Label>
              <div className="flex flex-wrap gap-2">
                {presetSpecialties
                  .filter((p) => !specialties.includes(p))
                  .slice(0, 4)
                  .map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => addPreset(preset, specialties, setSpecialties, 8)}
                      disabled={specialties.length >= 8}
                      className="text-xs"
                    >
                      + {preset}
                    </Button>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {specialties.map((specialty, index) => (
                <Badge key={index} variant="secondary" className="px-3 py-1">
                  {specialty}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-2 hover:bg-transparent"
                    onClick={() => removeItem(index, specialties, setSpecialties)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Practice Values */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Core Values</CardTitle>
            </div>
            <CardDescription>
              Fundamental principles that guide your practice (max 6)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="e.g., Patient-centered care"
                onKeyPress={(e) =>
                  e.key === 'Enter' && addItem(newValue, setNewValue, values, setValues, 6)
                }
                maxLength={50}
              />
              <Button
                onClick={() => addItem(newValue, setNewValue, values, setValues, 6)}
                disabled={!newValue.trim() || values.length >= 6}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick Add:</Label>
              <div className="flex flex-wrap gap-2">
                {presetValues
                  .filter((p) => !values.includes(p))
                  .slice(0, 4)
                  .map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => addPreset(preset, values, setValues, 6)}
                      disabled={values.length >= 6}
                      className="text-xs"
                    >
                      + {preset}
                    </Button>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {values.map((value, index) => (
                <Badge key={index} variant="outline" className="px-3 py-1">
                  {value}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-2 hover:bg-transparent"
                    onClick={() => removeItem(index, values, setValues)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Target Audience */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle>Target Audience</CardTitle>
            </div>
            <CardDescription>
              Describe your ideal patients (optional, max 500 characters)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value.slice(0, 500))}
              placeholder="e.g., Families with young children seeking preventive care and orthodontic services in a welcoming environment..."
              rows={4}
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Helps AI tailor communication and recommendations</span>
              <span>{targetAudience.length}/500</span>
            </div>
          </CardContent>
        </Card>

        {/* Save Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button onClick={handleSave} disabled={saving || loading} size="lg" className="min-w-[150px]">
            {saving ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </div>

        {/* Guidelines */}
        <Card variant="outline" className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">💡 Best Practices</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Be specific and factual with highlights and specialties</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Use 3-6 brand voice traits for best results</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Settings apply to analysis, chat, email generation, and review responses</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Update regularly as your practice evolves</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Target audience helps AI understand context and provide relevant insights</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
