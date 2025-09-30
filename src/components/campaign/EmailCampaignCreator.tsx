import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnhancedDatePicker } from '../EnhancedDatePicker';

interface EmailCampaignCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

interface Office {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  l12: number;
  r3: number;
  mslr: number;
  tier: string;
}

const CAMPAIGN_TYPES = [
  { value: 'referral_outreach', label: 'Referral Outreach', description: 'Connect with existing referral sources' },
  { value: 'new_office', label: 'New Office Introduction', description: 'Introduce your practice to new offices' },
  { value: 're_engagement', label: 'Re-engagement', description: 'Reconnect with dormant referral sources' },
  { value: 'important_date', label: 'Important Date', description: 'Holidays, anniversaries, special occasions' },
];

const OFFICE_TIER_FILTERS = [
  { value: 'all', label: 'All Offices', color: 'bg-gray-500' },
  { value: 'VIP', label: 'VIP', color: 'bg-purple-500' },
  { value: 'Warm', label: 'Warm', color: 'bg-orange-500' },
  { value: 'Cold', label: 'Cold', color: 'bg-blue-500' },
  { value: 'Dormant', label: 'Dormant', color: 'bg-gray-500' },
];

export function EmailCampaignCreator({ open, onOpenChange, onCampaignCreated }: EmailCampaignCreatorProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(true);
  
  // Form state
  const [campaignType, setCampaignType] = useState('referral_outreach');
  const [campaignName, setCampaignName] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState('all');

  // Fetch offices
  useEffect(() => {
    if (open) {
      fetchOffices();
    }
  }, [open]);

  const fetchOffices = async () => {
    setLoadingOffices(true);
    try {
      const { data, error } = await supabase.from('office_metrics').select('*').order('name');
      
      if (error) throw error;
      
      const officesWithTiers = (data || []).map((office: any) => {
        const l12 = office.l12 || 0;
        const r3 = office.r3 || 0;
        const mslr = office.mslr || 0;
        
        let tier = 'Cold';
        if (l12 >= 12 && r3 >= 3 && mslr <= 4) tier = 'VIP';
        else if (l12 >= 6 && r3 >= 2) tier = 'Warm';
        else if (r3 === 0 && l12 > 0) tier = 'Dormant';
        
        return {
          id: office.id,
          name: office.name,
          address: office.address,
          phone: office.phone,
          email: office.email,
          l12,
          r3,
          mslr,
          tier,
        };
      });
      
      setOffices(officesWithTiers);
    } catch (error: any) {
      toast.error('Failed to load offices');
    } finally {
      setLoadingOffices(false);
    }
  };

  const filteredOffices = tierFilter === 'all' 
    ? offices 
    : offices.filter(o => o.tier === tierFilter);

  const handleOfficeSelection = (officeId: string) => {
    setSelectedOffices(prev => 
      prev.includes(officeId) 
        ? prev.filter(id => id !== officeId)
        : [...prev, officeId]
    );
  };

  const handleSelectAllInCategory = () => {
    const currentFilteredIds = filteredOffices.map(o => o.id);
    const allSelected = currentFilteredIds.every(id => selectedOffices.includes(id));
    
    if (allSelected) {
      // Deselect all in current filter
      setSelectedOffices(prev => prev.filter(id => !currentFilteredIds.includes(id)));
    } else {
      // Select all in current filter
      setSelectedOffices(prev => {
        const newSelection = [...prev];
        currentFilteredIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const allInCategorySelected = filteredOffices.length > 0 && 
    filteredOffices.every(o => selectedOffices.includes(o.id));

  const handleSubmit = async () => {
    if (!campaignName || selectedOffices.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: campaignName,
          campaign_type: campaignType,
          delivery_method: 'email',
          planned_delivery_date: plannedDate?.toISOString().split('T')[0],
          notes,
          status: 'Draft',
          campaign_mode: 'ai_powered',
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (campaignError) throw campaignError;

      const deliveries = selectedOffices.map(officeId => {
        const office = offices.find(o => o.id === officeId);
        return {
          campaign_id: campaign.id,
          office_id: officeId,
          email_status: 'pending',
          action_mode: 'email_only',
          delivery_status: 'Not Started',
          referral_tier: office?.tier || 'Cold',
          created_by: user.id,
        };
      });

      const { error: deliveriesError } = await supabase
        .from('campaign_deliveries')
        .insert(deliveries);

      if (deliveriesError) throw deliveriesError;

      toast.success('Email campaign created successfully!');
      onCampaignCreated();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error('Failed to create campaign: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setCampaignType('referral_outreach');
    setCampaignName('');
    setPlannedDate(undefined);
    setNotes('');
    setSelectedOffices([]);
    setTierFilter('all');
  };

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Create Email Campaign - Step {step} of 3
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-lg font-semibold mb-3 block">Select Campaign Type</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {CAMPAIGN_TYPES.map(type => (
                    <div
                      key={type.value}
                      onClick={() => setCampaignType(type.value)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        campaignType === type.value 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-semibold">{type.label}</div>
                      <div className="text-sm text-muted-foreground mt-1">{type.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="campaignName">Campaign Name *</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Spring Referral Outreach"
                />
              </div>

              <div>
                <Label htmlFor="plannedDate">Planned Send Date</Label>
                <EnhancedDatePicker
                  value={plannedDate}
                  onChange={setPlannedDate}
                  placeholder="Select date"
                />
              </div>

              <div>
                <Label htmlFor="notes">Campaign Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this campaign..."
                  rows={6}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-lg font-semibold">Select Target Offices</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllInCategory}
                    disabled={filteredOffices.length === 0}
                  >
                    {allInCategorySelected ? 'Deselect' : 'Select'} All in {OFFICE_TIER_FILTERS.find(f => f.value === tierFilter)?.label}
                  </Button>
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {OFFICE_TIER_FILTERS.map(filter => (
                    <Badge
                      key={filter.value}
                      variant={tierFilter === filter.value ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setTierFilter(filter.value)}
                    >
                      {filter.label} ({filter.value === 'all' ? offices.length : offices.filter(o => o.tier === filter.value).length})
                    </Badge>
                  ))}
                </div>

                {loadingOffices ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-lg p-4">
                    {filteredOffices.map(office => (
                      <div key={office.id} className="flex items-start gap-3 p-3 border rounded hover:bg-muted/50">
                        <Checkbox
                          checked={selectedOffices.includes(office.id)}
                          onCheckedChange={() => handleOfficeSelection(office.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{office.name}</div>
                          <div className="text-sm text-muted-foreground">{office.address}</div>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span>L12: {office.l12}</span>
                            <span>R3: {office.r3}</span>
                            <span>MSLR: {office.mslr.toFixed(1)}</span>
                            <Badge variant="outline" className="text-xs">{office.tier}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-sm text-muted-foreground mt-2">
                  {selectedOffices.length} office(s) selected
                </div>
              </div>
            </div>
          )}

        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step < 3 && (
              <Button onClick={() => setStep(step + 1)}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleSubmit} disabled={loading || selectedOffices.length === 0}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Campaign'
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
