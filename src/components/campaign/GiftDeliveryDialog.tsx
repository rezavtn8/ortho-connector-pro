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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Package, 
  CheckCircle, 
  Clock, 
  XCircle,
  Camera,
  MapPin,
  Save,
  Edit2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { nowISO } from '@/lib/dateSync';

interface Campaign {
  id: string;
  name: string;
  materials_checklist?: string[];
  selected_gift_bundle?: any;
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

interface GiftDeliveryDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
}

export function GiftDeliveryDialog({ 
  campaign, 
  open, 
  onOpenChange, 
  onCampaignUpdated 
}: GiftDeliveryDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [deliveries, setDeliveries] = useState<CampaignDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [materialsChecked, setMaterialsChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open && campaign) {
      fetchDeliveries();
      initializeMaterialsChecklist();
    }
  }, [open, campaign]);

  const initializeMaterialsChecklist = () => {
    if (campaign.materials_checklist) {
      const checked: Record<string, boolean> = {};
      campaign.materials_checklist.forEach(item => {
        checked[item] = false;
      });
      setMaterialsChecked(checked);
    }
  };

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
        description: "Failed to load deliveries.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDeliveryStatus = async (deliveryId: string, status: 'pending' | 'delivered' | 'failed') => {
    try {
      const updateData: any = { gift_status: status };
      if (status === 'delivered') {
        updateData.delivered_at = nowISO();
      }

      await supabase
        .from('campaign_deliveries')
        .update(updateData)
        .eq('id', deliveryId);

      toast({
        title: "Success",
        description: `Delivery marked as ${status}`,
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

  const updateDeliveryNotes = async (deliveryId: string, notes: string) => {
    try {
      await supabase
        .from('campaign_deliveries')
        .update({ delivery_notes: notes })
        .eq('id', deliveryId);

      setEditingNotes(null);
      setNoteText('');
      fetchDeliveries();

      toast({
        title: "Success",
        description: "Notes updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update notes",
        variant: "destructive",
      });
    }
  };

  const startEditingNotes = (delivery: CampaignDelivery) => {
    setEditingNotes(delivery.id);
    setNoteText(delivery.delivery_notes || '');
  };

  const deliveredCount = deliveries.filter(d => d.gift_status === 'delivered').length;
  const pendingCount = deliveries.filter(d => d.gift_status === 'pending').length;
  const failedCount = deliveries.filter(d => d.gift_status === 'failed').length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-amber-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" />
              {campaign.name} - Gift Delivery Management
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-700">
              {deliveredCount}/{deliveries.length} Delivered
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Track and manage gift deliveries to {deliveries.length} offices
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
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
              <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{failedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Materials Checklist */}
        {campaign.materials_checklist && campaign.materials_checklist.length > 0 && (
          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-amber-900">Materials Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {campaign.materials_checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Checkbox
                      checked={materialsChecked[item]}
                      onCheckedChange={(checked) => 
                        setMaterialsChecked(prev => ({ ...prev, [item]: checked as boolean }))
                      }
                    />
                    <label className="text-sm">{item}</label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Cards */}
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map((delivery) => (
              <Card key={delivery.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(delivery.gift_status)}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">{delivery.office.name}</CardTitle>
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
                    </div>
                    <Badge className={getStatusColor(delivery.gift_status)}>
                      {delivery.gift_status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Status Action Buttons */}
                  {delivery.gift_status === 'pending' && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => updateDeliveryStatus(delivery.id, 'delivered')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Mark Delivered
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateDeliveryStatus(delivery.id, 'failed')}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Mark Failed
                      </Button>
                    </div>
                  )}

                  {/* Notes Section */}
                  <div className="border-t pt-3">
                    {editingNotes === delivery.id ? (
                      <div className="space-y-2">
                        <Label>Delivery Notes</Label>
                        <Textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add notes about this delivery..."
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateDeliveryNotes(delivery.id, noteText)}>
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingNotes(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Delivery Notes</Label>
                          {delivery.delivery_notes ? (
                            <p className="text-sm mt-1">{delivery.delivery_notes}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic mt-1">No notes added</p>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => startEditingNotes(delivery)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
