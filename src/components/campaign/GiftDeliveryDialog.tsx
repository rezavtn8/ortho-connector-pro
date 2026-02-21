import React, { useState, useEffect, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { 
  Package, CheckCircle, Clock, XCircle, MapPin, Save, Edit2, CheckCheck
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
  office: { name: string; address?: string; source_type: string };
}

interface GiftDeliveryDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
}

export function GiftDeliveryDialog({ campaign, open, onOpenChange, onCampaignUpdated }: GiftDeliveryDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [deliveries, setDeliveries] = useState<CampaignDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [materialsChecked, setMaterialsChecked] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'status' | 'name'>('status');

  useEffect(() => {
    if (open && campaign) {
      fetchDeliveries();
      if (campaign.materials_checklist) {
        const checked: Record<string, boolean> = {};
        campaign.materials_checklist.forEach(item => { checked[item] = false; });
        setMaterialsChecked(checked);
      }
    }
  }, [open, campaign]);

  const fetchDeliveries = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaign_deliveries')
        .select(`*, office:patient_sources (name, address, source_type)`)
        .eq('campaign_id', campaign.id)
        .eq('created_by', user.id)
        .order('created_at');
      if (error) throw error;
      setDeliveries(data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load deliveries.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sortedDeliveries = useMemo(() => {
    const sorted = [...deliveries];
    if (sortBy === 'status') {
      const order: Record<string, number> = { pending: 0, failed: 1, delivered: 2 };
      sorted.sort((a, b) => (order[a.gift_status] ?? 0) - (order[b.gift_status] ?? 0));
    } else {
      sorted.sort((a, b) => a.office.name.localeCompare(b.office.name));
    }
    return sorted;
  }, [deliveries, sortBy]);

  const updateStatus = async (deliveryId: string, status: 'pending' | 'delivered' | 'failed') => {
    const updateData: any = { gift_status: status };
    if (status === 'delivered') updateData.delivered_at = nowISO();
    await supabase.from('campaign_deliveries').update(updateData).eq('id', deliveryId);
    toast({ title: `Marked as ${status}` });
    fetchDeliveries();
    onCampaignUpdated();
  };

  const markAllDelivered = async () => {
    const pending = deliveries.filter(d => d.gift_status === 'pending');
    for (const d of pending) {
      await supabase.from('campaign_deliveries').update({ gift_status: 'delivered', delivered_at: nowISO() }).eq('id', d.id);
    }
    toast({ title: "All Marked Delivered", description: `${pending.length} deliveries updated` });
    fetchDeliveries();
    onCampaignUpdated();
  };

  const saveNotes = async (deliveryId: string) => {
    await supabase.from('campaign_deliveries').update({ delivery_notes: noteText }).eq('id', deliveryId);
    setEditingNotes(null);
    setNoteText('');
    fetchDeliveries();
    toast({ title: "Notes updated" });
  };

  const deliveredCount = deliveries.filter(d => d.gift_status === 'delivered').length;
  const pendingCount = deliveries.filter(d => d.gift_status === 'pending').length;
  const failedCount = deliveries.filter(d => d.gift_status === 'failed').length;
  const progress = deliveries.length ? Math.round((deliveredCount / deliveries.length) * 100) : 0;

  const getStatusIcon = (status: string) => {
    if (status === 'delivered') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-amber-600" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            {campaign.name} - Gift Deliveries
          </DialogTitle>
          <DialogDescription>
            Track deliveries to {deliveries.length} offices
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar + Stats */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{deliveredCount}/{deliveries.length} delivered</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3.5 h-3.5" /> {deliveredCount}</span>
              <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3.5 h-3.5" /> {pendingCount}</span>
              {failedCount > 0 && <span className="flex items-center gap-1 text-destructive"><XCircle className="w-3.5 h-3.5" /> {failedCount}</span>}
            </div>
            <div className="flex gap-2 ml-auto">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">By Status</SelectItem>
                  <SelectItem value="name">By Name</SelectItem>
                </SelectContent>
              </Select>
              {pendingCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllDelivered} className="gap-1.5 h-8 text-xs">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark All Delivered
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Materials Checklist */}
        {campaign.materials_checklist && campaign.materials_checklist.length > 0 && (
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Materials Checklist</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {campaign.materials_checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Checkbox checked={materialsChecked[item]} onCheckedChange={(c) => setMaterialsChecked(prev => ({ ...prev, [item]: c as boolean }))} />
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
            <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-2">
            {sortedDeliveries.map((delivery) => (
              <Card key={delivery.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(delivery.gift_status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">{delivery.office.name}</h4>
                        <Badge variant="outline" className="text-xs capitalize shrink-0">{delivery.gift_status}</Badge>
                      </div>
                      {delivery.office.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{delivery.office.address}</span>
                        </p>
                      )}

                      {/* Actions */}
                      {delivery.gift_status === 'pending' && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => updateStatus(delivery.id, 'delivered')}>
                            <CheckCircle className="w-3.5 h-3.5" /> Delivered
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateStatus(delivery.id, 'failed')}>
                            <XCircle className="w-3.5 h-3.5" /> Failed
                          </Button>
                        </div>
                      )}

                      {/* Notes */}
                      {editingNotes === delivery.id ? (
                        <div className="mt-2 space-y-2">
                          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Delivery notes..." rows={2} />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveNotes(delivery.id)}><Save className="w-3.5 h-3.5" /> Save</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingNotes(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-1">
                          {delivery.delivery_notes ? (
                            <p className="text-xs text-muted-foreground italic flex-1">{delivery.delivery_notes}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic flex-1">No notes</p>
                          )}
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingNotes(delivery.id); setNoteText(delivery.delivery_notes || ''); }}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
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
