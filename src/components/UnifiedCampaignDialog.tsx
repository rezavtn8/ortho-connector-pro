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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnhancedDatePicker } from '@/components/EnhancedDatePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Gift, Mail, Crown, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sanitizeText } from '@/lib/sanitize';
import { GIFT_BUNDLES, OFFICE_TIER_FILTERS, GiftBundle } from '@/data/giftBundles';

interface Office {
  id: string;
  name: string;
  address?: string;
  source_type: string;
  referral_tier?: string;
  last_referral_date?: string;
}

interface UnifiedCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

export function UnifiedCampaignDialog({ open, onOpenChange, onCampaignCreated }: UnifiedCampaignDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    planned_delivery_date: null as Date | null,
    notes: ''
  });
  
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedGiftBundle, setSelectedGiftBundle] = useState<GiftBundle | null>(null);
  const [tierFilter, setTierFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(true);

  // Fetch offices with referral tiers
  useEffect(() => {
    const fetchOffices = async () => {
      if (!user) return;

      try {
        setLoadingOffices(true);
        
        // Load office sources only
        const { data: sourcesData, error: sourcesError } = await supabase
          .from('patient_sources')
          .select('id, name, address, source_type')
          .eq('created_by', user.id)
          .eq('is_active', true)
          .eq('source_type', 'Office')
          .order('name');

        if (sourcesError) throw sourcesError;

        // Load monthly data for the past 12 months
        const { data: monthlyData, error: monthlyError } = await supabase
          .from('monthly_patients')
          .select('*')
          .eq('user_id', user.id);

        if (monthlyError) throw monthlyError;

        // Calculate metrics for each office using the same logic as Offices page
        const processedOffices = [];
        const currentDate = new Date();
        
        for (const source of sourcesData || []) {
          const sourceMonthlyData = monthlyData?.filter(m => m.source_id === source.id) || [];
          
          // Calculate L12 (last 12 months)
          const l12 = sourceMonthlyData
            .filter(m => {
              const [year, month] = m.year_month.split('-').map(Number);
              const dataDate = new Date(year, month - 1);
              const twelveMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 12);
              return dataDate >= twelveMonthsAgo;
            })
            .reduce((sum, m) => sum + m.patient_count, 0);

          // Calculate R3 (last 3 months)
          const r3 = sourceMonthlyData
            .filter(m => {
              const [year, month] = m.year_month.split('-').map(Number);
              const dataDate = new Date(year, month - 1);
              const threeMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 3);
              return dataDate >= threeMonthsAgo;
            })
            .reduce((sum, m) => sum + m.patient_count, 0);

          // Calculate MSLR (months since last referral)
          const calculateMonthsSinceLastReferral = (monthlyData) => {
            const currentDate = new Date();
            const sortedData = monthlyData
              .filter(data => data.patient_count > 0)
              .sort((a, b) => b.year_month.localeCompare(a.year_month));
            
            if (sortedData.length === 0) return 999;
            
            const lastReferralYearMonth = sortedData[0].year_month;
            const [lastYear, lastMonth] = lastReferralYearMonth.split('-').map(Number);
            const [currentYear, currentMonth] = [currentDate.getFullYear(), currentDate.getMonth() + 1];
            
            return (currentYear - lastYear) * 12 + (currentMonth - lastMonth);
          };

          const mslr = calculateMonthsSinceLastReferral(sourceMonthlyData);

          processedOffices.push({
            ...source,
            l12,
            r3,
            mslr
          });
        }

        // Calculate tiers using the same logic as Offices page
        const calculateTier = (l12, r3, mslr, allOffices) => {
          // Dormant: no referrals in last 12 months
          if (l12 === 0) return 'Dormant';

          // VIP: top 20% by L12
          const sortedByL12 = allOffices.map(o => o.l12).sort((a, b) => b - a);
          const vipThresholdIndex = Math.ceil(sortedByL12.length * 0.2) - 1;
          const vipThreshold = sortedByL12[vipThresholdIndex] || 0;
          
          if (l12 >= vipThreshold && vipThreshold > 0) return 'VIP';

          // Warm: ≥4 in last 12 months OR ≥1 in last 3 months (but not VIP)
          if (l12 >= 4 || r3 >= 1) return 'Warm';

          // Cold: everything else
          return 'Cold';
        };

        const officesWithTiers = processedOffices.map(office => {
          const sourceMonthlyData = monthlyData?.filter(m => m.source_id === office.id) || [];
          return {
            ...office,
            referral_tier: calculateTier(office.l12, office.r3, office.mslr, processedOffices),
            last_referral_date: sourceMonthlyData.filter(m => m.patient_count > 0)
              .sort((a, b) => b.year_month.localeCompare(a.year_month))[0]?.year_month 
              ? new Date(sourceMonthlyData.filter(m => m.patient_count > 0)
                  .sort((a, b) => b.year_month.localeCompare(a.year_month))[0].year_month + '-01')
                  .toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
              : null
          };
        });

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
    if (!open) {
      setFormData({
        name: '',
        planned_delivery_date: null,
        notes: ''
      });
      setSelectedOffices([]);
      setSelectedGiftBundle(null);
      setTierFilter('all');
    }
  }, [open]);

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

      // Create unified campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: sanitizedName,
          campaign_type: 'Unified Outreach',
          campaign_mode: 'unified',
          delivery_method: 'Multiple',
          selected_gift_bundle: selectedGiftBundle ? {
            id: selectedGiftBundle.id,
            name: selectedGiftBundle.name,
            description: selectedGiftBundle.description,
            items: selectedGiftBundle.items,
            cost: selectedGiftBundle.cost,
            is_premium: selectedGiftBundle.is_premium
          } : null,
          email_settings: {
            generate_emails: true,
            user_sends_manually: true
          },
          planned_delivery_date: formData.planned_delivery_date?.toISOString().split('T')[0] || null,
          notes: sanitizedNotes,
          created_by: user.id,
          status: 'Draft'
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create campaign deliveries for selected offices
      const selectedOfficeData = offices.filter(office => selectedOffices.includes(office.id));
      const deliveries = selectedOfficeData.map(office => ({
        campaign_id: campaign.id,
        office_id: office.id,
        created_by: user.id,
        referral_tier: office.referral_tier,
        action_mode: 'both', // Default to both email and gift
        email_status: 'pending',
        gift_status: selectedGiftBundle ? 'pending' : 'not_applicable'
      }));

      const { error: deliveriesError } = await supabase
        .from('campaign_deliveries')
        .insert(deliveries);

      if (deliveriesError) throw deliveriesError;

      onCampaignCreated();
      onOpenChange(false);
      
      toast({
        title: "Success",
        description: `Campaign created with ${selectedOffices.length} offices. Generate emails to begin outreach.`,
      });

    } catch (error) {
      console.error('Error creating campaign:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Campaign Creation Failed",
        description: `Error: ${errorMessage}. Please check your data and try again.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Create Unified Campaign
          </DialogTitle>
          <DialogDescription>
            Create a campaign that combines AI-generated emails and optional gift sending to referral offices.
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
                placeholder="Campaign objectives, special instructions..."
                rows={3}
              />
            </div>
          </div>

          {/* Gift Bundle Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              <Label>Gift Bundle (Optional)</Label>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <div 
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  !selectedGiftBundle ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedGiftBundle(null)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Email Only</h4>
                    <p className="text-sm text-muted-foreground">Send personalized emails without physical gifts</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm font-medium">$0</span>
                  </div>
                </div>
              </div>

              {GIFT_BUNDLES.map((bundle) => (
                <div
                  key={bundle.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedGiftBundle?.id === bundle.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedGiftBundle(bundle)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{bundle.name}</h4>
                      {bundle.is_premium && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                          <Crown className="w-3 h-3 mr-1" />
                          Premium
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-medium">${bundle.cost}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{bundle.description}</p>
                  <div className="text-xs text-muted-foreground">
                    Includes: {bundle.items.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Office Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <Label>Target Offices * ({selectedOffices.length} selected)</Label>
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{office.name}</span>
                              <Badge 
                                variant="outline" 
                                className={
                                  office.referral_tier === 'VIP' ? 'border-purple-500 text-purple-700' :
                                  office.referral_tier === 'Warm' ? 'border-green-500 text-green-700' :
                                  office.referral_tier === 'Cold' ? 'border-blue-500 text-blue-700' :
                                  'border-gray-500 text-gray-700'
                                }
                              >
                                {office.referral_tier}
                              </Badge>
                            </div>
                            {office.address && (
                              <div className="text-sm text-muted-foreground truncate">{office.address}</div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {office.source_type}
                              {office.last_referral_date && ` • Last referral: ${office.last_referral_date}`}
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
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}