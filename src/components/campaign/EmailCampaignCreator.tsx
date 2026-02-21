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
import { Loader2, Mail, ArrowRight, ArrowLeft, Search, Users, Calendar, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnhancedDatePicker } from '../EnhancedDatePicker';
import { useOffices } from '@/hooks/useOffices';
import { format } from 'date-fns';

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

const TIER_FILTERS = ['all', 'VIP', 'Warm', 'Cold', 'Dormant'] as const;

export function EmailCampaignCreator({ open, onOpenChange, onCampaignCreated }: EmailCampaignCreatorProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState('all');
  const [officeSearch, setOfficeSearch] = useState('');
  
  const [campaignType, setCampaignType] = useState('referral_outreach');
  const [campaignName, setCampaignName] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date>();
  const [notes, setNotes] = useState('');

  const { data: officesData, isLoading: loadingOffices } = useOffices();
  
  const offices: Office[] = useMemo(() => (officesData || []).map(office => ({
    id: office.id,
    name: office.name || '',
    address: office.address || '',
    phone: office.phone || undefined,
    email: office.email || undefined,
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

  // Auto-suggest name
  useEffect(() => {
    if (!campaignName && campaignType) {
      const typeLabel = CAMPAIGN_TYPES.find(t => t.value === campaignType)?.label || '';
      const dateStr = format(new Date(), 'MMM yyyy');
      setCampaignName(`${typeLabel} - ${dateStr}`);
    }
  }, [campaignType]);

  const handleOfficeToggle = (officeId: string) => {
    setSelectedOffices(prev => prev.includes(officeId) ? prev.filter(id => id !== officeId) : [...prev, officeId]);
  };

  const handleSelectAll = () => {
    const ids = filteredOffices.map(o => o.id);
    const allSelected = ids.every(id => selectedOffices.includes(id));
    if (allSelected) {
      setSelectedOffices(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedOffices(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const handleSubmit = async () => {
    if (!campaignName || selectedOffices.length === 0) {
      toast.error('Please provide a name and select at least one office');
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

      const { error: deliveriesError } = await supabase.from('campaign_deliveries').insert(deliveries);
      if (deliveriesError) throw deliveriesError;

      toast.success('Email campaign created!');
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
    setOfficeSearch('');
  };

  useEffect(() => { if (!open) resetForm(); }, [open]);

  const canProceedStep1 = !!campaignType;
  const canProceedStep2 = !!campaignName && selectedOffices.length > 0;

  // Step indicator
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
            <Mail className="h-5 w-5" /> Create Email Campaign
          </DialogTitle>
        </DialogHeader>

        <StepIndicator />

        <ScrollArea className="max-h-[calc(90vh-220px)] pr-4">
          {/* Step 1: Campaign Type */}
          {step === 1 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Select Campaign Type</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CAMPAIGN_TYPES.map(type => (
                  <div
                    key={type.value}
                    onClick={() => setCampaignType(type.value)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      campaignType === type.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-semibold">{type.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">{type.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Details + Office Selection */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="campaignName">Campaign Name *</Label>
                  <Input id="campaignName" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                </div>
                <div>
                  <Label>Planned Send Date</Label>
                  <EnhancedDatePicker value={plannedDate} onChange={setPlannedDate} placeholder="Select date" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes..." />
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Select Target Offices *</Label>
                  <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={filteredOffices.length === 0}>
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
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto border rounded-lg p-3">
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
                    {filteredOffices.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-6">No offices match your filters</p>
                    )}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{selectedOffices.length} office(s) selected</p>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold">Campaign Summary</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name</span>
                      <p className="font-medium">{campaignName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type</span>
                      <p className="font-medium capitalize">{campaignType.replace(/_/g, ' ')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Offices</span>
                      <p className="font-medium flex items-center gap-1"><Users className="w-3.5 h-3.5" />{selectedOffices.length}</p>
                    </div>
                    {plannedDate && (
                      <div>
                        <span className="text-muted-foreground">Planned Date</span>
                        <p className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(plannedDate, 'MMM dd, yyyy')}</p>
                      </div>
                    )}
                  </div>
                  {notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {notes}</div>}
                </CardContent>
              </Card>
              
              <div>
                <Label className="text-sm font-semibold">Selected Offices</Label>
                <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
                  {selectedOffices.map(id => {
                    const o = offices.find(off => off.id === id);
                    return o ? (
                      <div key={id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/30">
                        <span>{o.name}</span>
                        <Badge variant="outline" className="text-xs">{o.tier}</Badge>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {step < 3 && (
              <Button onClick={() => setStep(step + 1)} disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 3 && (
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
