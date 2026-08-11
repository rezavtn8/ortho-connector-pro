import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Package, ArrowRight, ArrowLeft, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { EnhancedDatePicker } from '../EnhancedDatePicker';
import { OfficePicker } from './OfficePicker';
import { CampaignReview } from './CampaignReview';
import { StepIndicator } from './StepIndicator';
import { createCampaignWithDeliveries, type SelectedOffice } from '@/lib/campaigns';
import { useAutoCampaignName } from './useAutoCampaignName';

interface PhysicalCampaignCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
  preSelectedDiscoveredGroupId?: string | null;
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

export function PhysicalCampaignCreator({
  open,
  onOpenChange,
  onCampaignCreated,
  preSelectedDiscoveredGroupId,
}: PhysicalCampaignCreatorProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [campaignType, setCampaignType] = useState('referral_appreciation');
  const [plannedDate, setPlannedDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [offices, setOffices] = useState<SelectedOffice[]>([]);
  const [addToNetwork, setAddToNetwork] = useState(false);

  const { name, setName, reset: resetName } = useAutoCampaignName(CAMPAIGN_TYPES, campaignType);

  const bundle = GIFT_BUNDLES.find((b) => b.id === bundleId);
  const totalCost = bundle ? bundle.estimatedCost * offices.length : 0;

  const reset = () => {
    setStep(1);
    setCampaignType('referral_appreciation');
    setPlannedDate(undefined);
    setNotes('');
    setBundleId('');
    setOffices([]);
    setAddToNetwork(false);
    resetName();
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim() || !bundle || offices.length === 0) {
      toast.error('Pick a gift bundle, name the campaign and choose at least one office');
      return;
    }

    setLoading(true);
    try {
      await createCampaignWithDeliveries({
        campaign: {
          name: name.trim(),
          campaign_type: campaignType,
          delivery_method: 'physical',
          planned_delivery_date: plannedDate?.toISOString().split('T')[0],
          notes,
          campaign_mode: 'traditional',
          selected_gift_bundle: bundle,
          estimated_cost: totalCost,
          materials_checklist: bundle.items,
        },
        offices,
        actionMode: 'gift_only',
        addDiscoveredToNetwork: addToNetwork,
      });

      toast.success('Gift campaign created', {
        description: `${offices.length} deliveries queued · $${totalCost} estimated.`,
      });
      onCampaignCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Could not create the campaign', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const canAdvance = step === 1 ? !!bundle && !!name.trim() : offices.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" /> New gift campaign
          </DialogTitle>
        </DialogHeader>

        <StepIndicator step={step} labels={['Gift', 'Audience', 'Review']} />

        {bundle && offices.length > 0 && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 rounded-lg text-sm">
            <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-medium text-amber-700 dark:text-amber-400">
              ${totalCost} estimated — {offices.length} × ${bundle.estimatedCost}
            </span>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0 pr-4">
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="giftCampaignName">Campaign name *</Label>
                  <Input
                    id="giftCampaignName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Occasion</Label>
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {CAMPAIGN_TYPES.map((t) => (
                      <Badge
                        key={t.value}
                        variant={campaignType === t.value ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setCampaignType(t.value)}
                      >
                        {t.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Planned delivery date</Label>
                  <EnhancedDatePicker
                    value={plannedDate}
                    onChange={setPlannedDate}
                    placeholder="Select date"
                  />
                </div>
                <div>
                  <Label htmlFor="giftNotes">Notes</Label>
                  <Textarea
                    id="giftNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Internal notes…"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base font-semibold mb-3 block">Choose a gift bundle *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {GIFT_BUNDLES.map((option) => (
                    <Card
                      key={option.id}
                      onClick={() => setBundleId(option.id)}
                      className={`cursor-pointer transition-all ${
                        bundleId === option.id ? 'ring-2 ring-primary' : 'hover:shadow-md'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{option.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-semibold text-sm">{option.name}</h4>
                              <span className="font-bold text-primary">
                                ${option.estimatedCost}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {option.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              {option.items.join(' · ')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  The bundle contents become the packing checklist you tick off while assembling
                  the gifts.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <OfficePicker
              selected={offices}
              onChange={setOffices}
              requires="address"
              addToNetwork={addToNetwork}
              onAddToNetworkChange={setAddToNetwork}
              preSelectedGroupId={preSelectedDiscoveredGroupId}
            />
          )}

          {step === 3 && (
            <CampaignReview
              method="physical"
              name={name}
              typeLabel={CAMPAIGN_TYPES.find((t) => t.value === campaignType)?.label ?? campaignType}
              plannedDate={plannedDate}
              notes={notes}
              offices={offices}
              addToNetwork={addToNetwork}
              extras={[
                { label: 'Gift', value: `${bundle?.icon ?? ''} ${bundle?.name ?? '—'}` },
                {
                  label: 'Estimated cost',
                  value: <span className="text-primary">${totalCost}</span>,
                },
              ]}
              footnote="Track each hand-off from the campaign card once the gifts are assembled."
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
