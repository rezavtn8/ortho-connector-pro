import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Mail, Copy, ExternalLink, CheckCircle, Clock, RefreshCw, Sparkles,
  ChevronDown, ChevronUp, Wand2, CheckCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  email_subject?: string;
  email_body?: string;
  email_status: string;
  email_copied_at?: string;
  email_sent_at?: string;
  referral_tier?: string;
  office: {
    name: string;
    address?: string;
    source_type: string;
    email?: string;
  };
}

interface EmailExecutionDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
}

export function EmailExecutionDialog({ campaign, open, onOpenChange, onCampaignUpdated }: EmailExecutionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [deliveries, setDeliveries] = useState<CampaignDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingEmails, setGeneratingEmails] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && campaign) fetchDeliveries();
  }, [open, campaign]);

  const fetchDeliveries = async () => {
    if (!campaign || !user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaign_deliveries')
        .select(`*, office:patient_sources (name, address, source_type, email)`)
        .eq('campaign_id', campaign.id)
        .eq('created_by', user.id)
        .order('created_at');
      if (error) throw error;
      setDeliveries(data || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load deliveries.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateEmails = async () => {
    if (!campaign || !user || !deliveries.length) return;
    try {
      setGeneratingEmails(true);
      const { data: profile } = await supabase.from('user_profiles').select('first_name, last_name').eq('user_id', user.id).maybeSingle();
      const officesData = deliveries.map(d => ({
        id: d.office_id, name: d.office.name, address: d.office.address || '',
        source_type: d.office.source_type || 'Office', referral_tier: d.referral_tier || 'New Contact'
      }));

      const { data, error } = await supabase.functions.invoke('generate-campaign-emails', {
        body: { offices: officesData, campaign_name: campaign.name, user_name: profile ? `${profile.first_name} ${profile.last_name}` : undefined }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed');

      for (const email of data.emails) {
        const delivery = deliveries.find(d => d.office_id === email.office_id);
        if (delivery) {
          await supabase.from('campaign_deliveries').update({ email_subject: email.subject, email_body: email.body, email_status: 'ready' }).eq('id', delivery.id);
        }
      }
      await fetchDeliveries();
      toast({ title: "Success", description: `Generated ${data.emails.length} emails` });
    } catch (error) {
      toast({ title: "Generation Failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setGeneratingEmails(false);
    }
  };

  const copyEmailContent = async (delivery: CampaignDelivery) => {
    if (!delivery.email_body) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${delivery.email_subject}\n\n${delivery.email_body}`);
      await supabase.from('campaign_deliveries').update({ email_copied_at: nowISO() }).eq('id', delivery.id);
      toast({ title: "Copied", description: "Email copied to clipboard" });
      fetchDeliveries();
    } catch {
      toast({ title: "Error", description: "Failed to copy", variant: "destructive" });
    }
  };

  const openInEmail = (delivery: CampaignDelivery) => {
    if (!delivery.email_subject || !delivery.email_body) return;
    const to = delivery.office.email ? encodeURIComponent(delivery.office.email) : '';
    const subject = encodeURIComponent(delivery.email_subject);
    const body = encodeURIComponent(delivery.email_body);
    window.open(`mailto:${to}?subject=${subject}&body=${body}`);
  };

  const markAsSent = async (deliveryId: string) => {
    await supabase.from('campaign_deliveries').update({ email_status: 'sent', email_sent_at: nowISO() }).eq('id', deliveryId);
    toast({ title: "Marked as Sent" });
    fetchDeliveries();
    onCampaignUpdated();
  };

  const markAllAsSent = async () => {
    const unsent = deliveries.filter(d => d.email_body && d.email_status !== 'sent');
    for (const d of unsent) {
      await supabase.from('campaign_deliveries').update({ email_status: 'sent', email_sent_at: nowISO() }).eq('id', d.id);
    }
    toast({ title: "All Marked as Sent", description: `${unsent.length} emails marked` });
    fetchDeliveries();
    onCampaignUpdated();
  };

  const saveEdit = async (deliveryId: string) => {
    await supabase.from('campaign_deliveries').update({ email_subject: editedSubject, email_body: editedBody }).eq('id', deliveryId);
    setEditingEmail(null);
    fetchDeliveries();
    toast({ title: "Email Updated" });
  };

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const emailsGenerated = deliveries.some(d => d.email_body);
  const sentCount = deliveries.filter(d => d.email_status === 'sent').length;
  const readyCount = deliveries.filter(d => d.email_body && d.email_status !== 'sent').length;
  const progress = deliveries.length ? Math.round((sentCount / deliveries.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            {campaign.name} - Email Execution
          </DialogTitle>
          <DialogDescription>
            Generate AI-powered emails and manage sending to {deliveries.length} offices
          </DialogDescription>
        </DialogHeader>

        {/* Progress + Actions Bar */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{sentCount}/{deliveries.length} sent</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex flex-wrap gap-2">
            {!emailsGenerated ? (
              <Button onClick={generateEmails} disabled={generatingEmails || !deliveries.length} className="gap-2">
                <Wand2 className="w-4 h-4" /> {generatingEmails ? 'Generating...' : 'Generate All Emails'}
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={generateEmails} disabled={generatingEmails} className="gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingEmails ? 'animate-spin' : ''}`} /> Regenerate
                </Button>
                {readyCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllAsSent} className="gap-1.5">
                    <CheckCheck className="w-3.5 h-3.5" /> Mark All as Sent ({readyCount})
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Email Cards */}
        {(loading || generatingEmails) ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{generatingEmails ? 'Generating personalized emails...' : 'Loading...'}</p>
          </div>
        ) : deliveries.length === 0 ? (
          <Card><CardContent className="text-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No offices selected</h3>
            <p className="text-sm text-muted-foreground">This campaign has no offices.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {deliveries.map((delivery) => (
              <Collapsible key={delivery.id} open={expandedCards.has(delivery.id)} onOpenChange={() => toggleCard(delivery.id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="min-w-0">
                            <CardTitle className="text-sm truncate">{delivery.office.name}</CardTitle>
                            {delivery.email_subject && <p className="text-xs text-muted-foreground truncate mt-0.5">{delivery.email_subject}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {delivery.email_status === 'sent' ? (
                            <Badge variant="default" className="bg-green-600 text-xs gap-1"><CheckCircle className="w-3 h-3" /> Sent</Badge>
                          ) : delivery.email_body ? (
                            <Badge variant="secondary" className="text-xs gap-1"><Sparkles className="w-3 h-3" /> Ready</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1"><Clock className="w-3 h-3" /> Pending</Badge>
                          )}
                          {expandedCards.has(delivery.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-3">
                      {editingEmail === delivery.id ? (
                        <div className="space-y-3">
                          <div><Label>Subject</Label><Textarea value={editedSubject} onChange={(e) => setEditedSubject(e.target.value)} rows={1} className="resize-none" /></div>
                          <div><Label>Body</Label><Textarea value={editedBody} onChange={(e) => setEditedBody(e.target.value)} rows={6} /></div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(delivery.id)}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingEmail(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : delivery.email_body ? (
                        <div className="space-y-3">
                          <div className="bg-muted/50 p-3 rounded-md">
                            <Label className="text-xs text-muted-foreground">Subject</Label>
                            <p className="text-sm font-medium mt-0.5">{delivery.email_subject}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Body</Label>
                            <p className="text-sm whitespace-pre-wrap mt-0.5">{delivery.email_body}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2 border-t">
                            <Button size="sm" variant="outline" onClick={() => { setEditingEmail(delivery.id); setEditedSubject(delivery.email_subject || ''); setEditedBody(delivery.email_body || ''); }}>Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => copyEmailContent(delivery)} className="gap-1"><Copy className="w-3.5 h-3.5" /> Copy</Button>
                            <Button size="sm" variant="outline" onClick={() => openInEmail(delivery)} className="gap-1"><ExternalLink className="w-3.5 h-3.5" /> {delivery.office.email ? 'Send Email' : 'Open in Email'}</Button>
                            {delivery.email_status !== 'sent' && (
                              <Button size="sm" onClick={() => markAsSent(delivery.id)} className="gap-1 ml-auto"><CheckCircle className="w-3.5 h-3.5" /> Mark Sent</Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <Clock className="w-6 h-6 mx-auto mb-1" />
                          <p className="text-sm">Click "Generate All Emails" above</p>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
