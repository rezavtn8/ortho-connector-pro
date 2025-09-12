import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Settings,
  Bot,
  Building2,
  Users,
  Sparkles,
  Check,
  RefreshCw,
  Plus,
  X
} from 'lucide-react';

interface BusinessProfile {
  id: string;
  business_persona: any;
  communication_style: string;
  specialties: string[];
  brand_voice: any;
  practice_values: string[];
  target_audience: string;
  competitive_advantages: string[];
  last_updated: string;
}

export function AIBusinessSetup() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  
  // Form state
  const [communicationStyle, setCommunicationStyle] = useState('professional');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [practiceValues, setPracticeValues] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState('');
  const [competitiveAdvantages, setCompetitiveAdvantages] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newAdvantage, setNewAdvantage] = useState('');

  useEffect(() => {
    loadBusinessProfile();
  }, [user]);

  const loadBusinessProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-business-context', {
        body: { action: 'get' },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data.profile) {
        setProfile(data.profile);
        setCommunicationStyle(data.profile.communication_style);
        setSpecialties(data.profile.specialties || []);
        setPracticeValues(data.profile.practice_values || []);
        setTargetAudience(data.profile.target_audience || '');
        setCompetitiveAdvantages(data.profile.competitive_advantages || []);
      }
    } catch (error: any) {
      console.error('Error loading business profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildBusinessContext = async () => {
    if (!user) return;

    setBuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-business-context', {
        body: { action: 'build' },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      setProfile(data.profile);
      setCommunicationStyle(data.profile.communication_style);
      setSpecialties(data.profile.specialties || []);
      setPracticeValues(data.profile.practice_values || []);
      setTargetAudience(data.profile.target_audience || '');
      setCompetitiveAdvantages(data.profile.competitive_advantages || []);

      toast({
        title: 'Success',
        description: 'Business context built successfully from your practice data.',
      });
    } catch (error: any) {
      console.error('Error building business context:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to build business context',
        variant: 'destructive',
      });
    } finally {
      setBuilding(false);
    }
  };

  const updateBusinessProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const updates = {
        communication_style: communicationStyle,
        specialties,
        practice_values: practiceValues,
        target_audience: targetAudience,
        competitive_advantages: competitiveAdvantages,
        brand_voice: {
          tone: communicationStyle === 'professional-friendly' ? 'professional, warm, approachable' : 'professional, authoritative, trustworthy',
          personality: 'knowledgeable, trustworthy, collaborative',
          values: practiceValues,
          approach: 'relationship-focused, data-informed, respectful'
        }
      };

      const { data, error } = await supabase.functions.invoke('ai-business-context', {
        body: { action: 'update', updates },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      setProfile(data.profile);
      toast({
        title: 'Success',
        description: 'Business profile updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating business profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update business profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addItem = (type: 'specialty' | 'value' | 'advantage') => {
    switch (type) {
      case 'specialty':
        if (newSpecialty && !specialties.includes(newSpecialty)) {
          setSpecialties([...specialties, newSpecialty]);
          setNewSpecialty('');
        }
        break;
      case 'value':
        if (newValue && !practiceValues.includes(newValue)) {
          setPracticeValues([...practiceValues, newValue]);
          setNewValue('');
        }
        break;
      case 'advantage':
        if (newAdvantage && !competitiveAdvantages.includes(newAdvantage)) {
          setCompetitiveAdvantages([...competitiveAdvantages, newAdvantage]);
          setNewAdvantage('');
        }
        break;
    }
  };

  const removeItem = (type: 'specialty' | 'value' | 'advantage', item: string) => {
    switch (type) {
      case 'specialty':
        setSpecialties(specialties.filter(s => s !== item));
        break;
      case 'value':
        setPracticeValues(practiceValues.filter(v => v !== item));
        break;
      case 'advantage':
        setCompetitiveAdvantages(competitiveAdvantages.filter(a => a !== item));
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Business Setup</h2>
          <p className="text-muted-foreground">Configure your AI assistant's understanding of your practice</p>
        </div>
        {!profile && (
          <Button onClick={buildBusinessContext} disabled={building} className="hover-scale transition-all duration-300">
            <Sparkles className={`h-4 w-4 mr-2 ${building ? 'animate-spin' : ''}`} />
            Build AI Context
          </Button>
        )}
      </div>

      {profile?.business_persona && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-800 dark:text-green-200 flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Business Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Practice</p>
                <p className="text-green-700 dark:text-green-300">{profile.business_persona.practice_name}</p>
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Owner</p>
                <p className="text-green-700 dark:text-green-300">{profile.business_persona.owner_name}</p>
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Referral Network</p>
                <p className="text-green-700 dark:text-green-300">{profile.business_persona.referral_network_size} sources</p>
              </div>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Last Updated</p>
                <p className="text-green-700 dark:text-green-300">{new Date(profile.last_updated).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Communication Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Communication Style
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="communication-style">Default Tone</Label>
              <Select value={communicationStyle} onValueChange={setCommunicationStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="professional-friendly">Professional & Friendly</SelectItem>
                  <SelectItem value="professional-authoritative">Professional & Authoritative</SelectItem>
                  <SelectItem value="warm">Warm & Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="target-audience">Target Audience</Label>
              <Input
                id="target-audience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Healthcare professionals, referring practices..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Specialties */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Specialties & Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                placeholder="Add specialty..."
                onKeyPress={(e) => e.key === 'Enter' && addItem('specialty')}
              />
              <Button onClick={() => addItem('specialty')} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {specialties.map((specialty) => (
                <Badge key={specialty} variant="secondary" className="flex items-center gap-1">
                  {specialty}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => removeItem('specialty', specialty)}
                  />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Practice Values */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Practice Values
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Add practice value..."
                onKeyPress={(e) => e.key === 'Enter' && addItem('value')}
              />
              <Button onClick={() => addItem('value')} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {practiceValues.map((value) => (
                <Badge key={value} variant="outline" className="flex items-center gap-1">
                  {value}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => removeItem('value', value)}
                  />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Competitive Advantages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              Competitive Advantages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newAdvantage}
                onChange={(e) => setNewAdvantage(e.target.value)}
                placeholder="Add competitive advantage..."
                onKeyPress={(e) => e.key === 'Enter' && addItem('advantage')}
              />
              <Button onClick={() => addItem('advantage')} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {competitiveAdvantages.map((advantage) => (
                <Badge key={advantage} variant="default" className="flex items-center gap-1">
                  {advantage}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => removeItem('advantage', advantage)}
                  />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={updateBusinessProfile} disabled={loading} className="hover-scale transition-all duration-300">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Save Business Profile
        </Button>
      </div>
    </div>
  );
}