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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Mail, 
  Gift, 
  Copy, 
  ExternalLink, 
  CheckCircle, 
  Clock, 
  Wand2,
  RefreshCw,
  Crown,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  selected_gift_bundle?: any;
  status: string;
}

interface CampaignDelivery {
  id: string;
  office_id: string;
  email_subject?: string;
  email_body?: string;
  email_status: string;
  gift_status: string;
  action_mode: string;
  email_copied_at?: string;
  email_sent_at?: string;
  referral_tier?: string;
  office: {
    name: string;
    address?: string;
    source_type: string;
  };
}

interface CampaignExecutionDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
}

export function CampaignExecutionDialog({ 
  campaign, 
  open, 
  onOpenChange, 
  onCampaignUpdated 
}: CampaignExecutionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [deliveries, setDeliveries] = useState<CampaignDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingEmails, setGeneratingEmails] = useState(false);

  useEffect(() => {
    if (open && campaign) {
      fetchDeliveries();
    }
  }, [open, campaign]);

  const fetchDeliveries = async () => {
    if (!campaign || !user) {
      console.log('Missing campaign or user:', { campaign: !!campaign, user: !!user });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching deliveries for campaign:', campaign.id);
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

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Deliveries fetched:', data?.length || 0);
      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      toast({
        title: "Error",
        description: "Failed to load campaign deliveries.",
        variant: "destructive",
      });
      setDeliveries([]); // Ensure empty array on error
    } finally {
      setLoading(false);
    }
  };

  const generateEmails = async () => {
    if (!campaign || !user) return;

    try {
      setGeneratingEmails(true);

      // Validate we have deliveries with office data
      if (!deliveries || deliveries.length === 0) {
        toast({
          title: "No Offices Selected",
          description: "Please select at least one office for the campaign before generating emails.",
          variant: "destructive",
        });
        return;
      }

      // Check that all deliveries have office data
      const invalidDeliveries = deliveries.filter(d => !d.office || !d.office.name);
      if (invalidDeliveries.length > 0) {
        toast({
          title: "Missing Office Data",
          description: "Some selected offices are missing required information. Please refresh and try again.",
          variant: "destructive",
        });
        return;
      }

      // Get user profile for personalization
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      // Prepare offices data for email generation
      const officesData = deliveries.map(delivery => ({
        id: delivery.office_id,
        name: delivery.office.name,
        address: delivery.office.address || '',
        source_type: delivery.office.source_type || 'Office',
        referral_tier: delivery.referral_tier || 'New Contact'
      }));

      console.log('Generating emails for offices:', officesData);

      // Call edge function to generate emails
      const { data, error } = await supabase.functions.invoke('generate-campaign-emails', {
        body: {
          offices: officesData,
          gift_bundle: campaign.selected_gift_bundle,
          campaign_name: campaign.name,
          user_name: profile ? `${profile.first_name} ${profile.last_name}` : undefined,
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate emails');
      }

      // Update deliveries with generated emails
      const emailUpdates = data.emails.map((email: any) => ({
        id: deliveries.find(d => d.office_id === email.office_id)?.id,
        email_subject: email.subject,
        email_body: email.body,
        email_status: 'ready'
      })).filter((update: any) => update.id);

      for (const update of emailUpdates) {
        const { error: updateError } = await supabase
          .from('campaign_deliveries')
          .update({
            email_subject: update.email_subject,
            email_body: update.email_body,
            email_status: update.email_status
          })
          .eq('id', update.id);

        if (updateError) {
          console.error('Error updating delivery:', updateError);
        }
      }

      // Refresh deliveries data
      await fetchDeliveries();

      toast({
        title: "Success",
        description: `Generated ${data.emails.length} personalized emails`,
      });

    } catch (error) {
      console.error('Error generating emails:', error);
      
      let errorMessage = "Failed to generate emails";
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("non-2xx status code")) {
          errorMessage = "Email service is temporarily unavailable. Please try again in a moment.";
        } else if (error.message.includes("At least one office is required")) {
          errorMessage = "No offices selected for email generation. Please select offices first.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Email Generation Failed",
        description: errorMessage,
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
      
      // Update copied timestamp
      await supabase
        .from('campaign_deliveries')
        .update({ email_copied_at: new Date().toISOString() })
        .eq('id', delivery.id);

      toast({
        title: "Copied",
        description: "Email content copied to clipboard",
      });

      // Refresh data
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
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    
    window.open(mailtoUrl);
  };

  const updateDeliveryStatus = async (deliveryId: string, field: string, value: string) => {
    try {
      const updateData: any = { [field]: value };
      
      if (field === 'email_status' && value === 'sent') {
        updateData.email_sent_at = new Date().toISOString();
      }

      await supabase
        .from('campaign_deliveries')
        .update(updateData)
        .eq('id', deliveryId);

      fetchDeliveries();
    } catch (error) {
      console.error('Error updating delivery status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const updateActionMode = async (deliveryId: string, mode: string) => {
    try {
      await supabase
        .from('campaign_deliveries')
        .update({ action_mode: mode })
        .eq('id', deliveryId);

      fetchDeliveries();
    } catch (error) {
      console.error('Error updating action mode:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-blue-100 text-blue-800';
      case 'sent': case 'delivered': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'Strong': return 'border-green-500 text-green-700';
      case 'Moderate': return 'border-blue-500 text-blue-700';
      case 'Sporadic': return 'border-orange-500 text-orange-700';
      default: return 'border-gray-500 text-gray-700';
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              {campaign.name}
            </DialogTitle>
            <DialogDescription>
              Loading campaign details...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const emailsGenerated = deliveries.some(d => d.email_body);
  const completedCount = deliveries.filter(d => 
    (d.action_mode === 'email_only' && d.email_status === 'sent') ||
    (d.action_mode === 'gift_only' && d.gift_status === 'delivered') ||
    (d.action_mode === 'both' && d.email_status === 'sent' && d.gift_status === 'delivered')
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              {campaign.name}
            </div>
            <Badge variant="outline" className={getStatusColor(campaign.status)}>
              {completedCount}/{deliveries.length} Completed
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Manage emails and gifts for your unified outreach campaign
          </DialogDescription>
        </DialogHeader>

        {/* Campaign Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Campaign Overview</CardTitle>
              {!emailsGenerated && (
                <Button 
                  onClick={generateEmails}
                  disabled={generatingEmails}
                  className="gap-2"
                >
                  {generatingEmails ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Generate AI Emails
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{deliveries.length}</div>
                <div className="text-sm text-muted-foreground">Total Offices</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{completedCount}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {campaign.selected_gift_bundle ? `$${campaign.selected_gift_bundle.cost * deliveries.length}` : '$0'}
                </div>
                <div className="text-sm text-muted-foreground">Total Gift Cost</div>
              </div>
            </div>
            
            {campaign.selected_gift_bundle && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-800">{campaign.selected_gift_bundle.name}</span>
                  {campaign.selected_gift_bundle.is_premium && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      <Crown className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-amber-700">{campaign.selected_gift_bundle.description}</p>
                <div className="text-xs text-amber-600 mt-1">
                  Includes: {campaign.selected_gift_bundle.items.join(', ')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Office Cards */}
        {deliveries.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-8">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <Gift className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">No Offices Selected</h3>
                  <p className="text-muted-foreground mb-4">
                    This campaign doesn't have any offices selected yet. 
                  </p>
                  <p className="text-sm text-muted-foreground">
                    For unified campaigns, offices should be selected during creation. 
                    You may need to recreate this campaign with office selections.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {deliveries.map((delivery) => (
            <Card key={delivery.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{delivery.office.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{delivery.office.address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {delivery.office.source_type}
                      </Badge>
                      {delivery.referral_tier && (
                        <Badge variant="outline" className={`text-xs ${getTierColor(delivery.referral_tier)}`}>
                          {delivery.referral_tier}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Action Mode Toggles */}
                <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                  <Label className="text-xs">Action Type:</Label>
                  <div className="flex gap-1">
                    <Button
                      variant={delivery.action_mode === 'email_only' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs px-2 py-1"
                      onClick={() => updateActionMode(delivery.id, 'email_only')}
                    >
                      <Mail className="w-3 h-3 mr-1" />
                      Email Only
                    </Button>
                    {campaign.selected_gift_bundle && (
                      <Button
                        variant={delivery.action_mode === 'gift_only' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs px-2 py-1"
                        onClick={() => updateActionMode(delivery.id, 'gift_only')}
                      >
                        <Gift className="w-3 h-3 mr-1" />
                        Gift Only
                      </Button>
                    )}
                    {campaign.selected_gift_bundle && (
                      <Button
                        variant={delivery.action_mode === 'both' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs px-2 py-1"
                        onClick={() => updateActionMode(delivery.id, 'both')}
                      >
                        Both
                      </Button>
                    )}
                  </div>
                </div>

                {/* Email Section */}
                {(delivery.action_mode === 'email_only' || delivery.action_mode === 'both') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </Label>
                      <Badge variant="outline" className={getStatusColor(delivery.email_status)}>
                        {delivery.email_status === 'ready' ? 'Ready to Send' : 
                         delivery.email_status === 'sent' ? 'Sent' : 'Pending'}
                      </Badge>
                    </div>
                    
                    {delivery.email_body ? (
                      <div className="bg-muted p-3 rounded text-sm">
                        <div className="font-medium mb-1">Subject: {delivery.email_subject}</div>
                        <div className="text-muted-foreground max-h-20 overflow-y-auto">
                          {delivery.email_body.substring(0, 150)}...
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyEmailContent(delivery)}
                            className="text-xs"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openInEmail(delivery)}
                            className="text-xs"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Open
                          </Button>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <Checkbox
                            id={`email-sent-${delivery.id}`}
                            checked={delivery.email_status === 'sent'}
                            onCheckedChange={(checked) => 
                              updateDeliveryStatus(delivery.id, 'email_status', checked ? 'sent' : 'ready')
                            }
                          />
                          <Label htmlFor={`email-sent-${delivery.id}`} className="text-xs">
                            Mark as Sent
                          </Label>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        <Clock className="w-4 h-4 mx-auto mb-1" />
                        Email not generated yet
                      </div>
                    )}
                  </div>
                )}

                {/* Gift Section */}
                {campaign.selected_gift_bundle && (delivery.action_mode === 'gift_only' || delivery.action_mode === 'both') && (
                  <div className="space-y-2">
                    <Separator />
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Gift className="w-4 h-4" />
                        Gift: {campaign.selected_gift_bundle.name}
                      </Label>
                      <Badge variant="outline" className={getStatusColor(delivery.gift_status)}>
                        {delivery.gift_status === 'delivered' ? 'Delivered' : 
                         delivery.gift_status === 'sent' ? 'Sent' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cost: ${campaign.selected_gift_bundle.cost}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`gift-delivered-${delivery.id}`}
                        checked={delivery.gift_status === 'delivered'}
                        onCheckedChange={(checked) => 
                          updateDeliveryStatus(delivery.id, 'gift_status', checked ? 'delivered' : 'pending')
                        }
                      />
                      <Label htmlFor={`gift-delivered-${delivery.id}`} className="text-xs">
                        Mark as Delivered
                      </Label>
                    </div>
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