import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, X, Save } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { toast } from '@/hooks/use-toast';

export function AISettingsTab() {
  const { settings, loading, updateSettings } = useAISettings();
  const [tone, setTone] = useState(settings?.communication_style || 'professional');
  const [highlights, setHighlights] = useState<string[]>(settings?.competitive_advantages || []);
  const [newHighlight, setNewHighlight] = useState('');
  const [saving, setSaving] = useState(false);

  const toneOptions = [
    { value: 'professional', label: 'Professional', description: 'Formal and business-focused' },
    { value: 'warm', label: 'Warm', description: 'Friendly and approachable' },
    { value: 'confident', label: 'Confident', description: 'Assertive and expert' },
    { value: 'compassionate', label: 'Compassionate', description: 'Empathetic and caring' },
  ];

  const addHighlight = () => {
    if (newHighlight.trim() && !highlights.includes(newHighlight.trim())) {
      setHighlights([...highlights, newHighlight.trim()]);
      setNewHighlight('');
    }
  };

  const removeHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        communication_style: tone,
        competitive_advantages: highlights,
      });
      toast({
        title: "Settings Saved",
        description: "Your AI assistant preferences have been updated.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Unable to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">AI Assistant Settings</h2>
        <p className="text-muted-foreground">
          Customize how your AI assistant communicates and what it highlights about your practice
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Communication Tone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Choose how your AI assistant should communicate</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger>
                <SelectValue placeholder="Select communication tone" />
              </SelectTrigger>
              <SelectContent>
                {toneOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This tone will be used in analysis, email generation, and review responses.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinic Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Add key highlights about your practice</Label>
            <p className="text-sm text-muted-foreground">
              These will be emphasized in AI-generated content and analysis
            </p>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  placeholder="e.g., 15+ years of experience, Same-day emergency care"
                  onKeyPress={(e) => e.key === 'Enter' && addHighlight()}
                />
                <Button onClick={addHighlight} disabled={!newHighlight.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {highlights.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {highlights.map((highlight, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {highlight}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-1"
                        onClick={() => removeHighlight(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
              
              {highlights.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="mb-2">No highlights added yet</p>
                  <p className="text-sm">
                    Add highlights like "Board-certified specialists" or "State-of-the-art equipment"
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-pulse" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Analysis results are cached for performance - use refresh to get latest data</li>
            <li>• Chat conversations are logged for quality improvement</li>
            <li>• Settings apply to all AI-generated content including emails and reviews</li>
            <li>• Keep highlights concise and factual for best results</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}