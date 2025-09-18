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
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {importantDate.title} Campaign
          </DialogTitle>
          <DialogDescription>
            Create a campaign for {importantDate.title} ({format(importantDate.date, 'MMMM dd')}) with AI-generated content
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Valentine's Day Campaign"
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
              <Label>Campaign Theme *</Label>
              <Select value={selectedSuggestion} onValueChange={setSelectedSuggestion}>
                <SelectTrigger>
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
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Campaign objectives, special instructions..."
                rows={3}
              />
            </div>

            {/* Generate AI Content Button */}
            <Button 
              onClick={generateAIContent}
              disabled={!selectedSuggestion || generatingContent}
              className="w-full gap-2"
            >
              {generatingContent ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {generatingContent ? 'Generating...' : 'Generate AI Content'}
            </Button>
          </div>

          {/* AI Content Preview */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <Label>AI-Generated Content</Label>
            </div>
            
            {aiContent ? (
              <Tabs defaultValue="email" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="social">Social</TabsTrigger>
                  <TabsTrigger value="print">Print</TabsTrigger>
                </TabsList>
                
                <TabsContent value="email" className="space-y-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Email Subject</CardTitle>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => copyToClipboard(aiContent.emailSubject, 'Email subject')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{aiContent.emailSubject}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Email Body</CardTitle>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => copyToClipboard(aiContent.emailBody, 'Email body')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm whitespace-pre-line">{aiContent.emailBody}</div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="social">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Social Media Caption</CardTitle>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => copyToClipboard(aiContent.socialCaption, 'Social caption')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{aiContent.socialCaption}</p>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="print">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Print/Card Message</CardTitle>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => copyToClipboard(aiContent.printMessage, 'Print message')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{aiContent.printMessage}</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="text-center py-8">
                <CardContent>
                  <Wand2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Select a campaign theme and click "Generate AI Content" to create personalized marketing materials.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Office Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <Label>Target Offices * ({selectedOffices.length} selected)</Label>
              </div>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-32">
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
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading offices...</p>
              </div>
            ) : (
              <div className="border rounded-md max-h-96 overflow-y-auto">
                {filteredOffices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No offices found for the selected filter.</p>
                  </div>
                ) : (
                  <div className="space-y-2 p-4">
                    {filteredOffices.map((office) => (
                      <div key={office.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={office.id}
                          checked={selectedOffices.includes(office.id)}
                          onCheckedChange={(checked) => handleOfficeSelection(office.id, checked as boolean)}
                        />
                        <div className="flex-1 min-w-0">
                          <Label htmlFor={office.id} className="cursor-pointer">
                            <div className="font-medium">{office.name}</div>
                            {office.address && (
                              <div className="text-sm text-muted-foreground truncate">{office.address}</div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${
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
          </div>
        </div>

        <DialogFooter>
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
            {loading ? 'Creating...' : 'Launch Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}