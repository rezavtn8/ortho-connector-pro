import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCheck, CheckCircle, Clock, Edit2, Loader2, MapPin, Package, RotateCcw, Save, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { nowISO } from '@/lib/dateSync';
import { bundleCost } from '@/lib/campaigns';

interface Campaign {
  id: string;
  name: string;
  materials_checklist?: string[] | null;
  selected_gift_bundle?: any;
}

interface CampaignDelivery {
  id: string;
  office_id: string;
  gift_status: string | null;
  delivered_at?: string | null;
  delivery_notes?: string | null;
  referral_tier?: string | null;
  office: { name: string; address?: string | null } | null;
}

interface GiftDeliveryDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
}

type GiftStatus = 'pending' | 'delivered' | 'failed';

/** The packing checklist is a physical, in-the-moment thing — keep it on the device. */
const checklistKey = (campaignId: string) => `nexora.packing.${campaignId}`;

export function GiftDeliveryDialog({
  campaign,
  open,
  onOpenChange,
  onCampaignUpdated,
}: GiftDeliveryDialogProps) {
  const { user } = useAuth();

  const [deliveries, setDeliveries] = useState<CampaignDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [packed, setPacked] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'status' | 'name' | 'tier'>('status');

  const checklist = useMemo(
    () => campaign.materials_checklist?.length
      ? campaign.materials_checklist
      : (campaign.selected_gift_bundle?.items as string[] | undefined) ?? [],
    [campaign.materials_checklist, campaign.selected_gift_bundle],
  );

  useEffect(() => {
    if (!open) return;
    fetchDeliveries();
    try {
      const stored = localStorage.getItem(checklistKey(campaign.id));
      setPacked(stored ? JSON.parse(stored) : {});
    } catch {
      setPacked({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign.id]);

  const togglePacked = (item: string, checked: boolean) => {
    const next = { ...packed, [item]: checked };
    setPacked(next);
    try {
      localStorage.setItem(checklistKey(campaign.id), JSON.stringify(next));
    } catch {
      /* private mode — the checklist just will not persist */
    }
  };

  const fetchDeliveries = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('campaign_deliveries')
      .select('id, office_id, gift_status, delivered_at, delivery_notes, referral_tier, office:patient_sources (name, address)')
      .eq('campaign_id', campaign.id)
      .eq('created_by', user.id)
      .order('created_at');

    if (error) {
      toast.error('Could not load deliveries', { description: error.message });
    } else {
      setDeliveries((data ?? []) as unknown as CampaignDelivery[]);
    }
    setLoading(false);
  };

  const sorted = useMemo(() => {
    const order: Record<string, number> = { pending: 0, failed: 1, delivered: 2 };
    const list = [...deliveries];
    if (sortBy === 'status') {
      list.sort(
        (a, b) =>
          (order[a.gift_status ?? 'pending'] ?? 0) - (order[b.gift_status ?? 'pending'] ?? 0) ||
          (a.office?.name ?? '').localeCompare(b.office?.name ?? ''),
      );
    } else if (sortBy === 'tier') {
      const tierOrder = ['VIP', 'Warm', 'Cold', 'Dormant'];
      list.sort(
        (a, b) =>
          tierOrder.indexOf(a.referral_tier ?? 'Cold') - tierOrder.indexOf(b.referral_tier ?? 'Cold'),
      );
    } else {
      list.sort((a, b) => (a.office?.name ?? '').localeCompare(b.office?.name ?? ''));
    }
    return list;
  }, [deliveries, sortBy]);

  const delivered = deliveries.filter((d) => d.gift_status === 'delivered').length;
  const pending = deliveries.filter((d) => (d.gift_status ?? 'pending') === 'pending').length;
  const failed = deliveries.filter((d) => d.gift_status === 'failed').length;
  const progress = deliveries.length ? Math.round((delivered / deliveries.length) * 100) : 0;
  const perGift = bundleCost(campaign.selected_gift_bundle);

  const updateStatus = async (ids: string[], status: GiftStatus) => {
    if (ids.length === 0) return;
    setBusy(true);
    const { error } = await supabase
      .from('campaign_deliveries')
      .update({
        gift_status: status,
        delivered_at: status === 'delivered' ? nowISO() : null,
      })
      .in('id', ids);
    setBusy(false);

    if (error) {
      toast.error('Could not update those deliveries', { description: error.message });
      return;
    }
    toast.success(ids.length === 1 ? `Marked ${status}` : `${ids.length} marked ${status}`);
    await fetchDeliveries();
    onCampaignUpdated();
  };

  const saveNotes = async (deliveryId: string) => {
    const { error } = await supabase
      .from('campaign_deliveries')
      .update({ delivery_notes: noteText })
      .eq('id', deliveryId);

    if (error) {
      toast.error('Could not save the note', { description: error.message });
      return;
    }
    setEditingNotes(null);
    setNoteText('');
    toast.success('Note saved');
    fetchDeliveries();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            {campaign.name}
          </DialogTitle>
          <DialogDescription>
            Tick items off as you pack, then log each hand-off.
            {perGift > 0 && ` $${perGift} per gift · $${perGift * deliveries.length} total.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {delivered} of {deliveries.length} delivered
            </span>
            <span className="font-medium tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-success">
                <CheckCircle className="w-3.5 h-3.5" /> {delivered}
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Clock className="w-3.5 h-3.5" /> {pending}
              </span>
              {failed > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="w-3.5 h-3.5" /> {failed}
                </span>
              )}
            </div>

            <div className="flex gap-2 ml-auto">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">By status</SelectItem>
                  <SelectItem value="tier">By tier</SelectItem>
                  <SelectItem value="name">By name</SelectItem>
                </SelectContent>
              </Select>
              {pending > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className="gap-1.5 h-8 text-xs"
                  onClick={() =>
                    updateStatus(
                      deliveries
                        .filter((d) => (d.gift_status ?? 'pending') === 'pending')
                        .map((d) => d.id),
                      'delivered',
                    )
                  }
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  Mark all delivered
                </Button>
              )}
            </div>
          </div>
        </div>

        {checklist.length > 0 && (
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-3">
              <p className="text-sm font-medium mb-2">Packing list</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {checklist.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={!!packed[item]}
                      onCheckedChange={(c) => togglePacked(item, c === true)}
                    />
                    <span className={packed[item] ? 'line-through text-muted-foreground' : ''}>
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : deliveries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No offices are attached to this campaign.
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map((delivery) => {
                const status = (delivery.gift_status ?? 'pending') as GiftStatus;
                return (
                  <Card key={delivery.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {status === 'delivered' ? (
                          <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                        ) : status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-medium text-sm truncate">
                              {delivery.office?.name ?? 'Office removed'}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {delivery.referral_tier && (
                                <Badge variant="outline" className="text-xs">
                                  {delivery.referral_tier}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs capitalize">
                                {status}
                              </Badge>
                            </div>
                          </div>

                          {delivery.office?.address && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{delivery.office.address}</span>
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 mt-2">
                            {status === 'pending' ? (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  disabled={busy}
                                  onClick={() => updateStatus([delivery.id], 'delivered')}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Delivered
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  disabled={busy}
                                  onClick={() => updateStatus([delivery.id], 'failed')}
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Could not deliver
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1 text-muted-foreground"
                                disabled={busy}
                                onClick={() => updateStatus([delivery.id], 'pending')}
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Undo
                              </Button>
                            )}
                          </div>

                          {editingNotes === delivery.id ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Who received it, what was said…"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => saveNotes(delivery.id)}
                                >
                                  <Save className="w-3.5 h-3.5" /> Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => setEditingNotes(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 mt-1.5">
                              <p className="text-xs text-muted-foreground italic flex-1 truncate">
                                {delivery.delivery_notes || 'No notes'}
                              </p>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0"
                                aria-label="Edit delivery note"
                                onClick={() => {
                                  setEditingNotes(delivery.id);
                                  setNoteText(delivery.delivery_notes ?? '');
                                }}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
