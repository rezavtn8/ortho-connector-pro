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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Circle, 
  XCircle, 
  Camera,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { nowISO } from '@/lib/dateSync';
import { useToast } from '@/hooks/use-toast';

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  delivery_method: string;
  assigned_rep_id: string | null;
  materials_checklist: string[] | null;
  planned_delivery_date: string | null;
  notes: string | null;
  status: 'Draft' | 'Scheduled' | 'In Progress' | 'Completed';
  created_at: string;
}

interface CampaignDelivery {
  id: string;
  office_id: string;
  delivery_status: 'Not Started' | 'Delivered' | 'Failed';
  delivered_at: string | null;
  delivery_notes: string | null;
  photo_url: string | null;
  office: {
    name: string;
    address: string | null;
    source_type: string;
  };
}

interface CampaignDetailDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
}

const statusColors: Record<string, string> = {
  'Not Started': 'bg-gray-100 text-gray-800',
  'Delivered': 'bg-green-100 text-green-800',
  'Failed': 'bg-red-100 text-red-800'
};

const campaignStatusColors: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-800',
  'Scheduled': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800'
};

export function CampaignDetailDialog({ campaign, open, onOpenChange, onCampaignUpdated }: CampaignDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [deliveries, setDeliveries] = useState<CampaignDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDelivery, setEditingDelivery] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchDeliveries = async () => {
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
        .order('created_at');

      if (error) throw error;
      setDeliveries((data as CampaignDelivery[]) || []);
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

  useEffect(() => {
    if (open && campaign.id) {
      fetchDeliveries();
    }
  }, [open, campaign.id]);

  const updateDeliveryStatus = async (deliveryId: string, status: 'Delivered' | 'Failed') => {
    if (!user) return;

    try {
      setUpdatingStatus(deliveryId);
      
      interface UpdateData {
        delivery_status: 'Delivered' | 'Failed';
        delivered_at?: string;
      }
      
      const updateData: UpdateData = {
        delivery_status: status
      };
      
      if (status === 'Delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('campaign_deliveries')
        .update(updateData)
        .eq('id', deliveryId)
        .eq('created_by', user.id);

      if (error) throw error;

      // Update local state
      setDeliveries(prev => prev.map(delivery => 
        delivery.id === deliveryId 
          ? { 
              ...delivery, 
              delivery_status: status, 
              delivered_at: status === 'Delivered' ? new Date().toISOString() : delivery.delivered_at 
            }
          : delivery
      ));

      toast({
        title: "Success",
        description: `Delivery marked as ${status.toLowerCase()}.`,
      });

      onCampaignUpdated();
    } catch (error) {
      console.error('Error updating delivery status:', error);
      toast({
        title: "Error",
        description: "Failed to update delivery status.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateDeliveryNotes = async (deliveryId: string, notes: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('campaign_deliveries')
        .update({ delivery_notes: notes })
        .eq('id', deliveryId)
        .eq('created_by', user.id);

      if (error) throw error;

      // Update local state
      setDeliveries(prev => prev.map(delivery => 
        delivery.id === deliveryId ? { ...delivery, delivery_notes: notes } : delivery
      ));

      setEditingDelivery(null);
      setEditingNotes('');
      
      toast({
        title: "Success",
        description: "Notes updated successfully.",
      });
    } catch (error) {
      console.error('Error updating notes:', error);
      toast({
        title: "Error",
        description: "Failed to update notes.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Delivered':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'Failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const startEditingNotes = (delivery: CampaignDelivery) => {
    setEditingDelivery(delivery.id);
    setEditingNotes(delivery.delivery_notes || '');
  };

  const cancelEditingNotes = () => {
    setEditingDelivery(null);
    setEditingNotes('');
  };

  const deliveredCount = deliveries.filter(d => d.delivery_status === 'Delivered').length;
  const failedCount = deliveries.filter(d => d.delivery_status === 'Failed').length;
  const pendingCount = deliveries.length - deliveredCount - failedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{campaign.name}</DialogTitle>
              <DialogDescription className="mt-2">
                Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
              </DialogDescription>
            </div>
            <Badge className={campaignStatusColors[campaign.status]}>
              {campaign.status}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries ({deliveries.length})</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Campaign Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{campaign.campaign_type}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center space-y-0">
                  <CardTitle className="text-sm font-medium">Delivery Method</CardTitle>
                  <Truck className="w-4 h-4 ml-auto" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{campaign.delivery_method}</p>
                </CardContent>
              </Card>

              {campaign.planned_delivery_date && (
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center space-y-0">
                    <CardTitle className="text-sm font-medium">Planned Date</CardTitle>
                    <Calendar className="w-4 h-4 ml-auto" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">
                      {format(new Date(campaign.planned_delivery_date), 'MMM dd, yyyy')}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-600">{pendingCount}</p>
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

            {campaign.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{campaign.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading deliveries...</p>
              </div>
            ) : deliveries.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                      <Truck className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">No Deliveries Found</h3>
                      <p className="text-muted-foreground mb-4">
                        This campaign doesn't have any deliveries created yet.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Traditional campaigns need offices to be manually added to create deliveries.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {deliveries.map((delivery) => (
                  <Card key={delivery.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getStatusIcon(delivery.delivery_status)}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium">{delivery.office.name}</h4>
                            {delivery.office.address && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {delivery.office.address}
                              </p>
                            )}
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {delivery.office.source_type}
                            </Badge>
                            
                            {delivery.delivered_at && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Delivered {formatDistanceToNow(new Date(delivery.delivered_at), { addSuffix: true })}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[delivery.delivery_status]}>
                            {delivery.delivery_status}
                          </Badge>
                          
                          {delivery.delivery_status === 'Not Started' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => updateDeliveryStatus(delivery.id, 'Delivered')}
                                disabled={updatingStatus === delivery.id}
                              >
                                {updatingStatus === delivery.id ? 'Updating...' : 'Mark Delivered'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateDeliveryStatus(delivery.id, 'Failed')}
                                disabled={updatingStatus === delivery.id}
                              >
                                Mark Failed
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Notes Section */}
                      <div className="mt-4 border-t pt-3">
                        {editingDelivery === delivery.id ? (
                          <div className="space-y-2">
                            <Label htmlFor={`notes-${delivery.id}`}>Delivery Notes</Label>
                            <Textarea
                              id={`notes-${delivery.id}`}
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              placeholder="Add notes about this delivery..."
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateDeliveryNotes(delivery.id, editingNotes)}
                              >
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditingNotes}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {delivery.delivery_notes ? (
                                <p className="text-sm">{delivery.delivery_notes}</p>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">No notes added</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditingNotes(delivery)}
                            >
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
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Materials Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                {campaign.materials_checklist && campaign.materials_checklist.length > 0 ? (
                  <div className="space-y-2">
                    {campaign.materials_checklist.map((material, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>{material}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No materials specified for this campaign.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}