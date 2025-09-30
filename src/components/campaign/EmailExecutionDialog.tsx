import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Mail, 
  Copy, 
  ExternalLink, 
  CheckCircle, 
  Clock, 
  Wand2,
  RefreshCw,
  Sparkles
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
  };
}

interface EmailExecutionDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
}

export function EmailExecutionDialog({ 
  campaign, 
  open, 
  onOpenChange, 
  onCampaignUpdated 
}: EmailExecutionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [deliveries, setDeliveries] = useState<CampaignDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingEmails, setGeneratingEmails] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  useEffect(() => {
    if (open && campaign) {
      fetchDeliveries();
    }
  }, [open, campaign]);

  const fetchDeliveries = async () => {
    if (!campaign || !user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaign_deliveries')
        .select(`
          *,
          office:patient_sources (
            name,
            address,
            source_type
          )
        `)
        .eq('campaign_id', campaign.id)
        .eq('created_by', user.id)
        .order('created_at');

      if (error) throw error;
      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      toast({
        title: "Error",
        description: "Failed to load campaign deliveries.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateEmails = async () => {
    if (!campaign || !user) return;

    try {
      setGeneratingEmails(true);

      if (!deliveries || deliveries.length === 0) {
        toast({
          title: "No Offices Selected",
          description: "Please select at least one office for the campaign.",
          variant: "destructive",
        });
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const officesData = deliveries.map(delivery => ({
        id: delivery.office_id,
        name: delivery.office.name,
        address: delivery.office.address || '',
        source_type: delivery.office.source_type || 'Office',
        referral_tier: delivery.referral_tier || 'New Contact'
      }));

      const { data, error } = await supabase.functions.invoke('generate-campaign-emails', {
        body: {
          offices: officesData,
          campaign_name: campaign.name,
          user_name: profile ? `${profile.first_name} ${profile.last_name}` : undefined,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate emails');

      const emailUpdates = data.emails.map((email: any) => ({
        id: deliveries.find(d => d.office_id === email.office_id)?.id,
        email_subject: email.subject,
        email_body: email.body,
        email_status: 'ready'
      })).filter((update: any) => update.id);

      for (const update of emailUpdates) {
        await supabase
          .from('campaign_deliveries')
          .update({
            email_subject: update.email_subject,
            email_body: update.email_body,
            email_status: update.email_status
          })
          .eq('id', update.id);
      }

      await fetchDeliveries();

      toast({
        title: "Success",
        description: `Generated ${data.emails.length} personalized emails`,
      });

    } catch (error) {
      console.error('Error generating emails:', error);
      toast({
        title: "Email Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate emails",
        variant: "destructive",
      });
    } finally {
      setGeneratingEmails(false);
    }
  };

  const copyEmailContent = async (delivery: CampaignDelivery) => {
    if (!delivery.email_body) return;

    try {
      await navigator.clipboard.writeText(delivery.email_body);
      
      await supabase
        .from('campaign_deliveries')
        .update({ email_copied_at: nowISO() })
        .eq('id', delivery.id);

      toast({
        title: "Copied",
        description: "Email content copied to clipboard",
      });

      fetchDeliveries();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy email content",
        variant: "destructive",
      });
    }
  };

  const openInEmail = (delivery: CampaignDelivery) => {
    if (!delivery.email_subject || !delivery.email_body) return;

    const subject = encodeURIComponent(delivery.email_subject);
    const body = encodeURIComponent(delivery.email_body);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const markAsSent = async (deliveryId: string) => {
    try {
      await supabase
        .from('campaign_deliveries')
        .update({ 
          email_status: 'sent',
          email_sent_at: nowISO()
        })
        .eq('id', deliveryId);

      toast({
        title: "Success",
        description: "Email marked as sent",
      });

      fetchDeliveries();
      onCampaignUpdated();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const startEditing = (delivery: CampaignDelivery) => {
    setEditingEmail(delivery.id);
    setEditedSubject(delivery.email_subject || '');
    setEditedBody(delivery.email_body || '');
  };

  const saveEdit = async (deliveryId: string) => {
    try {
      await supabase
        .from('campaign_deliveries')
        .update({
          email_subject: editedSubject,
          email_body: editedBody
        })
        .eq('id', deliveryId);

      setEditingEmail(null);
      fetchDeliveries();

      toast({
        title: "Success",
        description: "Email updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update email",
        variant: "destructive",
      });
    }
  };

  const emailsGenerated = deliveries.some(d => d.email_body);
  const sentCount = deliveries.filter(d => d.email_status === 'sent').length;

  // Auto-generate emails on first open if not already generated
  useEffect(() => {
    if (open && deliveries.length > 0 && !loading && !emailsGenerated && !generatingEmails) {
      console.log('Auto-generating emails on dialog open...');
      generateEmails();
    }
  }, [open, deliveries, loading, emailsGenerated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              {campaign.name} - Email Generation
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary">
              {sentCount}/{deliveries.length} Sent
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Generate AI-powered emails and manage sending to {deliveries.length} offices
          </DialogDescription>
        </DialogHeader>

        {/* Status Bar */}
        {generatingEmails && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <div>
                  <h3 className="font-semibold text-lg">Generating AI Emails...</h3>
                  <p className="text-sm text-muted-foreground">
                    Creating personalized emails for {deliveries.length} offices using your complete practice data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {emailsGenerated && !generatingEmails && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-lg text-green-900">Emails Ready!</h3>
                    <p className="text-sm text-green-700">
                      {deliveries.length} personalized emails generated. Review and send to offices.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={generateEmails}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate All
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Office Email Cards */}
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : deliveries.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Mail className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Offices Selected</h3>
              <p className="text-muted-foreground">This campaign doesn't have any offices selected yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {deliveries.map((delivery) => (
              <Card key={delivery.id} className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{delivery.office.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{delivery.office.address}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">{delivery.office.source_type}</Badge>
                        {delivery.email_status === 'sent' && (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Sent
                          </Badge>
                        )}
                        {delivery.email_body && delivery.email_status !== 'sent' && (
                          <Badge className="bg-blue-100 text-blue-700">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Ready to Send
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-4">
                  {editingEmail === delivery.id ? (
                    <div className="space-y-3">
                      <div>
                        <Label>Subject</Label>
                        <Textarea
                          value={editedSubject}
                          onChange={(e) => setEditedSubject(e.target.value)}
                          rows={1}
                          className="resize-none"
                        />
                      </div>
                      <div>
                        <Label>Body</Label>
                        <Textarea
                          value={editedBody}
                          onChange={(e) => setEditedBody(e.target.value)}
                          rows={8}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(delivery.id)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingEmail(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : delivery.email_body ? (
                    <div className="space-y-3">
                       <div className="bg-muted/50 p-3 rounded-md">
                         <Label className="text-xs text-muted-foreground">Subject</Label>
                         <p className="text-sm font-medium mt-1">{delivery.email_subject}</p>
                       </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Body Preview</Label>
                        <p className="text-sm whitespace-pre-wrap line-clamp-3">{delivery.email_body}</p>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => startEditing(delivery)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyEmailContent(delivery)}>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openInEmail(delivery)}>
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Open in Email
                        </Button>
                        {delivery.email_status !== 'sent' && (
                          <Button size="sm" onClick={() => markAsSent(delivery.id)}>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Mark as Sent
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Clock className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Email not generated yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
