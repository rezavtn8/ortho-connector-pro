import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { supabase } from '@/integrations/supabase/client';
import { EmailCampaignCreator } from '@/components/campaign/EmailCampaignCreator';
import { PhysicalCampaignCreator } from '@/components/campaign/PhysicalCampaignCreator';
import { EmailCampaignDetailDialog } from '@/components/campaign/EmailCampaignDetailDialog';
import { GiftCampaignDetailDialog } from '@/components/campaign/GiftCampaignDetailDialog';
import { EmailExecutionDialog } from '@/components/campaign/EmailExecutionDialog';
import { GiftDeliveryDialog } from '@/components/campaign/GiftDeliveryDialog';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Loader2, AlertCircle, WifiOff, Calendar, Mail, Gift, Package, Plus,
  Send, CheckCircle2, Clock, Target, Users, ArrowRight, Search,
  MoreVertical, Trash2, Copy, Eye, Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface Campaign {
  id: string;
  name: string;
  status: string;
  campaign_type: string;
  delivery_method: string;
  created_at: string;
  assigned_rep_id: string | null;
  materials_checklist: string[] | null;
  planned_delivery_date: string | null;
  notes: string | null;
  selected_gift_bundle?: any;
  office_tiers?: string[];
  office_count?: number;
  delivered_count?: number;
  sent_count?: number;
}

function CampaignsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [showEmailCreator, setShowEmailCreator] = useState(false);
  const [showGiftCreator, setShowGiftCreator] = useState(false);
  const [showEmailDetail, setShowEmailDetail] = useState(false);
  const [showGiftDetail, setShowGiftDetail] = useState(false);
  const [showEmailExecution, setShowEmailExecution] = useState(false);
  const [showGiftDelivery, setShowGiftDelivery] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const { data: campaigns, isLoading, error, refetch, isOffline } = useResilientQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      const { data: deliveriesData } = await supabase
        .from('campaign_deliveries')
        .select('campaign_id, referral_tier, email_status, gift_status');

      const deliveriesByCampaign = deliveriesData?.reduce((acc: any, delivery: any) => {
        if (!acc[delivery.campaign_id]) {
          acc[delivery.campaign_id] = { tiers: new Set(), count: 0, sent: 0, delivered: 0 };
        }
        if (delivery.referral_tier) acc[delivery.campaign_id].tiers.add(delivery.referral_tier);
        acc[delivery.campaign_id].count++;
        if (delivery.email_status === 'sent') acc[delivery.campaign_id].sent++;
        if (delivery.gift_status === 'delivered') acc[delivery.campaign_id].delivered++;
        return acc;
      }, {});

      return campaignsData?.map((campaign: any) => {
        const info = deliveriesByCampaign?.[campaign.id];
        return {
          ...campaign,
          office_tiers: info ? Array.from(info.tiers) : [],
          office_count: info?.count || 0,
          sent_count: info?.sent || 0,
          delivered_count: info?.delivered || 0,
        };
      }) || [];
    },
    refetchInterval: 30000,
    fallbackData: [],
    retryMessage: 'Refreshing campaigns...'
  });

  const handleCampaignUpdated = () => refetch();

  // Filtering
  const filterCampaigns = (list: Campaign[]) => {
    let filtered = list;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status.toLowerCase() === statusFilter);
    }
    return filtered;
  };

  const allCampaigns = filterCampaigns(campaigns || []);
  const emailCampaigns = allCampaigns.filter(c => c.delivery_method === 'email');
  const giftCampaigns = allCampaigns.filter(c => c.delivery_method === 'physical');

  // Stats (unfiltered)
  const total = campaigns?.length || 0;
  const drafts = campaigns?.filter((c: Campaign) => c.status === 'Draft').length || 0;
  const active = campaigns?.filter((c: Campaign) => c.status === 'active' || c.status === 'Active').length || 0;
  const completed = campaigns?.filter((c: Campaign) => c.status === 'completed' || c.status === 'Completed').length || 0;

  // Actions
  const handleExecute = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    if (campaign.delivery_method === 'email') setShowEmailExecution(true);
    else setShowGiftDelivery(true);
  };

  const handleViewDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    if (campaign.delivery_method === 'email') setShowEmailDetail(true);
    else setShowGiftDetail(true);
  };

  const handleDeleteCampaign = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from('campaign_deliveries').delete().eq('campaign_id', deleteTarget.id);
      await supabase.from('campaigns').delete().eq('id', deleteTarget.id);
      toast({ title: "Deleted", description: `"${deleteTarget.name}" has been deleted.` });
      setDeleteTarget(null);
      refetch();
    } catch {
      toast({ title: "Error", description: "Failed to delete campaign.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (campaign: Campaign, newStatus: string) => {
    try {
      await supabase.from('campaigns').update({ status: newStatus }).eq('id', campaign.id);
      toast({ title: "Updated", description: `Status changed to ${newStatus}` });
      refetch();
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  };

  const handleDuplicate = async (campaign: Campaign) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { id, created_at, updated_at, ...rest } = campaign as any;
      const { data: newCampaign, error } = await supabase.from('campaigns').insert({
        ...rest,
        name: `${campaign.name} (Copy)`,
        status: 'Draft',
        created_by: currentUser.id,
      }).select().single();

      if (error) throw error;

      // Copy deliveries
      const { data: deliveries } = await supabase
        .from('campaign_deliveries')
        .select('office_id, referral_tier, action_mode')
        .eq('campaign_id', campaign.id);

      if (deliveries?.length && newCampaign) {
        await supabase.from('campaign_deliveries').insert(
          deliveries.map(d => ({
            campaign_id: newCampaign.id,
            office_id: d.office_id,
            referral_tier: d.referral_tier,
            action_mode: d.action_mode,
            delivery_status: 'Not Started',
            email_status: 'pending',
            gift_status: 'pending',
            created_by: currentUser.id,
          }))
        );
      }

      toast({ title: "Duplicated", description: `"${campaign.name}" has been duplicated.` });
      refetch();
    } catch {
      toast({ title: "Error", description: "Failed to duplicate campaign.", variant: "destructive" });
    }
  };

  const getProgress = (campaign: Campaign) => {
    if (!campaign.office_count) return 0;
    if (campaign.delivery_method === 'email') {
      return Math.round(((campaign.sent_count || 0) / campaign.office_count) * 100);
    }
    return Math.round(((campaign.delivered_count || 0) / campaign.office_count) * 100);
  };

  const getProgressLabel = (campaign: Campaign) => {
    if (!campaign.office_count) return '0 offices';
    if (campaign.delivery_method === 'email') {
      return `${campaign.sent_count || 0}/${campaign.office_count} sent`;
    }
    return `${campaign.delivered_count || 0}/${campaign.office_count} delivered`;
  };

  const getStatusVariant = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed') return 'default';
    if (s === 'active') return 'secondary';
    return 'outline';
  };

  const renderCampaignCard = (campaign: Campaign) => {
    const isEmail = campaign.delivery_method === 'email';
    const progress = getProgress(campaign);

    return (
      <Card 
        key={campaign.id} 
        className="group hover:shadow-md transition-all duration-200 cursor-pointer"
        onClick={() => handleExecute(campaign)}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`p-1.5 rounded-md shrink-0 ${isEmail ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
                {isEmail ? <Mail className="w-4 h-4 text-primary" /> : <Gift className="w-4 h-4 text-amber-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{campaign.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{campaign.campaign_type.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant={getStatusVariant(campaign.status)} className="text-xs capitalize">
                {campaign.status}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => handleViewDetails(campaign)}>
                    <Eye className="w-3.5 h-3.5 mr-2" /> View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExecute(campaign)}>
                    <Zap className="w-3.5 h-3.5 mr-2" /> {isEmail ? 'Execute Emails' : 'Manage Deliveries'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDuplicate(campaign)}>
                    <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {campaign.status !== 'Active' && (
                    <DropdownMenuItem onClick={() => handleStatusChange(campaign, 'Active')}>
                      <Send className="w-3.5 h-3.5 mr-2" /> Set Active
                    </DropdownMenuItem>
                  )}
                  {campaign.status !== 'Completed' && (
                    <DropdownMenuItem onClick={() => handleStatusChange(campaign, 'Completed')}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark Completed
                    </DropdownMenuItem>
                  )}
                  {campaign.status !== 'Draft' && (
                    <DropdownMenuItem onClick={() => handleStatusChange(campaign, 'Draft')}>
                      <Clock className="w-3.5 h-3.5 mr-2" /> Revert to Draft
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(campaign)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {campaign.office_count ? (
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{campaign.office_count} offices</span>
            ) : null}
            {campaign.planned_delivery_date && (
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(campaign.planned_delivery_date), 'MMM dd')}</span>
            )}
            {campaign.selected_gift_bundle && (
              <span className="flex items-center gap-1"><Package className="w-3 h-3" />{campaign.selected_gift_bundle.name}</span>
            )}
          </div>

          {/* Progress */}
          {campaign.office_count ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{getProgressLabel(campaign)}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          ) : null}

          {/* Quick action */}
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <Button 
              variant={isEmail ? "default" : "secondary"}
              size="sm" 
              className="w-full text-xs h-8 gap-1"
              onClick={() => handleExecute(campaign)}
            >
              {isEmail ? 'Execute Emails' : 'Manage Deliveries'}
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCampaignList = (list: Campaign[]) => {
    if (list.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No campaigns found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters.'
                : 'Create your first campaign to get started.'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => setShowEmailCreator(true)} className="gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email Campaign
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowGiftCreator(true)} className="gap-1">
                  <Gift className="w-3.5 h-3.5" /> Gift Campaign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(renderCampaignCard)}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error && !campaigns?.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              {isOffline ? <WifiOff className="w-6 h-6 text-destructive" /> : <AlertCircle className="w-6 h-6 text-destructive" />}
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {isOffline ? "You're Offline" : 'Failed to Load Campaigns'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {isOffline ? 'Campaigns are not available while offline.' : 'Unable to load your campaigns. Please try again.'}
            </p>
            <Button onClick={() => refetch()} disabled={isOffline} variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Offline banner */}
      {isOffline && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-3">
            <WifiOff className="h-4 w-4 text-warning" />
            <p className="text-sm">You're currently offline. Showing cached campaigns.</p>
          </CardContent>
        </Card>
      )}

      {/* Compact Stats Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1 px-3 py-1 text-sm">
          <Target className="w-3.5 h-3.5" /> Total: {total}
        </Badge>
        <Badge variant="outline" className="gap-1 px-3 py-1 text-sm">
          <Clock className="w-3.5 h-3.5" /> Draft: {drafts}
        </Badge>
        <Badge variant="outline" className="gap-1 px-3 py-1 text-sm">
          <Send className="w-3.5 h-3.5" /> Active: {active}
        </Badge>
        <Badge variant="outline" className="gap-1 px-3 py-1 text-sm">
          <CheckCircle2 className="w-3.5 h-3.5" /> Completed: {completed}
        </Badge>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowEmailCreator(true)} disabled={isOffline} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /><Mail className="w-3.5 h-3.5" /> Email
        </Button>
        <Button onClick={() => setShowGiftCreator(true)} disabled={isOffline} variant="secondary" size="sm" className="gap-1">
          <Plus className="w-4 h-4" /><Gift className="w-3.5 h-3.5" /> Gift
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({allCampaigns.length})</TabsTrigger>
          <TabsTrigger value="email">Email ({emailCampaigns.length})</TabsTrigger>
          <TabsTrigger value="gift">Gift ({giftCampaigns.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{renderCampaignList(allCampaigns)}</TabsContent>
        <TabsContent value="email">{renderCampaignList(emailCampaigns)}</TabsContent>
        <TabsContent value="gift">{renderCampaignList(giftCampaigns)}</TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This will also delete all associated deliveries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Creator Dialogs */}
      <EmailCampaignCreator open={showEmailCreator} onOpenChange={setShowEmailCreator} onCampaignCreated={handleCampaignUpdated} />
      <PhysicalCampaignCreator open={showGiftCreator} onOpenChange={setShowGiftCreator} onCampaignCreated={handleCampaignUpdated} />

      {/* Detail/Execution Dialogs */}
      {selectedCampaign && (
        <>
          <EmailCampaignDetailDialog
            campaign={selectedCampaign}
            open={showEmailDetail}
            onOpenChange={setShowEmailDetail}
            onExecute={() => { setShowEmailDetail(false); setShowEmailExecution(true); }}
          />
          <GiftCampaignDetailDialog
            campaign={selectedCampaign}
            open={showGiftDetail}
            onOpenChange={setShowGiftDetail}
            onManageDeliveries={() => { setShowGiftDetail(false); setShowGiftDelivery(true); }}
          />
          <EmailExecutionDialog
            campaign={selectedCampaign}
            open={showEmailExecution}
            onOpenChange={setShowEmailExecution}
            onCampaignUpdated={handleCampaignUpdated}
          />
          <GiftDeliveryDialog
            campaign={selectedCampaign}
            open={showGiftDelivery}
            onOpenChange={setShowGiftDelivery}
            onCampaignUpdated={handleCampaignUpdated}
          />
        </>
      )}
    </div>
  );
}

export default function Campaigns() {
  return (
    <ResilientErrorBoundary>
      <CampaignsContent />
    </ResilientErrorBoundary>
  );
}
