import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { EnhancedDatePicker } from '@/components/EnhancedDatePicker';
import {
  Sparkles,
  Mail, 
  Gift, 
  Users, 
  Calendar,
  Send,
  Wand2,
  Copy,
  Crown,
  DollarSign,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeText } from '@/lib/sanitize';

interface GiftBundle {
  id: string;
  name: string;
  description: string;
  items: string[];
  cost: number;
  is_premium: boolean;
}

const GIFT_BUNDLES: GiftBundle[] = [
  {
    id: 'basic',
    name: 'Basic Appreciation',
    description: 'Simple thank you package',
    items: ['Thank you card', 'Branded pen'],
    cost: 15,
    is_premium: false
  },
  {
    id: 'premium',
    name: 'Premium Package',
    description: 'Comprehensive appreciation package',
    items: ['Thank you card', 'Branded items', 'Gift card'],
    cost: 50,
    is_premium: true
  }
];

const CAMPAIGN_TYPES = [
  { value: 'appreciation', label: 'Appreciation Campaign', description: 'Thank referral partners' },
  { value: 'seasonal', label: 'Seasonal Campaign', description: 'Holiday or seasonal outreach' },
  { value: 'important_date', label: 'Important Date', description: 'Special occasion marketing' },
  { value: 'promotional', label: 'Promotional', description: 'New service or promotion' },
  { value: 'reactivation', label: 'Reactivation', description: 'Re-engage dormant sources' }
];

const OFFICE_TIER_FILTERS = [
  { label: 'All Tiers', value: 'all' },
  { label: 'VIP', value: 'VIP' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Cold', value: 'Cold' },
  { label: 'Dormant', value: 'Dormant' }
];

interface Office {
  id: string;
  name: string;
  address?: string;
  source_type: string;
  referral_tier?: string;
  l12?: number;
  r3?: number;
}

interface AIContent {
  emailSubject: string;
  emailBody: string;
  socialCaption?: string;
  printMessage?: string;
}

interface UnifiedCampaignCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

export function UnifiedCampaignCreator({ open, onOpenChange, onCampaignCreated }: UnifiedCampaignCreatorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<'type' | 'details' | 'offices' | 'review'>('type');
  const [campaignType, setCampaignType] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    planned_delivery_date: null as Date | null,
    notes: '',
    customPrompt: ''
  });
  
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedGiftBundle, setSelectedGiftBundle] = useState<GiftBundle | null>(null);
  const [tierFilter, setTierFilter] = useState('all');
  const [aiContent, setAiContent] = useState<AIContent | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(true);
  const [generatingContent, setGeneratingContent] = useState(false);

  // Fetch offices with referral tiers
  useEffect(() => {
    const fetchOffices = async () => {
      if (!user) return;

      try {
        setLoadingOffices(true);
        
        const { data: sourcesData, error: sourcesError } = await supabase
          .from('patient_sources')
          .select('id, name, address, source_type')
          .eq('created_by', user.id)
          .eq('is_active', true)
          .eq('source_type', 'Office')
          .order('name');

        if (sourcesError) throw sourcesError;

        const { data: monthlyData, error: monthlyError } = await supabase
          .from('monthly_patients')
          .select('*')
          .eq('user_id', user.id);

        if (monthlyError) throw monthlyError;

        // Calculate metrics and tiers
        const processedOffices = [];
        const currentDate = new Date();
        
        for (const source of sourcesData || []) {
          const sourceMonthlyData = monthlyData?.filter(m => m.source_id === source.id) || [];
          
          const l12 = sourceMonthlyData
            .filter(m => {
              const [year, month] = m.year_month.split('-').map(Number);
              const dataDate = new Date(year, month - 1);
              const twelveMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 12);
              return dataDate >= twelveMonthsAgo;
            })
            .reduce((sum, m) => sum + m.patient_count, 0);

          const r3 = sourceMonthlyData
            .filter(m => {
              const [year, month] = m.year_month.split('-').map(Number);
              const dataDate = new Date(year, month - 1);
              const threeMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 3);
              return dataDate >= threeMonthsAgo;
            })
            .reduce((sum, m) => sum + m.patient_count, 0);

          processedOffices.push({
            ...source,
            l12,
            r3
          });
        }

        const calculateTier = (l12: number, r3: number, allOffices: any[]) => {
          if (l12 === 0) return 'Dormant';
          const sortedByL12 = allOffices.map(o => o.l12).sort((a, b) => b - a);
          const vipThresholdIndex = Math.ceil(sortedByL12.length * 0.2) - 1;
          const vipThreshold = sortedByL12[vipThresholdIndex] || 0;
          if (l12 >= vipThreshold && vipThreshold > 0) return 'VIP';
          if (l12 >= 4 || r3 >= 1) return 'Warm';
          return 'Cold';
        };

        const officesWithTiers = processedOffices.map(office => ({
          ...office,
          referral_tier: calculateTier(office.l12 || 0, office.r3 || 0, processedOffices)
        }));

        setOffices(officesWithTiers);
      } catch (error) {
        console.error('Error fetching offices:', error);
        toast({
          title: "Error",
          description: "Failed to load offices.",
          variant: "destructive",
        });
      } finally {
        setLoadingOffices(false);
      }
    };

    if (open) {
      fetchOffices();
    }
  }, [open, user]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep('type');
      setCampaignType('');
      setFormData({
        name: '',
        planned_delivery_date: null,
        notes: '',
        customPrompt: ''
      });
      setSelectedOffices([]);
      setSelectedGiftBundle(null);
      setTierFilter('all');
      setAiContent(null);
    }
  }, [open]);

  const generateAIContent = async () => {
    if (!campaignType) return;

    try {
      setGeneratingContent(true);

      const selectedOfficesData = offices.filter(o => selectedOffices.includes(o.id));
      const campaignTypeLabel = CAMPAIGN_TYPES.find(t => t.value === campaignType)?.label || campaignType;
      
      const prompt = `Generate professional dental marketing content for a ${campaignTypeLabel}.

Campaign Details:
- Type: ${campaignTypeLabel}
- Target: ${selectedOffices.length} dental offices (${selectedOfficesData.map(o => o.referral_tier).join(', ')})
- ${formData.customPrompt ? `Custom Instructions: ${formData.customPrompt}` : ''}

Generate:
1. Email subject line (compelling, 50 characters max)
2. Professional email body (3 paragraphs, warm and professional tone, mention the value of referral partnership)
3. Social media caption (optional, 280 characters max with hashtags)
4. Print message for cards (optional, 25 words max)

Make it relevant to dental professionals and referral relationships. Keep it professional, warm, and appropriate for healthcare marketing.`;

      const { data, error } = await supabase.functions.invoke('ai-chat-assistant', {
        body: { 
          message: prompt
        }
      });

      if (error) throw error;

      const response = data.response || '';
      const lines = response.split('\n').filter(line => line.trim());
      
      let emailSubject = '';
      let emailBody = '';
      let socialCaption = '';
      let printMessage = '';
      
      let currentSection = '';
      
      for (const line of lines) {
        if (line.toLowerCase().includes('subject')) {
          currentSection = 'subject';
          emailSubject = line.replace(/^[^:]*:/, '').trim().replace(/^["']|["']$/g, '');
        } else if (line.toLowerCase().includes('email') && line.toLowerCase().includes('body')) {
          currentSection = 'email';
        } else if (line.toLowerCase().includes('social')) {
          currentSection = 'social';
        } else if (line.toLowerCase().includes('print') || line.toLowerCase().includes('card')) {
          currentSection = 'print';
        } else if (currentSection && line.trim()) {
          switch (currentSection) {
            case 'email':
              emailBody += (emailBody ? '\n\n' : '') + line.trim();
              break;
            case 'social':
              if (!socialCaption) socialCaption = line.trim();
              break;
            case 'print':
              if (!printMessage) printMessage = line.trim();
              break;
          }
        }
      }

      if (!emailSubject || !emailBody) {
        emailSubject = `${campaignTypeLabel} - Thank You for Your Partnership`;
        emailBody = `Dear Colleague,\n\nWe wanted to take a moment to express our gratitude for your continued trust in referring patients to our practice.\n\nYour partnership is invaluable to us, and we're committed to providing exceptional care to every patient you send our way.\n\nThank you for your ongoing support and collaboration.\n\nBest regards,\nYour Dental Team`;
      }

      setAiContent({
        emailSubject,
        emailBody,
        socialCaption,
        printMessage
      });

      toast({
        title: "AI Content Generated",
        description: "Your campaign content is ready for review.",
      });

    } catch (error) {
      console.error('Error generating AI content:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 'type' && !campaignType) {
      toast({
        title: "Select Campaign Type",
        description: "Please select a campaign type to continue.",
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep === 'type') setCurrentStep('details');
    else if (currentStep === 'details') setCurrentStep('offices');
    else if (currentStep === 'offices' && selectedOffices.length > 0) {
      if (!aiContent) {
        generateAIContent();
      }
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    if (currentStep === 'details') setCurrentStep('type');
    else if (currentStep === 'offices') setCurrentStep('details');
    else if (currentStep === 'review') setCurrentStep('offices');
  };

  const filteredOffices = offices.filter(office => 
    tierFilter === 'all' || office.referral_tier === tierFilter
  );

  const handleOfficeSelection = (officeId: string, checked: boolean) => {
    if (checked) {
      setSelectedOffices(prev => [...prev, officeId]);
    } else {
      setSelectedOffices(prev => prev.filter(id => id !== officeId));
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard.`,
    });
  };

  const handleSubmit = async () => {
    if (!user) return;

    const sanitizedName = sanitizeText(formData.name);
    const sanitizedNotes = sanitizeText(formData.notes);

    if (!sanitizedName || selectedOffices.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a campaign name and select at least one office.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: sanitizedName,
          campaign_type: CAMPAIGN_TYPES.find(t => t.value === campaignType)?.label || campaignType,
          campaign_mode: 'unified',
          delivery_method: selectedGiftBundle ? 'USPS' : 'Email',
          selected_gift_bundle: selectedGiftBundle ? {
            id: selectedGiftBundle.id,
            name: selectedGiftBundle.name,
            description: selectedGiftBundle.description,
            items: selectedGiftBundle.items,
            cost: selectedGiftBundle.cost,
            is_premium: selectedGiftBundle.is_premium
          } : null,
          email_settings: {
            generate_emails: false,
            user_sends_manually: true,
            ai_generated: true
          },
          planned_delivery_date: formData.planned_delivery_date?.toISOString().split('T')[0] || null,
          notes: sanitizedNotes,
          created_by: user.id,
          status: 'Draft'
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const selectedOfficeData = offices.filter(office => selectedOffices.includes(office.id));
      const deliveries = selectedOfficeData.map(office => ({
        campaign_id: campaign.id,
        office_id: office.id,
        created_by: user.id,
        referral_tier: office.referral_tier,
        action_mode: selectedGiftBundle ? 'both' : 'email',
        email_status: 'pending',
        gift_status: selectedGiftBundle ? 'pending' : 'not_applicable',
        email_subject: aiContent?.emailSubject || '',
        email_body: aiContent?.emailBody || ''
      }));

      const { error: deliveriesError } = await supabase
        .from('campaign_deliveries')
        .insert(deliveries);

      if (deliveriesError) throw deliveriesError;

      onCampaignCreated();
      onOpenChange(false);
      
      toast({
        title: "Campaign Created",
        description: `Successfully created campaign with ${selectedOffices.length} offices and AI-generated content.`,
      });

    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to create campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Create AI Campaign
          </DialogTitle>
          <DialogDescription>
            Create a professional campaign with AI-generated content in 4 simple steps
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6 px-4">
          {[
            { key: 'type', label: 'Type', icon: Sparkles },
            { key: 'details', label: 'Details', icon: Calendar },
            { key: 'offices', label: 'Offices', icon: Users },
            { key: 'review', label: 'Review', icon: Send }
          ].map((step, index) => (
            <div key={step.key} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${currentStep === step.key ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep === step.key ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <step.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
              </div>
              {index < 3 && <div className={`flex-1 h-0.5 mx-2 ${
                ['details', 'offices', 'review'].indexOf(currentStep) > index ? 'bg-primary' : 'bg-muted'
              }`} />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 'type' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4">Select Campaign Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CAMPAIGN_TYPES.map((type) => (
                  <Card
                    key={type.value}
                    className={`cursor-pointer transition-all ${
                      campaignType === type.value ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                    }`}
                    onClick={() => setCampaignType(type.value)}
                  >
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        {type.label}
                        {campaignType === type.value && (
                          <Badge className="bg-primary">Selected</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Campaign Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Q1 Appreciation Campaign"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Planned Date</Label>
                    <EnhancedDatePicker
                      value={formData.planned_delivery_date}
                      onChange={(date) => setFormData(prev => ({ ...prev, planned_delivery_date: date }))}
                      placeholder="Select date"
                      minDate={new Date()}
                      withTime={false}
                      presets={true}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Campaign objectives..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customPrompt">AI Instructions (Optional)</Label>
                    <Textarea
                      id="customPrompt"
                      value={formData.customPrompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, customPrompt: e.target.value }))}
                      placeholder="e.g., Focus on our new implant services, keep tone casual..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide specific instructions for AI content generation
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      Gift Bundle (Optional)
                    </Label>
                    <div className="space-y-2">
                      <div 
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${
                          !selectedGiftBundle ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedGiftBundle(null)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-sm">Email Only</h4>
                            <p className="text-xs text-muted-foreground">No physical gifts</p>
                          </div>
                          <span className="text-sm font-medium">$0</span>
                        </div>
                      </div>

                      {GIFT_BUNDLES.map((bundle) => (
                        <div
                          key={bundle.id}
                          className={`border rounded-lg p-3 cursor-pointer transition-all ${
                            selectedGiftBundle?.id === bundle.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedGiftBundle(bundle)}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm">{bundle.name}</h4>
                              {bundle.is_premium && (
                                <Crown className="w-3 h-3 text-amber-500" />
                              )}
                            </div>
                            <span className="font-medium text-sm">${bundle.cost}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{bundle.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'offices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <Label>Select Target Offices ({selectedOffices.length} selected)</Label>
                </div>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICE_TIER_FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {loadingOffices ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">Loading offices...</p>
                </div>
              ) : (
                <div className="border rounded-md max-h-[400px] overflow-y-auto">
                  {filteredOffices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No offices found for the selected filter.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 p-4">
                      {filteredOffices.map((office) => (
                        <div key={office.id} className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded-lg">
                          <Checkbox
                            id={office.id}
                            checked={selectedOffices.includes(office.id)}
                            onCheckedChange={(checked) => handleOfficeSelection(office.id, checked as boolean)}
                          />
                          <div className="flex-1 min-w-0">
                            <Label htmlFor={office.id} className="cursor-pointer">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{office.name}</span>
                                {office.referral_tier && (
                                  <Badge variant={
                                    office.referral_tier === 'VIP' ? 'default' :
                                    office.referral_tier === 'Warm' ? 'secondary' : 'outline'
                                  }>
                                    {office.referral_tier}
                                  </Badge>
                                )}
                              </div>
                              {office.address && (
                                <div className="text-sm text-muted-foreground">{office.address}</div>
                              )}
                              {(office.l12 !== undefined || office.r3 !== undefined) && (
                                <div className="text-xs text-muted-foreground">
                                  L12: {office.l12} | R3: {office.r3}
                                </div>
                              )}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-6">
              {generatingContent ? (
                <div className="text-center py-12">
                  <Wand2 className="w-12 h-12 animate-pulse mx-auto mb-4 text-primary" />
                  <h3 className="font-semibold text-lg mb-2">Generating AI Content...</h3>
                  <p className="text-muted-foreground">
                    Creating personalized content for your campaign
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Review & Edit Content</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateAIContent}
                      disabled={generatingContent}
                      className="gap-2"
                    >
                      <Wand2 className="w-4 h-4" />
                      Regenerate
                    </Button>
                  </div>

                  <Tabs defaultValue="email" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="email" className="gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </TabsTrigger>
                      <TabsTrigger value="summary" className="gap-2">
                        <Users className="w-4 h-4" />
                        Summary
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="email" className="space-y-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">Email Subject</CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(aiContent?.emailSubject || '', 'Subject')}
                              className="h-8 gap-2"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Input
                            value={aiContent?.emailSubject || ''}
                            onChange={(e) => setAiContent(prev => prev ? { ...prev, emailSubject: e.target.value } : null)}
                            className="font-medium"
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">Email Body</CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(aiContent?.emailBody || '', 'Email body')}
                              className="h-8 gap-2"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Textarea
                            value={aiContent?.emailBody || ''}
                            onChange={(e) => setAiContent(prev => prev ? { ...prev, emailBody: e.target.value } : null)}
                            rows={12}
                            className="font-mono text-sm"
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="summary" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Campaign Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm text-muted-foreground">Campaign Type</Label>
                              <p className="font-medium">{CAMPAIGN_TYPES.find(t => t.value === campaignType)?.label}</p>
                            </div>
                            <div>
                              <Label className="text-sm text-muted-foreground">Target Offices</Label>
                              <p className="font-medium">{selectedOffices.length} offices</p>
                            </div>
                            <div>
                              <Label className="text-sm text-muted-foreground">Delivery Method</Label>
                              <p className="font-medium">{selectedGiftBundle ? 'Email + Gift' : 'Email Only'}</p>
                            </div>
                            {selectedGiftBundle && (
                              <div>
                                <Label className="text-sm text-muted-foreground">Total Cost</Label>
                                <p className="font-medium">${selectedGiftBundle.cost * selectedOffices.length}</p>
                              </div>
                            )}
                          </div>
                          
                          {formData.notes && (
                            <div>
                              <Label className="text-sm text-muted-foreground">Notes</Label>
                              <p className="text-sm">{formData.notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div>
            {currentStep !== 'type' && (
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            {currentStep !== 'review' ? (
              <Button onClick={handleNext} disabled={loading || (currentStep === 'offices' && selectedOffices.length === 0)}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading || generatingContent} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Create Campaign
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
