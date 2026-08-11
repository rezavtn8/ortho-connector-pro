import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle, CheckCheck, CheckCircle, ChevronDown, ChevronUp, Clock, Copy,
  ExternalLink, Mail, RefreshCw, Sparkles, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { nowISO } from '@/lib/dateSync';

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
}

interface CampaignDelivery {
  id: string;
  office_id: string;
  email_subject?: string | null;
  email_body?: string | null;
  email_status: string | null;
  email_copied_at?: string | null;
  email_sent_at?: string | null;
  referral_tier?: string | null;
  office: {
    name: string;
    address?: string | null;
    source_type?: string | null;
    email?: string | null;
  } | null;
}

interface EmailExecutionDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
}

/**
 * Offices per call to `generate-campaign-emails`.
 *
 * That function loops the offices *sequentially*, one AI request each, so a 40-office
 * campaign in a single call ran for minutes and hit the edge-function wall clock —
 * losing every draft, including the ones already written. Small batches keep each
 * request short, persist as they land, and turn a failure into a retry of five.
 */
const BATCH_SIZE = 5;

type Filter = 'all' | 'pending' | 'ready' | 'sent';

export function EmailExecutionDialog({
  campaign,
  open,
  onOpenChange,
  onCampaignUpdated,
}: EmailExecutionDialogProps) {
  const { user } = useAuth();

  const [deliveries, setDeliveries] = useState<CampaignDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [generateTarget, setGenerateTarget] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (open && campaign) fetchDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign.id]);

  const fetchDeliveries = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('campaign_deliveries')
      .select('*, office:patient_sources (name, address, source_type, email)')
      .eq('campaign_id', campaign.id)
      .eq('created_by', user.id)
      .order('created_at');

    if (error) {
      toast.error('Could not load this campaign', { description: error.message });
    } else {
      setDeliveries((data ?? []) as unknown as CampaignDelivery[]);
    }
    setLoading(false);
  };

  const sentCount = deliveries.filter((d) => d.email_status === 'sent').length;
  const readyCount = deliveries.filter((d) => d.email_body && d.email_status !== 'sent').length;
  const pendingCount = deliveries.filter((d) => !d.email_body).length;
  const missingAddress = deliveries.filter((d) => !d.office?.email).length;
  const progress = deliveries.length ? Math.round((sentCount / deliveries.length) * 100) : 0;
  const anyDrafted = deliveries.some((d) => d.email_body);

  const visible = useMemo(() => {
    switch (filter) {
      case 'pending':
        return deliveries.filter((d) => !d.email_body);
      case 'ready':
        return deliveries.filter((d) => d.email_body && d.email_status !== 'sent');
      case 'sent':
        return deliveries.filter((d) => d.email_status === 'sent');
      default:
        return deliveries;
    }
  }, [deliveries, filter]);

  /** @param only when set, redraft just these deliveries (used for "draft the rest"). */
  const generate = async (only?: CampaignDelivery[]) => {
    const targets = only ?? deliveries;
    if (!user || targets.length === 0) return;

    setGenerating(true);
    setGeneratedCount(0);
    setGenerateTarget(targets.length);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const userName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : undefined;

    let written = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      try {
        const { data, error } = await supabase.functions.invoke('generate-campaign-emails', {
          body: {
            offices: batch.map((d) => ({
              id: d.office_id,
              name: d.office?.name ?? 'Office',
              address: d.office?.address ?? '',
              source_type: d.office?.source_type ?? 'Office',
              referral_tier: d.referral_tier ?? 'New Contact',
            })),
            campaign_name: campaign.name,
            user_name: userName || undefined,
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'The AI service returned no drafts');

        // Persist the batch in parallel — one round trip per office, five at a time,
        // instead of the old strictly sequential write for every office in the campaign.
        await Promise.all(
          (data.emails as any[]).map((email) => {
            const delivery = batch.find((d) => d.office_id === email.office_id);
            if (!delivery) return Promise.resolve();
            written++;
            return supabase
              .from('campaign_deliveries')
              .update({
                email_subject: email.subject,
                email_body: email.body,
                email_status: 'ready',
              })
              .eq('id', delivery.id);
          }),
        );
      } catch (err: any) {
        failed += batch.length;
        console.error('Email batch failed', err);
      }

      setGeneratedCount(Math.min(i + BATCH_SIZE, targets.length));
    }

    await fetchDeliveries();
    onCampaignUpdated();
    setGenerating(false);

    if (written > 0 && failed === 0) {
      toast.success(`Drafted ${written} email${written === 1 ? '' : 's'}`);
    } else if (written > 0) {
      toast.warning(`Drafted ${written}, ${failed} failed`, {
        description: 'Use "Draft the rest" to retry the ones that did not come back.',
      });
    } else {
      toast.error('No drafts were generated', { description: 'Check your AI settings and retry.' });
    }
  };

  const copyEmail = async (delivery: CampaignDelivery) => {
    if (!delivery.email_body) return;
    try {
      await navigator.clipboard.writeText(
        `Subject: ${delivery.email_subject ?? ''}\n\n${delivery.email_body}`,
      );
    } catch {
      toast.error('Your browser blocked clipboard access');
      return;
    }
    await supabase
      .from('campaign_deliveries')
      .update({ email_copied_at: nowISO() })
      .eq('id', delivery.id);
    toast.success('Copied to clipboard');
    fetchDeliveries();
  };

  const openInMailClient = (delivery: CampaignDelivery) => {
    if (!delivery.email_body) return;
    const to = delivery.office?.email ? encodeURIComponent(delivery.office.email) : '';
    const subject = encodeURIComponent(delivery.email_subject ?? '');
    const body = encodeURIComponent(delivery.email_body);
    window.open(`mailto:${to}?subject=${subject}&body=${body}`);
  };

  const markSent = async (ids: string[]) => {
    if (ids.length === 0) return;
    // One statement for the whole selection; this used to be a sequential loop that
    // issued a separate request per office and reported success either way.
    const { error } = await supabase
      .from('campaign_deliveries')
      .update({ email_status: 'sent', email_sent_at: nowISO() })
      .in('id', ids);

    if (error) {
      toast.error('Could not update those emails', { description: error.message });
      return;
    }
    toast.success(ids.length === 1 ? 'Marked as sent' : `${ids.length} marked as sent`);
    await fetchDeliveries();
    onCampaignUpdated();
  };

  const saveEdit = async (deliveryId: string) => {
    const { error } = await supabase
      .from('campaign_deliveries')
      .update({ email_subject: editedSubject, email_body: editedBody })
      .eq('id', deliveryId);

    if (error) {
      toast.error('Could not save your edit', { description: error.message });
      return;
    }
    setEditingId(null);
    toast.success('Email updated');
    fetchDeliveries();
  };

  const toggleCard = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            {campaign.name}
          </DialogTitle>
          <DialogDescription>
            Draft, review and send one personalised email per office.
          </DialogDescription>
        </DialogHeader>

        {/* Progress + actions */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {sentCount} of {deliveries.length} sent
            </span>
            <span className="font-medium tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />

          {generating && (
            <p className="text-xs text-muted-foreground">
              Drafting {Math.min(generatedCount, generateTarget)} of {generateTarget} — you can
              leave this open, drafts save as they finish.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {!anyDrafted ? (
              <Button
                onClick={() => generate()}
                disabled={generating || !deliveries.length}
                className="gap-2"
              >
                <Wand2 className="w-4 h-4" />
                {generating ? 'Drafting…' : `Draft ${deliveries.length} emails`}
              </Button>
            ) : (
              <>
                {pendingCount > 0 && (
                  <Button
                    onClick={() => generate(deliveries.filter((d) => !d.email_body))}
                    disabled={generating}
                    className="gap-1.5"
                    size="sm"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Draft the rest ({pendingCount})
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generate()}
                  disabled={generating}
                  className="gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  Redraft all
                </Button>
                {readyCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      markSent(
                        deliveries
                          .filter((d) => d.email_body && d.email_status !== 'sent')
                          .map((d) => d.id),
                      )
                    }
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark {readyCount} as sent
                  </Button>
                )}
              </>
            )}

            <div className="flex gap-1 ml-auto">
              {(['all', 'pending', 'ready', 'sent'] as Filter[]).map((key) => {
                const count =
                  key === 'all'
                    ? deliveries.length
                    : key === 'pending'
                      ? pendingCount
                      : key === 'ready'
                        ? readyCount
                        : sentCount;
                return (
                  <Badge
                    key={key}
                    variant={filter === key ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => setFilter(key)}
                  >
                    {key} ({count})
                  </Badge>
                );
              })}
            </div>
          </div>

          {missingAddress > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
              {missingAddress} office{missingAddress === 1 ? ' has' : 's have'} no email on file —
              copy those drafts and address them by hand.
            </p>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          ) : deliveries.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No offices on this campaign</h3>
                <p className="text-sm text-muted-foreground">
                  Duplicate it and pick offices, or delete it from the campaign list.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {visible.map((delivery) => (
                <Collapsible
                  key={delivery.id}
                  open={expanded.has(delivery.id)}
                  onOpenChange={() => toggleCard(delivery.id)}
                >
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-sm truncate">
                              {delivery.office?.name ?? 'Office removed'}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {delivery.email_subject ||
                                delivery.office?.email ||
                                'No email address on file'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {delivery.email_status === 'sent' ? (
                              <Badge className="text-xs gap-1 bg-success text-success-foreground hover:bg-success">
                                <CheckCircle className="w-3 h-3" /> Sent
                              </Badge>
                            ) : delivery.email_body ? (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Sparkles className="w-3 h-3" /> Drafted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Clock className="w-3 h-3" /> Pending
                              </Badge>
                            )}
                            {expanded.has(delivery.id) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-3">
                        {editingId === delivery.id ? (
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">Subject</Label>
                              <Input
                                value={editedSubject}
                                onChange={(e) => setEditedSubject(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Body</Label>
                              <Textarea
                                value={editedBody}
                                onChange={(e) => setEditedBody(e.target.value)}
                                rows={10}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveEdit(delivery.id)}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : delivery.email_body ? (
                          <div className="space-y-3">
                            <div className="bg-muted/50 p-3 rounded-md">
                              <Label className="text-xs text-muted-foreground">Subject</Label>
                              <p className="text-sm font-medium mt-0.5">
                                {delivery.email_subject}
                              </p>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{delivery.email_body}</p>
                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(delivery.id);
                                  setEditedSubject(delivery.email_subject ?? '');
                                  setEditedBody(delivery.email_body ?? '');
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyEmail(delivery)}
                                className="gap-1"
                              >
                                <Copy className="w-3.5 h-3.5" /> Copy
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openInMailClient(delivery)}
                                className="gap-1"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                {delivery.office?.email ? 'Open in mail app' : 'Compose'}
                              </Button>
                              {delivery.email_status !== 'sent' && (
                                <Button
                                  size="sm"
                                  onClick={() => markSent([delivery.id])}
                                  className="gap-1 ml-auto"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Mark sent
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            <Clock className="w-6 h-6 mx-auto mb-1" />
                            <p className="text-sm">Not drafted yet.</p>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}

              {visible.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-10">
                  Nothing in this filter.
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
