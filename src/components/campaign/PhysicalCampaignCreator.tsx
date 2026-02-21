import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Package, ArrowRight, ArrowLeft, Gift, Search, Users, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnhancedDatePicker } from '../EnhancedDatePicker';
import { useOffices } from '@/hooks/useOffices';
import { format } from 'date-fns';

interface PhysicalCampaignCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

interface Office {
  id: string;
  name: string;
  address: string;
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
  icon: string;
}

const GIFT_BUNDLES: GiftBundle[] = [
  { id: 'appreciation-basket', name: 'Appreciation Basket', description: 'Premium gift basket with gourmet treats', items: ['Gourmet coffee', 'Artisan chocolates', 'Branded mug', 'Thank you card'], estimatedCost: 75, icon: '🎁' },
  { id: 'holiday-deluxe', name: 'Holiday Deluxe', description: 'Festive seasonal gift package', items: ['Seasonal treats', 'Holiday decorations', 'Branded calendar', 'Gift card'], estimatedCost: 100, icon: '🎄' },
  { id: 'wellness-bundle', name: 'Wellness Bundle', description: 'Health-focused gift set', items: ['Wellness journal', 'Herbal tea set', 'Stress relief items', 'Educational materials'], estimatedCost: 60, icon: '🧘' },
  { id: 'office-essentials', name: 'Office Essentials', description: 'Practical supplies with branding', items: ['Branded pens', 'Notepads', 'Desk organizer', 'Business card holder'], estimatedCost: 45, icon: '✏️' },
];

const CAMPAIGN_TYPES = [
  { value: 'referral_appreciation', label: 'Referral Appreciation' },
  { value: 'new_office_intro', label: 'New Office Introduction' },
  { value: 'holiday_campaign', label: 'Holiday Campaign' },
  { value: 'milestone_celebration', label: 'Milestone Celebration' },
];

const TIER_FILTERS = ['all', 'VIP', 'Warm', 'Cold', 'Dormant'] as const;

export function PhysicalCampaignCreator({ open, onOpenChange, onCampaignCreated }: PhysicalCampaignCreatorProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState('all');
  const [officeSearch, setOfficeSearch] = useState('');
  
  const [campaignType, setCampaignType] = useState('referral_appreciation');
  const [campaignName, setCampaignName] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [selectedGiftBundle, setSelectedGiftBundle] = useState<string>('');

  const { data: officesData, isLoading: loadingOffices } = useOffices();
  
  const offices: Office[] = useMemo(() => (officesData || []).map(office => ({
    id: office.id,
    name: office.name || '',
    address: office.address || '',
    l12: office.l12 || 0,
    r3: office.r3 || 0,
    mslr: office.mslr || 0,
    tier: office.tier || 'Cold',
  })), [officesData]);

  const filteredOffices = useMemo(() => {
    let result = tierFilter === 'all' ? offices : offices.filter(o => o.tier === tierFilter);
    if (officeSearch) {
      const q = officeSearch.toLowerCase();
      result = result.filter(o => o.name.toLowerCase().includes(q) || o.address.toLowerCase().includes(q));
    }
    return result;
  }, [offices, tierFilter, officeSearch]);

  const selectedBundle = GIFT_BUNDLES.find(b => b.id === selectedGiftBundle);
  const totalCost = selectedBundle ? selectedBundle.estimatedCost * selectedOffices.length : 0;

  useEffect(() => {
    if (!campaignName && campaignType) {
      const typeLabel = CAMPAIGN_TYPES.find(t => t.value === campaignType)?.label || '';
      setCampaignName(`${typeLabel} - ${format(new Date(), 'MMM yyyy')}`);
    }
  }, [campaignType]);

  const handleOfficeToggle = (officeId: string) => {
    setSelectedOffices(prev => prev.includes(officeId) ? prev.filter(id => id !== officeId) : [...prev, officeId]);
  };

  const handleSelectAll = () => {
    const ids = filteredOffices.map(o => o.id);
    const allSelected = ids.every(id => selectedOffices.includes(id));
    setSelectedOffices(prev => allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

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
          name: campaignName, campaign_type: campaignType, delivery_method: 'physical',
          planned_delivery_date: plannedDate?.toISOString().split('T')[0],
          notes, status: 'Draft', campaign_mode: 'traditional',
          selected_gift_bundle: selectedBundle, estimated_cost: totalCost,
          created_by: user.id,
        } as any)
        .select().single();

      if (campaignError) throw campaignError;

      const deliveries = selectedOffices.map(officeId => ({
        campaign_id: campaign.id, office_id: officeId,
        referral_tier: offices.find(o => o.id === officeId)?.tier || 'Cold',
        action_mode: 'gift_only', gift_status: 'pending', delivery_status: 'Not Started', created_by: user.id,
      }));

      const { error: deliveriesError } = await supabase.from('campaign_deliveries').insert(deliveries);
      if (deliveriesError) throw deliveriesError;

      toast.success('Gift campaign created!');
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
    setStep(1); setCampaignType('referral_appreciation'); setCampaignName('');
    setPlannedDate(undefined); setNotes(''); setSelectedGiftBundle('');
    setSelectedOffices([]); setTierFilter('all'); setOfficeSearch('');
  };

  useEffect(() => { if (!open) resetForm(); }, [open]);

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-4">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
            step === s ? 'bg-primary text-primary-foreground' : step > s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
          </div>
          {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-primary/40' : 'bg-muted'}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Create Gift Campaign
          </DialogTitle>
        </DialogHeader>

        <StepIndicator />

        {/* Running cost estimate */}
        {selectedGiftBundle && selectedOffices.length > 0 && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 rounded-lg text-sm">
            <DollarSign className="w-4 h-4 text-amber-600" />
            <span className="font-medium text-amber-700 dark:text-amber-400">
              Estimated total: ${totalCost} ({selectedOffices.length} × ${selectedBundle?.estimatedCost})
            </span>
          </div>
        )}

        <ScrollArea className="max-h-[calc(90vh-260px)] pr-4">
          {/* Step 1: Details + Gift Bundle */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Campaign Name *</Label>
                  <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {CAMPAIGN_TYPES.map(t => (
                      <Badge key={t.value} variant={campaignType === t.value ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setCampaignType(t.value)}>
                        {t.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Planned Delivery Date</Label>
                  <EnhancedDatePicker value={plannedDate} onChange={setPlannedDate} placeholder="Select date" />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes..." />
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold mb-3 block">Select Gift Bundle *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {GIFT_BUNDLES.map(bundle => (
                    <Card 
                      key={bundle.id} 
                      className={`cursor-pointer transition-all ${selectedGiftBundle === bundle.id ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                      onClick={() => setSelectedGiftBundle(bundle.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{bundle.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm">{bundle.name}</h4>
                              <span className="font-bold text-primary">${bundle.estimatedCost}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{bundle.description}</p>
                            <p className="text-xs text-muted-foreground mt-1.5">{bundle.items.join(' · ')}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Office Selection */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Select Target Offices *</Label>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {filteredOffices.length > 0 && filteredOffices.every(o => selectedOffices.includes(o.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search offices..." value={officeSearch} onChange={(e) => setOfficeSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {TIER_FILTERS.map(t => (
                    <Badge key={t} variant={tierFilter === t ? 'default' : 'outline'} className="cursor-pointer capitalize" onClick={() => setTierFilter(t)}>
                      {t === 'all' ? `All (${offices.length})` : `${t} (${offices.filter(o => o.tier === t).length})`}
                    </Badge>
                  ))}
                </div>
              </div>

              {loadingOffices ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto border rounded-lg p-3">
                  {filteredOffices.map(office => (
                    <div key={office.id} className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${selectedOffices.includes(office.id) ? 'bg-primary/5' : ''}`} onClick={() => handleOfficeToggle(office.id)}>
                      <Checkbox checked={selectedOffices.includes(office.id)} onCheckedChange={() => handleOfficeToggle(office.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{office.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{office.address}</div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{office.tier}</Badge>
                    </div>
                  ))}
                  {filteredOffices.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No offices match</p>}
                </div>
              )}
              <p className="text-sm text-muted-foreground">{selectedOffices.length} office(s) selected</p>
            </div>
          )}

          {/* Step 3: Summary */}
          {step === 3 && (
            <div className="space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold">Campaign Summary</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Name</span><p className="font-medium">{campaignName}</p></div>
                    <div><span className="text-muted-foreground">Type</span><p className="font-medium capitalize">{campaignType.replace(/_/g, ' ')}</p></div>
                    <div><span className="text-muted-foreground">Gift</span><p className="font-medium">{selectedBundle?.icon} {selectedBundle?.name}</p></div>
                    <div><span className="text-muted-foreground">Offices</span><p className="font-medium">{selectedOffices.length}</p></div>
                    {plannedDate && <div><span className="text-muted-foreground">Delivery Date</span><p className="font-medium">{format(plannedDate, 'MMM dd, yyyy')}</p></div>}
                    <div className="col-span-2 pt-2 border-t">
                      <span className="text-muted-foreground">Estimated Total Cost</span>
                      <p className="text-xl font-bold text-primary">${totalCost}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <div>{step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={step === 1 ? !selectedGiftBundle : selectedOffices.length === 0}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : 'Create Campaign'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
