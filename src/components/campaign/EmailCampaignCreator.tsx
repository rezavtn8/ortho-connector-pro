import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { EnhancedDatePicker } from '../EnhancedDatePicker';
import { OfficePicker } from './OfficePicker';
import { CampaignReview } from './CampaignReview';
import { StepIndicator } from './StepIndicator';
import { createCampaignWithDeliveries, type SelectedOffice } from '@/lib/campaigns';
import { useAutoCampaignName } from './useAutoCampaignName';

interface EmailCampaignCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
  preSelectedDiscoveredGroupId?: string | null;
}

const CAMPAIGN_TYPES = [
  { value: 'referral_outreach', label: 'Referral Outreach', description: 'Stay in touch with the offices already sending you patients' },
  { value: 'new_office', label: 'New Office Introduction', description: 'Introduce your practice to offices you have not worked with' },
  { value: 're_engagement', label: 'Re-engagement', description: 'Reconnect with sources that have gone quiet' },
  { value: 'important_date', label: 'Important Date', description: 'Holidays, anniversaries and milestones' },
];

export function EmailCampaignCreator({
  open,
  onOpenChange,
  onCampaignCreated,
  preSelectedDiscoveredGroupId,
}: EmailCampaignCreatorProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [campaignType, setCampaignType] = useState('referral_outreach');
  const [plannedDate, setPlannedDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [offices, setOffices] = useState<SelectedOffice[]>([]);
  const [addToNetwork, setAddToNetwork] = useState(false);

  const { name, setName, reset: resetName } = useAutoCampaignName(CAMPAIGN_TYPES, campaignType);

  const reset = () => {
    setStep(1);
    setCampaignType('referral_outreach');
    setPlannedDate(undefined);
    setNotes('');
    setOffices([]);
    setAddToNetwork(false);
    resetName();
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim() || offices.length === 0) {
      toast.error('Give the campaign a name and pick at least one office');
      return;
    }

    setLoading(true);
    try {
      await createCampaignWithDeliveries({
        campaign: {
          name: name.trim(),
          campaign_type: campaignType,
          delivery_method: 'email',
          planned_delivery_date: plannedDate?.toISOString().split('T')[0],
          notes,
          campaign_mode: 'ai_powered',
        },
        offices,
        actionMode: 'email_only',
        addDiscoveredToNetwork: addToNetwork,
      });

      toast.success('Email campaign created', {
        description: `${offices.length} offices are queued for drafting.`,
      });
      onCampaignCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Could not create the campaign', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const canAdvance = step === 1 ? !!campaignType : !!name.trim() && offices.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> New email campaign
          </DialogTitle>
        </DialogHeader>

        <StepIndicator step={step} labels={['Purpose', 'Audience', 'Review']} />

        <ScrollArea className="flex-1 min-h-0 pr-4">
          {step === 1 && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">What is this campaign for?</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CAMPAIGN_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setCampaignType(type.value)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      campaignType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-semibold">{type.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">{type.description}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                The purpose shapes the tone of the drafts the AI writes for each office.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emailCampaignName">Campaign name *</Label>
                  <Input
                    id="emailCampaignName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Planned send date</Label>
                  <EnhancedDatePicker
                    value={plannedDate}
                    onChange={setPlannedDate}
                    placeholder="Select date"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="emailNotes">Notes</Label>
                <Textarea
                  id="emailNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal notes — not sent to anyone."
                />
              </div>

              <div className="border-t pt-4">
                <OfficePicker
                  selected={offices}
                  onChange={setOffices}
                  requires="email"
                  addToNetwork={addToNetwork}
                  onAddToNetworkChange={setAddToNetwork}
                  preSelectedGroupId={preSelectedDiscoveredGroupId}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <CampaignReview
              method="email"
              name={name}
              typeLabel={CAMPAIGN_TYPES.find((t) => t.value === campaignType)?.label ?? campaignType}
              plannedDate={plannedDate}
              notes={notes}
              offices={offices}
              addToNetwork={addToNetwork}
              footnote="Nothing is sent yet — the campaign is created as a draft so you can generate and review every email first."
            />
          )}
        </ScrollArea>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canAdvance} className="gap-1">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Creating…' : 'Create campaign'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
