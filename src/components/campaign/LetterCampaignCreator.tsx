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
import { Loader2, FileText, ArrowRight, ArrowLeft, Search, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EnhancedDatePicker } from '../EnhancedDatePicker';
import { useOffices } from '@/hooks/useOffices';
import { format } from 'date-fns';

interface LetterCampaignCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

const CAMPAIGN_TYPES = [
  { value: 'referral_appreciation', label: 'Referral Appreciation', description: 'Thank your top referral partners' },
  { value: 'new_office', label: 'New Office Introduction', description: 'Introduce your practice to new offices' },
  { value: 're_engagement', label: 'Re-engagement', description: 'Reconnect with dormant referral sources' },
  { value: 'holiday_seasonal', label: 'Holiday / Seasonal', description: 'Seasonal greetings and well-wishes' },
];

const TIER_FILTERS = ['all', 'VIP', 'Warm', 'Cold', 'Dormant'] as const;

export function LetterCampaignCreator({ open, onOpenChange, onCampaignCreated }: LetterCampaignCreatorProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState('all');
  const [officeSearch, setOfficeSearch] = useState('');
  const [campaignType, setCampaignType] = useState('referral_appreciation');
  const [campaignName, setCampaignName] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date>();
  const [notes, setNotes] = useState('');

  const { data: officesData, isLoading: loadingOffices } = useOffices();

  const offices = useMemo(() => (officesData || []).map(office => ({
    id: office.id,
    name: office.name || '',
    address: office.address || '',
    tier: office.tier || 'Cold',
  })), [officesData]);

  const currentOfficeList = useMemo(() => {
    let result = tierFilter === 'all' ? offices : offices.filter(o => o.tier === tierFilter);
    if (officeSearch) {
      const q = officeSearch.toLowerCase();
      result = result.filter(o => o.name.toLowerCase().includes(q) || o.address.toLowerCase().includes(q));
    }
    return result.map(o => ({ id: o.id, name: o.name, address: o.address, badge: o.tier }));
  }, [offices, tierFilter, officeSearch]);

  useEffect(() => {
    if (!campaignName && campaignType) {
      const typeLabel = CAMPAIGN_TYPES.find(t => t.value === campaignType)?.label || '';
      setCampaignName(`${typeLabel} Letters - ${format(new Date(), 'MMM yyyy')}`);
    }
  }, [campaignType]);

  const handleOfficeToggle = (officeId: string) => {
    setSelectedOffices(prev => prev.includes(officeId) ? prev.filter(id => id !== officeId) : [...prev, officeId]);
  };

  const handleSelectAll = () => {
    const ids = currentOfficeList.map(o => o.id);
    const allSelected = ids.every(id => selectedOffices.includes(id));
    setSelectedOffices(prev => allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
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
          delivery_method: 'letter',
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
        const office = currentOfficeList.find(o => o.id === officeId);
        return {
          campaign_id: campaign.id,
          office_id: officeId,
          email_status: 'pending',
          action_mode: 'letter_only',
          delivery_status: 'Not Started',
          referral_tier: office?.badge || 'Cold',
          created_by: user.id,
        };
      });

      const { error: deliveriesError } = await supabase.from('campaign_deliveries').insert(deliveries);
      if (deliveriesError) throw deliveriesError;

      toast.success('Letter campaign created!');
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
    setSelectedOffices([]);
    setTierFilter('all');
    setOfficeSearch('');
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
            <FileText className="h-5 w-5" /> Create Letter Campaign
          </DialogTitle>
        </DialogHeader>

        <StepIndicator />

        <ScrollArea className="max-h-[calc(90vh-220px)] pr-4">
          {step === 1 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Select Campaign Type</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CAMPAIGN_TYPES.map(type => (
                  <div key={type.value} onClick={() => setCampaignType(type.value)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      campaignType === type.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}>
                    <div className="font-semibold">{type.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">{type.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="letterCampaignName">Campaign Name *</Label>
                  <Input id="letterCampaignName" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                </div>
                <div>
                  <Label>Planned Print Date</Label>
                  <EnhancedDatePicker value={plannedDate} onChange={setPlannedDate} placeholder="Select date" />
                </div>
              </div>
              <div>
                <Label htmlFor="letterNotes">Notes</Label>
                <Textarea id="letterNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes..." />
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Select Target Offices *</Label>
                  <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={currentOfficeList.length === 0}>
                    {currentOfficeList.length > 0 && currentOfficeList.every(o => selectedOffices.includes(o.id)) ? 'Deselect All' : 'Select All'}
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
                    {currentOfficeList.map(office => (
                      <div key={office.id} className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${selectedOffices.includes(office.id) ? 'bg-primary/5' : ''}`} onClick={() => handleOfficeToggle(office.id)}>
                        <Checkbox checked={selectedOffices.includes(office.id)} onCheckedChange={() => handleOfficeToggle(office.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{office.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{office.address}</div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{office.badge}</Badge>
                      </div>
                    ))}
                    {currentOfficeList.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No offices match your filters</p>}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{selectedOffices.length} office(s) selected</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold">Campaign Summary</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Name</span><p className="font-medium">{campaignName}</p></div>
                    <div><span className="text-muted-foreground">Type</span><p className="font-medium capitalize">{campaignType.replace(/_/g, ' ')}</p></div>
                    <div><span className="text-muted-foreground">Offices</span><p className="font-medium">{selectedOffices.length} selected</p></div>
                    <div><span className="text-muted-foreground">Print Date</span><p className="font-medium">{plannedDate ? format(plannedDate, 'PPP') : 'Not set'}</p></div>
                  </div>
                  {notes && <div className="text-sm"><span className="text-muted-foreground">Notes</span><p>{notes}</p></div>}
                </CardContent>
              </Card>
              <p className="text-sm text-muted-foreground">After creating the campaign, you'll be able to generate AI-powered letters per tier and customize them before exporting as PDF.</p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1"><ArrowLeft className="w-4 h-4" /> Back</Button>}
          <div className="flex-1" />
          {step < 3 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !campaignType : (!campaignName || selectedOffices.length === 0)} className="gap-1">
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="gap-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {loading ? 'Creating...' : 'Create Letter Campaign'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
