import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package, ArrowRight, ArrowLeft, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnhancedDatePicker } from './EnhancedDatePicker';

interface PhysicalCampaignCreatorProps {
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

interface GiftBundle {
  id: string;
  name: string;
  description: string;
  items: string[];
  estimatedCost: number;
  occasion: string[];
}

const GIFT_BUNDLES: GiftBundle[] = [
  {
    id: 'appreciation-basket',
    name: 'Appreciation Basket',
    description: 'Premium gift basket with gourmet treats',
    items: ['Gourmet coffee', 'Artisan chocolates', 'Branded mug', 'Thank you card'],
    estimatedCost: 75,
    occasion: ['general', 'appreciation'],
  },
  {
    id: 'holiday-deluxe',
    name: 'Holiday Deluxe Package',
    description: 'Festive seasonal gift package',
    items: ['Seasonal treats', 'Holiday decorations', 'Branded calendar', 'Gift card'],
    estimatedCost: 100,
    occasion: ['holiday', 'special'],
  },
  {
    id: 'wellness-bundle',
    name: 'Wellness Bundle',
    description: 'Health-focused gift set',
    items: ['Wellness journal', 'Herbal tea set', 'Stress relief items', 'Educational materials'],
    estimatedCost: 60,
    occasion: ['general', 'wellness'],
  },
  {
    id: 'office-essentials',
    name: 'Office Essentials',
    description: 'Practical office supplies with branding',
    items: ['Branded pens', 'Notepads', 'Desk organizer', 'Business card holder'],
    estimatedCost: 45,
    occasion: ['general', 'new-office'],
  },
];

const CAMPAIGN_TYPES = [
  { value: 'referral_appreciation', label: 'Referral Appreciation', description: 'Thank existing referral sources' },
  { value: 'new_office_intro', label: 'New Office Introduction', description: 'Introduce your practice with gifts' },
  { value: 'holiday_campaign', label: 'Holiday Campaign', description: 'Seasonal gift distribution' },
  { value: 'milestone_celebration', label: 'Milestone Celebration', description: 'Celebrate achievements together' },
];

const OFFICE_TIER_FILTERS = [
  { value: 'all', label: 'All Offices', color: 'bg-gray-500' },
  { value: 'VIP', label: 'VIP', color: 'bg-purple-500' },
  { value: 'Warm', label: 'Warm', color: 'bg-orange-500' },
  { value: 'Cold', label: 'Cold', color: 'bg-blue-500' },
  { value: 'Dormant', label: 'Dormant', color: 'bg-gray-500' },
];

export function PhysicalCampaignCreator({ open, onOpenChange, onCampaignCreated }: PhysicalCampaignCreatorProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(true);
  
  // Form state
  const [campaignType, setCampaignType] = useState('referral_appreciation');
  const [campaignName, setCampaignName] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [selectedGiftBundle, setSelectedGiftBundle] = useState<string>('');
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState('all');
  const [materialsChecklist, setMaterialsChecklist] = useState<string[]>([]);

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

  const selectedBundle = GIFT_BUNDLES.find(b => b.id === selectedGiftBundle);
  const totalEstimatedCost = selectedBundle ? selectedBundle.estimatedCost * selectedOffices.length : 0;

  const handleSubmit = async () => {
    if (!campaignName || !selectedGiftBundle || selectedOffices.length === 0) {
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
          delivery_method: 'Physical',
          planned_delivery_date: plannedDate?.toISOString().split('T')[0],
          notes,
          status: 'Draft',
          campaign_mode: 'traditional',
          selected_gift_bundle: selectedBundle,
          materials_checklist: materialsChecklist.length > 0 ? materialsChecklist : null,
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
          referral_tier: office?.tier || 'Cold',
          action_mode: 'gift_only',
          gift_status: 'pending',
          delivery_status: 'Not Started',
          created_by: user.id,
        };
      });

      const { error: deliveriesError } = await supabase
        .from('campaign_deliveries')
        .insert(deliveries);

      if (deliveriesError) throw deliveriesError;

      toast.success('Physical campaign created successfully!');
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
    setCampaignType('referral_appreciation');
    setCampaignName('');
    setPlannedDate(undefined);
    setNotes('');
    setSelectedGiftBundle('');
    setSelectedOffices([]);
    setTierFilter('all');
    setMaterialsChecklist([]);
  };

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Physical Campaign - Step {step} of 4
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
                  placeholder="e.g., Holiday Gift Distribution 2024"
                />
              </div>

              <div>
                <Label htmlFor="plannedDate">Planned Delivery Date</Label>
                <EnhancedDatePicker
                  value={plannedDate}
                  onChange={setPlannedDate}
                  placeholder="Select date"
                />
              </div>

              <div>
                <Label className="text-lg font-semibold mb-3 block">Select Gift Bundle *</Label>
                <div className="grid gap-3">
                  {GIFT_BUNDLES.map(bundle => (
                    <div
                      key={bundle.id}
                      onClick={() => setSelectedGiftBundle(bundle.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedGiftBundle === bundle.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold flex items-center gap-2">
                            <Gift className="h-4 w-4" />
                            {bundle.name}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">{bundle.description}</div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Includes: {bundle.items.join(', ')}
                          </div>
                        </div>
                        <div className="text-lg font-bold text-primary ml-4">
                          ${bundle.estimatedCost}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Campaign Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this campaign..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="text-lg font-semibold mb-3 block">Select Target Offices</Label>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {OFFICE_TIER_FILTERS.map(filter => (
                    <Badge
                      key={filter.value}
                      variant={tierFilter === filter.value ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setTierFilter(filter.value)}
                    >
                      {filter.label}
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

          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Campaign Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Campaign Name:</span>
                    <span className="font-medium">{campaignName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gift Bundle:</span>
                    <span className="font-medium">{selectedBundle?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target Offices:</span>
                    <span className="font-medium">{selectedOffices.length}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Estimated Total Cost:</span>
                    <span className="font-bold text-lg text-primary">${totalEstimatedCost}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-lg font-semibold mb-3 block">Materials Checklist (Optional)</Label>
                <div className="space-y-2">
                  {selectedBundle?.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Checkbox
                        checked={materialsChecklist.includes(item)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setMaterialsChecklist([...materialsChecklist, item]);
                          } else {
                            setMaterialsChecklist(materialsChecklist.filter(i => i !== item));
                          }
                        }}
                      />
                      <Label className="cursor-pointer">{item}</Label>
                    </div>
                  ))}
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
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)} disabled={step === 2 && !selectedGiftBundle}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
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
