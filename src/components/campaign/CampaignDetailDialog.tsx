import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Clock, Copy, ExternalLink, Loader2, MapPin, Package, Send,
  Sparkles, Trash2, TrendingUp, XCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { bundleCost, METHOD_META } from '@/lib/campaigns';
import { useCampaignActions, type Campaign } from '@/hooks/useCampaigns';
import { AttentionNote } from './AttentionNote';

interface DeliveryDetail {
  id: string;
  office_id: string;
  email_status: string | null;
  email_sent_at: string | null;
  email_copied_at: string | null;
  gift_status: string | null;
  delivered_at: string | null;
  referral_tier: string | null;
  delivery_notes: string | null;
  office: { name: string; address: string | null; email: string | null } | null;
}

interface CampaignDetailDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecute: () => void;
  onDelete: () => void;
}

/**
 * One detail view for all three campaign types.
 *
 * There used to be two — an email one and a gift one — and the page routed *letter*
 * campaigns to the gift dialog, which then read `gift_status` on rows that only ever
 * carry `email_status` and reported every letter as pending.
 */
export function CampaignDetailDialog({
  campaign,
  open,
  onOpenChange,
  onExecute,
  onDelete,
}: CampaignDetailDialogProps) {
  const { user } = useAuth();
  const meta = METHOD_META[campaign.method];
  const { setStatus, duplicate, saveOutcome } = useCampaignActions();

  const [referralsInput, setReferralsInput] = useState('');
  const [savingOutcome, setSavingOutcome] = useState(false);

  useEffect(() => {
    setReferralsInput(campaign.actual_referrals != null ? String(campaign.actual_referrals) : '');
  }, [campaign.id, campaign.actual_referrals]);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['campaign-deliveries', campaign.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_deliveries')
        .select(
          'id, office_id, email_status, email_sent_at, email_copied_at, gift_status, delivered_at, referral_tier, delivery_notes, office:patient_sources (name, address, email)',
        )
        .eq('campaign_id', campaign.id)
        .order('created_at');

      if (error) throw error;
      return (data ?? []) as unknown as DeliveryDetail[];
    },
  });

  const perGift = bundleCost(campaign.selected_gift_bundle);
  const cost =
    campaign.estimated_cost ?? (perGift ? perGift * campaign.stats.total : 0);
  const referrals = campaign.actual_referrals ?? 0;
  const costPerReferral = referrals > 0 && cost > 0 ? cost / referrals : null;

  const tierMix = useMemo(
    () => Object.entries(campaign.stats.tiers).sort((a, b) => b[1] - a[1]),
    [campaign.stats.tiers],
  );

  const handleSaveOutcome = async () => {
    const trimmed = referralsInput.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return;
    setSavingOutcome(true);
    await saveOutcome(campaign, parsed);
    setSavingOutcome(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-4">
        <DialogHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-md shrink-0 ${meta.chip}`}>
                <meta.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl leading-tight truncate">
                  {campaign.name}
                </DialogTitle>
                <DialogDescription>
                  {meta.label} · {campaign.campaign_type.replace(/_/g, ' ')} · created{' '}
                  {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                </DialogDescription>
              </div>
            </div>
            <Badge variant={campaign.statusLabel === 'Completed' ? 'default' : 'outline'}>
              {campaign.statusLabel}
            </Badge>
          </div>
        </DialogHeader>

        {campaign.attention && <AttentionNote attention={campaign.attention} />}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{campaign.progress.label}</span>
            <span className="font-medium tabular-nums">{campaign.progress.pct}%</span>
          </div>
          <Progress value={campaign.progress.pct} className="h-2" />
        </div>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          <div className="space-y-5">
            {/* Facts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Fact label="Offices" value={campaign.stats.total} />
              {campaign.method === 'physical' ? (
                <>
                  <Fact label="Delivered" value={campaign.stats.delivered} />
                  <Fact label="Failed" value={campaign.stats.failed} />
                  <Fact label="Estimated cost" value={cost ? `$${cost}` : '—'} />
                </>
              ) : (
                <>
                  <Fact label="Drafted" value={campaign.stats.drafted} />
                  <Fact label="Sent" value={campaign.stats.sent} />
                  <Fact
                    label={campaign.planned_delivery_date ? 'Scheduled' : 'Schedule'}
                    value={
                      campaign.planned_delivery_date
                        ? format(new Date(`${campaign.planned_delivery_date}T00:00:00`), 'MMM d')
                        : 'Not set'
                    }
                  />
                </>
              )}
            </div>

            {tierMix.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1.5">Audience</p>
                <div className="flex flex-wrap gap-1.5">
                  {tierMix.map(([tier, count]) => (
                    <Badge key={tier} variant="outline" className="text-xs">
                      {tier}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {campaign.selected_gift_bundle && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="font-medium text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  {campaign.selected_gift_bundle.name}
                  {perGift > 0 && (
                    <span className="text-muted-foreground font-normal">${perGift} per office</span>
                  )}
                </p>
                {campaign.selected_gift_bundle.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {campaign.selected_gift_bundle.description}
                  </p>
                )}
                {campaign.materials_checklist?.length ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    Packing list: {campaign.materials_checklist.join(' · ')}
                  </p>
                ) : null}
              </div>
            )}

            {campaign.notes && (
              <div>
                <p className="text-sm font-medium mb-1">Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {campaign.notes}
                </p>
              </div>
            )}

            <Separator />

            {/* Outcome */}
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" /> Result
              </p>
              <p className="text-xs text-muted-foreground">
                Record the referrals you credit to this campaign to see what the outreach was
                worth.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="actualReferrals" className="text-xs">
                    Referrals attributed
                  </Label>
                  <Input
                    id="actualReferrals"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={referralsInput}
                    onChange={(e) => setReferralsInput(e.target.value)}
                    className="h-9 w-32"
                    placeholder="0"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveOutcome}
                  disabled={savingOutcome}
                  className="h-9"
                >
                  {savingOutcome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </Button>
                {costPerReferral !== null && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      ${costPerReferral.toFixed(0)}
                    </span>{' '}
                    per referral
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Recipients */}
            <div>
              <p className="text-sm font-medium mb-2">Offices ({campaign.stats.total})</p>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg border-dashed">
                  No offices are attached to this campaign.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-lg border"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {delivery.office?.name ?? 'Office removed'}
                        </p>
                        {delivery.office?.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{delivery.office.address}</span>
                          </p>
                        )}
                        {delivery.delivery_notes && (
                          <p className="text-xs text-muted-foreground italic mt-1">
                            {delivery.delivery_notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {delivery.referral_tier && (
                          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                            {delivery.referral_tier}
                          </Badge>
                        )}
                        <DeliveryStatusBadge delivery={delivery} method={campaign.method} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Button onClick={onExecute} className="gap-2">
            <meta.icon className="w-4 h-4" /> {meta.action}
          </Button>
          {campaign.statusLabel !== 'Active' && (
            <Button variant="outline" size="sm" onClick={() => setStatus(campaign, 'Active')} className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> Set active
            </Button>
          )}
          {campaign.statusLabel !== 'Completed' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus(campaign, 'Completed')}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark completed
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => duplicate(campaign)} className="gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="gap-1.5 text-destructive hover:text-destructive ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}

function DeliveryStatusBadge({
  delivery,
  method,
}: {
  delivery: DeliveryDetail;
  method: Campaign['method'];
}) {
  if (method === 'physical') {
    if (delivery.gift_status === 'delivered') {
      return (
        <Badge className="text-xs gap-1 bg-success text-success-foreground hover:bg-success">
          <CheckCircle2 className="w-3 h-3" /> Delivered
        </Badge>
      );
    }
    if (delivery.gift_status === 'failed') {
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <XCircle className="w-3 h-3" /> Failed
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Clock className="w-3 h-3" /> Pending
      </Badge>
    );
  }

  if (delivery.email_status === 'sent') {
    return (
      <Badge className="text-xs gap-1 bg-success text-success-foreground hover:bg-success">
        <CheckCircle2 className="w-3 h-3" /> {method === 'letter' ? 'Printed' : 'Sent'}
      </Badge>
    );
  }
  if (delivery.email_status === 'ready') {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <Sparkles className="w-3 h-3" /> Drafted
      </Badge>
    );
  }
  if (delivery.email_copied_at) {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <ExternalLink className="w-3 h-3" /> Copied
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Clock className="w-3 h-3" /> Pending
    </Badge>
  );
}
