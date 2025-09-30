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
import { Mail, MapPin, CheckCircle, Clock, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  notes?: string;
  status: string;
  created_at: string;
}

interface CampaignDelivery {
  id: string;
  office_id: string;
  email_subject?: string;
  email_body?: string;
  email_status: string;
  email_copied_at?: string;
  email_sent_at?: string;
  office: {
    name: string;
    address?: string;
    source_type: string;
  };
}

interface EmailCampaignDetailDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecute: () => void;
}

export function EmailCampaignDetailDialog({
  campaign,
  open,
  onOpenChange,
  onExecute
}: EmailCampaignDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<CampaignDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && campaign) {
      fetchDeliveries();
    }
  }, [open, campaign]);

  const fetchDeliveries = async () => {
    if (!user) return;

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
        description: "Failed to load email details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const emailsGenerated = deliveries.filter(d => d.email_body).length;
  const emailsSent = deliveries.filter(d => d.email_status === 'sent').length;
  const emailsCopied = deliveries.filter(d => d.email_copied_at).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Mail className="w-6 h-6 text-primary" />
                {campaign.name}
              </DialogTitle>
              <DialogDescription className="mt-2">
                Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              {campaign.status}
            </Badge>
          </div>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Offices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{deliveries.length}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-primary">Emails Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{emailsGenerated}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-600">Copied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{emailsCopied}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-600">Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{emailsSent}</p>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Type & Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Type: </span>
              <span className="text-sm">{campaign.campaign_type}</span>
            </div>
            {campaign.notes && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Notes: </span>
                <p className="text-sm mt-1 whitespace-pre-wrap">{campaign.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Targeted Offices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Targeted Offices ({deliveries.length})</CardTitle>
            <Button onClick={onExecute} size="sm">
              <Mail className="w-4 h-4 mr-2" />
              Generate & Send Emails
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : deliveries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No offices targeted</p>
            ) : (
              <div className="space-y-3">
                {deliveries.map((delivery) => (
                  <div key={delivery.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{delivery.office.name}</h4>
                      {delivery.office.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {delivery.office.address}
                        </p>
                      )}
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {delivery.office.source_type}
                      </Badge>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {delivery.email_body ? (
                        <Badge className="bg-primary/10 text-primary">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Email Generated
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {delivery.email_sent_at && (
                        <Badge className="bg-green-100 text-green-700">
                          Sent
                        </Badge>
                      )}
                      {delivery.email_copied_at && !delivery.email_sent_at && (
                        <Badge className="bg-blue-100 text-blue-700">
                          <Copy className="w-3 h-3 mr-1" />
                          Copied
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
