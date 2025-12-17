import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { 
  Loader2,
  AlertCircle,
  WifiOff,
  Calendar,
  Mail,
  Gift,
  Package,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  Users,
  ArrowRight
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
        .select('campaign_id, referral_tier');

      const deliveriesByCampaign = deliveriesData?.reduce((acc: any, delivery: any) => {
        if (!acc[delivery.campaign_id]) {
          acc[delivery.campaign_id] = { tiers: new Set(), count: 0 };
        }
        if (delivery.referral_tier) {
          acc[delivery.campaign_id].tiers.add(delivery.referral_tier);
        }
        acc[delivery.campaign_id].count++;
        return acc;
      }, {});

      const enrichedCampaigns = campaignsData?.map((campaign: any) => {
        const deliveryInfo = deliveriesByCampaign?.[campaign.id];
        return {
          ...campaign,
          office_tiers: deliveryInfo ? Array.from(deliveryInfo.tiers) : [],
          office_count: deliveryInfo?.count || 0
        };
      });

      return enrichedCampaigns || [];
    },
    refetchInterval: 30000,
    fallbackData: [],
    retryMessage: 'Refreshing campaigns...'
  });

  const emailCampaigns = campaigns?.filter((c: Campaign) => c.delivery_method === 'email') || [];
  const giftCampaigns = campaigns?.filter((c: Campaign) => c.delivery_method === 'physical') || [];
  
  // Stats calculations
  const totalCampaigns = campaigns?.length || 0;
  const activeCampaigns = campaigns?.filter((c: Campaign) => c.status === 'active' || c.status === 'draft').length || 0;
  const completedCampaigns = campaigns?.filter((c: Campaign) => c.status === 'completed').length || 0;
  const totalOfficesReached = campaigns?.reduce((sum: number, c: Campaign) => sum + (c.office_count || 0), 0) || 0;

  const handleCampaignUpdated = () => refetch();

  const handleViewEmailDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowEmailDetail(true);
  };

  const handleViewGiftDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowGiftDetail(true);
  };

  const handleEditEmailCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowEmailCreator(true);
  };

  const handleEditGiftCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowGiftCreator(true);
  };

  const handleExecuteEmail = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowEmailExecution(true);
  };

  const handleManageGiftDelivery = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowGiftDelivery(true);
  };

  const getStatusBadge = (status: string, variant: 'email' | 'gift') => {
    const baseClasses = variant === 'email' 
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-amber-500/10 text-amber-600 border-amber-500/20";
    
    const statusIcon = status === 'completed' ? (
      <CheckCircle2 className="w-3 h-3" />
    ) : status === 'active' ? (
      <Send className="w-3 h-3" />
    ) : (
      <Clock className="w-3 h-3" />
    );

    return (
      <Badge variant="outline" className={`${baseClasses} gap-1 capitalize`}>
        {statusIcon}
        {status}
      </Badge>
    );
  };

  const renderEmailCampaignCard = (campaign: Campaign) => (
    <Card 
      key={campaign.id} 
      className="group hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/30 cursor-pointer overflow-hidden"
      onClick={() => handleExecuteEmail(campaign)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2 truncate">
              <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <span className="truncate">{campaign.name}</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5">{campaign.campaign_type}</p>
          </div>
          {getStatusBadge(campaign.status, 'email')}
        </div>
      </CardHeader>
      <CardContent className="relative pt-0">
        {campaign.office_count !== undefined && campaign.office_count > 0 && (
          <div className="flex items-center gap-3 mb-3 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{campaign.office_count} offices</span>
            </div>
            {campaign.office_tiers && campaign.office_tiers.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {campaign.office_tiers.slice(0, 3).map((tier) => (
                  <Badge key={tier} variant="secondary" className="text-xs px-1.5 py-0">
                    {tier}
                  </Badge>
                ))}
                {campaign.office_tiers.length > 3 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    +{campaign.office_tiers.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
        {campaign.notes && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{campaign.notes}</p>
        )}
        <div className="flex gap-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleViewEmailDetails(campaign)}>
            Details
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleEditEmailCampaign(campaign)}>
            Edit
          </Button>
          <Button variant="default" size="sm" className="text-xs h-8 ml-auto gap-1" onClick={() => handleExecuteEmail(campaign)}>
            Execute
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderGiftCampaignCard = (campaign: Campaign) => (
    <Card 
      key={campaign.id} 
      className="group hover:shadow-lg transition-all duration-200 border-border/50 hover:border-amber-500/30 cursor-pointer overflow-hidden"
      onClick={() => handleManageGiftDelivery(campaign)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2 truncate">
              <div className="p-1.5 bg-amber-500/10 rounded-md shrink-0">
                <Gift className="w-4 h-4 text-amber-600" />
              </div>
              <span className="truncate">{campaign.name}</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5">{campaign.campaign_type}</p>
          </div>
          {getStatusBadge(campaign.status, 'gift')}
        </div>
      </CardHeader>
      <CardContent className="relative pt-0">
        <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
          {campaign.planned_delivery_date && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(campaign.planned_delivery_date), 'MMM dd, yyyy')}</span>
            </div>
          )}
          {campaign.office_count !== undefined && campaign.office_count > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{campaign.office_count} offices</span>
            </div>
          )}
        </div>
        {campaign.selected_gift_bundle && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-amber-500/5 rounded-md">
            <Package className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{campaign.selected_gift_bundle.name}</span>
          </div>
        )}
        {campaign.notes && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{campaign.notes}</p>
        )}
        <div className="flex gap-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleViewGiftDetails(campaign)}>
            Details
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleEditGiftCampaign(campaign)}>
            Edit
          </Button>
          <Button 
            size="sm" 
            className="text-xs h-8 ml-auto gap-1 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => handleManageGiftDelivery(campaign)}
          >
            Manage
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Section Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-5 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
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
              {isOffline 
                ? 'Campaigns are not available while offline.'
                : 'Unable to load your campaigns. Please try again.'
              }
            </p>
            <Button onClick={() => refetch()} disabled={isOffline} variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Offline Indicator */}
      {isOffline && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <WifiOff className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium text-sm">You're currently offline</p>
              <p className="text-xs text-muted-foreground">Showing cached campaigns. Some features may not be available.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Campaigns</p>
                <p className="text-2xl font-bold mt-1">{totalCampaigns}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>
                <p className="text-2xl font-bold mt-1">{activeCampaigns}</p>
              </div>
              <div className="p-2 bg-info/10 rounded-lg">
                <Send className="w-5 h-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
                <p className="text-2xl font-bold mt-1">{completedCampaigns}</p>
              </div>
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Offices Reached</p>
                <p className="text-2xl font-bold mt-1">{totalOfficesReached}</p>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Campaigns Section */}
      <section className="space-y-4">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Email Campaigns</h2>
                  <p className="text-sm text-muted-foreground">AI-powered personalized email outreach</p>
                </div>
              </div>
              <Button onClick={() => setShowEmailCreator(true)} disabled={isOffline} className="gap-2">
                <Plus className="w-4 h-4" />
                New Email Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {emailCampaigns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-medium mb-1">No email campaigns yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first email campaign to start reaching out to offices.</p>
              <Button variant="outline" onClick={() => setShowEmailCreator(true)} disabled={isOffline} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {emailCampaigns.map(renderEmailCampaignCard)}
          </div>
        )}
      </section>

      {/* Gift Campaigns Section */}
      <section className="space-y-4">
        <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl">
                  <Gift className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Gift Campaigns</h2>
                  <p className="text-sm text-muted-foreground">Physical gift deliveries and tracking</p>
                </div>
              </div>
              <Button 
                onClick={() => setShowGiftCreator(true)} 
                disabled={isOffline}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Plus className="w-4 h-4" />
                New Gift Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {giftCampaigns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-medium mb-1">No gift campaigns yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first gift campaign to strengthen office relationships.</p>
              <Button variant="outline" onClick={() => setShowGiftCreator(true)} disabled={isOffline} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {giftCampaigns.map(renderGiftCampaignCard)}
          </div>
        )}
      </section>

      {/* Dialogs */}
      <EmailCampaignCreator
        open={showEmailCreator}
        onOpenChange={setShowEmailCreator}
        onCampaignCreated={handleCampaignUpdated}
      />
      
      <PhysicalCampaignCreator
        open={showGiftCreator}
        onOpenChange={setShowGiftCreator}
        onCampaignCreated={handleCampaignUpdated}
      />

      {selectedCampaign && (
        <>
          <EmailCampaignDetailDialog
            campaign={selectedCampaign}
            open={showEmailDetail}
            onOpenChange={setShowEmailDetail}
            onExecute={() => {
              setShowEmailDetail(false);
              handleExecuteEmail(selectedCampaign);
            }}
          />
          
          <GiftCampaignDetailDialog
            campaign={selectedCampaign}
            open={showGiftDetail}
            onOpenChange={setShowGiftDetail}
            onManageDeliveries={() => {
              setShowGiftDetail(false);
              handleManageGiftDelivery(selectedCampaign);
            }}
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
