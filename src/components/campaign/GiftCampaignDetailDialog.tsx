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
import { Gift, MapPin, CheckCircle, Clock, Package, Crown, DollarSign } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  notes?: string;
  status: string;
  created_at: string;
  selected_gift_bundle?: any;
  planned_delivery_date?: string;
  materials_checklist?: string[];
}

interface CampaignDelivery {
  id: string;
  office_id: string;
  gift_status: string;
  delivered_at?: string;
  delivery_notes?: string;
  photo_url?: string;
  office: {
    name: string;
    address?: string;
    source_type: string;
  };
}

interface GiftCampaignDetailDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageDeliveries: () => void;
}

export function GiftCampaignDetailDialog({
  campaign,
  open,
  onOpenChange,
  onManageDeliveries
}: GiftCampaignDetailDialogProps) {
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
        description: "Failed to load gift details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deliveredCount = deliveries.filter(d => d.gift_status === 'delivered').length;
  const pendingCount = deliveries.filter(d => d.gift_status === 'pending').length;
  const totalCost = campaign.selected_gift_bundle 
    ? campaign.selected_gift_bundle.cost * deliveries.length 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Gift className="w-6 h-6 text-amber-600" />
                {campaign.name}
              </DialogTitle>
              <DialogDescription className="mt-2">
                Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
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
              <CardTitle className="text-sm font-medium text-green-600">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{deliveredCount}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-amber-600">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">${totalCost}</p>
            </CardContent>
          </Card>
        </div>

        {/* Gift Bundle Details */}
        {campaign.selected_gift_bundle && (
          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <Gift className="w-5 h-5" />
                {campaign.selected_gift_bundle.name}
                {campaign.selected_gift_bundle.is_premium && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                    <Crown className="w-3 h-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-amber-800">{campaign.selected_gift_bundle.description}</p>
              <div className="flex items-center gap-2 text-amber-700">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">${campaign.selected_gift_bundle.cost} per gift</span>
              </div>
              <div className="text-xs text-amber-600 mt-2">
                <strong>Includes:</strong> {campaign.selected_gift_bundle.items?.join(', ')}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Type: </span>
              <span className="text-sm">{campaign.campaign_type}</span>
            </div>
            {campaign.planned_delivery_date && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Planned Delivery: </span>
                <span className="text-sm">{format(new Date(campaign.planned_delivery_date), 'MMM dd, yyyy')}</span>
              </div>
            )}
            {campaign.notes && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Notes: </span>
                <p className="text-sm mt-1 whitespace-pre-wrap">{campaign.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Materials Checklist */}
        {campaign.materials_checklist && campaign.materials_checklist.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Materials Checklist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {campaign.materials_checklist.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Targeted Offices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Delivery Status ({deliveries.length})</CardTitle>
            <Button onClick={onManageDeliveries} size="sm" className="bg-amber-600 hover:bg-amber-700">
              <Package className="w-4 h-4 mr-2" />
              Manage Deliveries
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
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
                      {delivery.delivered_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Delivered {formatDistanceToNow(new Date(delivery.delivered_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <div>
                      {delivery.gift_status === 'delivered' ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Delivered
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
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
