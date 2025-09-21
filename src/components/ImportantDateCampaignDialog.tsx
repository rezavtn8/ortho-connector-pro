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
  Wand2, 
  Mail, 
  MessageSquare, 
  FileText, 
  Users, 
  Calendar, 
  Sparkles,
  Gift,
  RefreshCw,
  Copy,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeText } from '@/lib/sanitize';
import { format } from 'date-fns';

interface ImportantDate {
  id: string;
  title: string;
  date: Date;
  type: 'seasonal' | 'dental' | 'business';
  category: string;
  description: string;
  campaignSuggestions: string[];
}

interface Office {
  id: string;
  name: string;
  address?: string;
  source_type: string;
  referral_tier?: string;
}

interface AIContent {
  emailSubject: string;
  emailBody: string;
  socialCaption: string;
  printMessage: string;
}

interface ImportantDateCampaignDialogProps {
  importantDate: ImportantDate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

const OFFICE_TIER_FILTERS = [
  { label: 'All Tiers', value: 'all' },
  { label: 'VIP', value: 'VIP' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Cold', value: 'Cold' },
  { label: 'Dormant', value: 'Dormant' }
];

export function ImportantDateCampaignDialog({ 
  importantDate, 
  open, 
  onOpenChange, 
  onCampaignCreated 
}: ImportantDateCampaignDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    planned_delivery_date: null as Date | null,
    notes: ''
  });
  
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState('all');
  const [selectedSuggestion, setSelectedSuggestion] = useState('');
  const [aiContent, setAiContent] = useState<AIContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(true);
  const [generatingContent, setGeneratingContent] = useState(false);

  // Fetch offices with referral tiers (same logic as UnifiedCampaignDialog)
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

        // Calculate tiers (simplified version - same logic as UnifiedCampaignDialog)
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
          referral_tier: calculateTier(office.l12, office.r3, processedOffices)
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

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open || !importantDate) {
      setFormData({
        name: '',
        planned_delivery_date: null,
        notes: ''
      });
      setSelectedOffices([]);
      setSelectedSuggestion('');
      setAiContent(null);
      setTierFilter('all');
    } else if (importantDate) {
      setFormData(prev => ({
        ...prev,
        name: `${importantDate.title} Campaign`,
        planned_delivery_date: importantDate.date,
        notes: importantDate.description
      }));
      setSelectedSuggestion(importantDate.campaignSuggestions[0] || '');
    }
  }, [open, importantDate]);

  const generateAIContent = async () => {
    if (!importantDate || !selectedSuggestion) return;

    try {
      setGeneratingContent(true);

      const prompt = `Generate professional dental marketing content for ${importantDate.title} (${format(importantDate.date, 'MMMM dd')}) with the campaign theme "${selectedSuggestion}".

Context:
- Event: ${importantDate.title}
- Category: ${importantDate.category}
- Description: ${importantDate.description}
- Campaign Theme: ${selectedSuggestion}

Generate:
1. Email subject line (50 characters max)
2. Professional email body (2-3 paragraphs, warm and professional tone)
3. Social media caption (280 characters max, include relevant hashtags)
4. Short print message for cards/flyers (25 words max)

Make it relevant to dental professionals and referral relationships. Keep it professional, warm, and appropriate for healthcare marketing.`;

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          message: prompt,
          context_type: 'campaign_generation'
        }
      });

      if (error) throw error;

      // Parse the AI response to extract structured content
      const response = data.response || '';
      
      // Simple parsing - in production, you might want more robust parsing
      const lines = response.split('\n').filter(line => line.trim());
      
      let emailSubject = '';
      let emailBody = '';
      let socialCaption = '';
      let printMessage = '';
      
      let currentSection = '';
      
      for (const line of lines) {
        if (line.toLowerCase().includes('subject')) {
          currentSection = 'subject';
          emailSubject = line.replace(/^[^:]*:/, '').trim();
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
              socialCaption = line.trim();
              break;
            case 'print':
              printMessage = line.trim();
              break;
          }
        }
      }

      // Fallback content if parsing fails
      if (!emailSubject || !emailBody) {
        emailSubject = `${importantDate.title} - ${selectedSuggestion}`;
        emailBody = `Dear Colleague,

As we approach ${importantDate.title} on ${format(importantDate.date, 'MMMM dd')}, I wanted to reach out and share how much we value our professional relationship.

${importantDate.description}

We're here to support you and your patients with exceptional dental care. Thank you for your continued trust in our practice.

Best regards,
Your Dental Team`;
        socialCaption = `Celebrating ${importantDate.title}! 🦷 ${selectedSuggestion} #${importantDate.title.replace(/\s+/g, '')} #DentalHealth`;
        printMessage = `${importantDate.title} - Thank you for your partnership!`;
      }

      setAiContent({
        emailSubject,
        emailBody,
        socialCaption,
        printMessage
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
    if (!user || !importantDate) return;

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

      // Create campaign with AI content
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: sanitizedName,
          campaign_type: 'Important Date Campaign',
          campaign_mode: 'unified',
          delivery_method: 'USPS',
          email_settings: {
            generate_emails: false, // Already generated
            user_sends_manually: true,
            ai_generated: true,
            important_date_id: importantDate.id,
            campaign_theme: selectedSuggestion
          },
          planned_delivery_date: formData.planned_delivery_date?.toISOString().split('T')[0] || null,
          notes: sanitizedNotes,
          created_by: user.id,
          status: 'Draft'
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create campaign deliveries with pre-generated content
      const selectedOfficeData = offices.filter(office => selectedOffices.includes(office.id));
      const deliveries = selectedOfficeData.map(office => ({
        campaign_id: campaign.id,
        office_id: office.id,
        created_by: user.id,
        referral_tier: office.referral_tier,
        action_mode: 'email',
        email_status: 'pending',
        gift_status: 'not_applicable',
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
        title: "Success",
        description: `${importantDate.title} campaign created with ${selectedOffices.length} offices!`,
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

  if (!importantDate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {importantDate.title} Campaign
              </DialogTitle>
              <DialogDescription className="text-sm">
                Create a targeted campaign for {importantDate.title} ({format(importantDate.date, 'MMMM dd')}) with AI-generated content
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-6">
          {/* Campaign Setup - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-medium">Campaign Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Valentine's Day Campaign"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Planned Date</Label>
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
                  <Label className="text-xs font-medium">Campaign Theme *</Label>
                  <Select value={selectedSuggestion} onValueChange={setSelectedSuggestion}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select campaign theme" />
                    </SelectTrigger>
                    <SelectContent>
                      {importantDate.campaignSuggestions.map((suggestion) => (
                        <SelectItem key={suggestion} value={suggestion}>
                          {suggestion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-medium">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Campaign objectives..."
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>

                <Button 
                  onClick={generateAIContent}
                  disabled={!selectedSuggestion || generatingContent}
                  className="w-full gap-2 h-9"
                >
                  {generatingContent ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  {generatingContent ? 'Generating Content...' : 'Generate AI Content'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* AI Content Preview - Center Column */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-medium">AI-Generated Content</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {aiContent ? (
                  <Tabs defaultValue="email" className="w-full">
                    <TabsList className="grid w-full grid-cols-3" variant="compact">
                      <TabsTrigger value="email" variant="compact" className="text-xs">📧 Email</TabsTrigger>
                      <TabsTrigger value="social" variant="compact" className="text-xs">📱 Social</TabsTrigger>
                      <TabsTrigger value="print" variant="compact" className="text-xs">🖨️ Print</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="email" className="space-y-3 mt-4">
                      <div className="space-y-3">
                        <div className="p-3 bg-muted/30 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Subject Line</span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => copyToClipboard(aiContent.emailSubject, 'Email subject')}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-sm font-medium">{aiContent.emailSubject}</p>
                        </div>
                        
                        <div className="p-3 bg-muted/30 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Email Body</span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => copyToClipboard(aiContent.emailBody, 'Email body')}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="text-sm whitespace-pre-line leading-relaxed text-muted-foreground">
                            {aiContent.emailBody}
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="social" className="mt-4">
                      <div className="p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">Social Media Caption</span>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => copyToClipboard(aiContent.socialCaption, 'Social caption')}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{aiContent.socialCaption}</p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="print" className="mt-4">
                      <div className="p-3 bg-muted/30 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">Print/Card Message</span>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => copyToClipboard(aiContent.printMessage, 'Print message')}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{aiContent.printMessage}</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                      <Wand2 className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                      Select a campaign theme and generate AI content to see personalized marketing materials
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Office Selection - Right Column */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-medium">Target Offices</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {selectedOffices.length} selected
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="h-8">
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
                
                {loadingOffices ? (
                  <div className="text-center py-6">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs text-muted-foreground">Loading offices...</p>
                  </div>
                ) : (
                  <div className="border rounded-md max-h-80 overflow-y-auto">
                    {filteredOffices.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-xs">No offices found for the selected filter.</p>
                      </div>
                    ) : (
                      <div className="space-y-1 p-2">
                        {filteredOffices.map((office) => (
                          <div key={office.id} className="flex items-start space-x-2 p-2 hover:bg-muted/50 rounded">
                            <Checkbox
                              id={office.id}
                              checked={selectedOffices.includes(office.id)}
                              onCheckedChange={(checked) => handleOfficeSelection(office.id, checked as boolean)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <Label htmlFor={office.id} className="cursor-pointer">
                                <div className="text-xs font-medium leading-tight">{office.name}</div>
                                {office.address && (
                                  <div className="text-xs text-muted-foreground truncate mt-0.5">{office.address}</div>
                                )}
                                <div className="mt-1">
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs h-4 px-1.5 ${
                                      office.referral_tier === 'VIP' ? 'bg-purple-100 text-purple-800' :
                                      office.referral_tier === 'Warm' ? 'bg-green-100 text-green-800' :
                                      office.referral_tier === 'Cold' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {office.referral_tier || 'Unknown'}
                                  </Badge>
                                </div>
                              </Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !aiContent || selectedOffices.length === 0}
            className="gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {loading ? 'Creating Campaign...' : 'Launch Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}