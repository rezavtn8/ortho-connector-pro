import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Megaphone, 
  Loader2,
  AlertCircle,
  WifiOff,
  Calendar,
  Mail,
  Gift,
  Package,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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
  
  // State for campaign creators
  const [showEmailCreator, setShowEmailCreator] = useState(false);
  const [showGiftCreator, setShowGiftCreator] = useState(false);
  
  // State for detail dialogs
  const [showEmailDetail, setShowEmailDetail] = useState(false);
  const [showGiftDetail, setShowGiftDetail] = useState(false);
  
  // State for execution dialogs
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

      // Fetch campaign deliveries to get tier information
      const { data: deliveriesData } = await supabase
        .from('campaign_deliveries')
        .select('campaign_id, referral_tier');

      // Group deliveries by campaign
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

      // Add tier information to campaigns
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
    fallbackData: [],
    retryMessage: 'Refreshing campaigns...'
  });

  const emailCampaigns = campaigns?.filter((c: Campaign) => c.delivery_method === 'email') || [];
  const giftCampaigns = campaigns?.filter((c: Campaign) => c.delivery_method === 'physical') || [];
  const otherCampaigns = campaigns?.filter((c: Campaign) => 
    c.delivery_method !== 'email' && c.delivery_method !== 'physical'
  ) || [];

  const handleCampaignUpdated = () => {
    refetch();
  };

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

  const renderEmailCampaignCard = (campaign: Campaign) => (
    <Card key={campaign.id} className="hover:shadow-md transition-shadow border-primary/20 cursor-pointer" onClick={() => handleExecuteEmail(campaign)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              {campaign.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {campaign.campaign_type}
            </p>
            {campaign.office_count !== undefined && campaign.office_count > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {campaign.office_count} {campaign.office_count === 1 ? 'office' : 'offices'}
                </span>
                {campaign.office_tiers && campaign.office_tiers.length > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <div className="flex gap-1 flex-wrap">
                      {campaign.office_tiers.map((tier) => (
                        <Badge 
                          key={tier} 
                          variant="secondary" 
                          className="text-xs"
                        >
                          {tier}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <Badge 
            variant="outline"
            className="bg-primary/5 text-primary border-primary/20"
          >
            {campaign.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {campaign.notes && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {campaign.notes}
          </p>
        )}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewEmailDetails(campaign)}
          >
            View Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditEmailCampaign(campaign)}
          >
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderGiftCampaignCard = (campaign: Campaign) => (
    <Card key={campaign.id} className="hover:shadow-md transition-shadow border-amber-200 cursor-pointer" onClick={() => handleManageGiftDelivery(campaign)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-600" />
              {campaign.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {campaign.campaign_type}
            </p>
            {campaign.planned_delivery_date && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(campaign.planned_delivery_date), 'MMM dd, yyyy')}
              </p>
            )}
            {campaign.office_count !== undefined && campaign.office_count > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {campaign.office_count} {campaign.office_count === 1 ? 'office' : 'offices'}
                </span>
                {campaign.office_tiers && campaign.office_tiers.length > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <div className="flex gap-1 flex-wrap">
                      {campaign.office_tiers.map((tier) => (
                        <Badge 
                          key={tier} 
                          variant="secondary" 
                          className="text-xs"
                        >
                          {tier}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <Badge 
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            {campaign.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {campaign.selected_gift_bundle && (
          <p className="text-sm font-medium text-amber-800 mb-2">
            Gift: {campaign.selected_gift_bundle.name}
          </p>
        )}
        {campaign.notes && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {campaign.notes}
          </p>
        )}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewGiftDetails(campaign)}
          >
            View Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditGiftCampaign(campaign)}
          >
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <Megaphone className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Campaigns</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Loading your campaigns...
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !campaigns?.length) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <Megaphone className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Campaigns</h1>
          </div>
        </div>
        
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              {isOffline ? <WifiOff className="w-6 h-6 text-destructive" /> : <AlertCircle className="w-6 h-6 text-destructive" />}
            </div>
            <CardTitle>
              {isOffline ? 'You\'re Offline' : 'Failed to Load Campaigns'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {isOffline 
                ? 'Campaigns are not available while offline. Please reconnect to view your campaigns.'
                : 'Unable to load your campaigns. Please check your connection and try again.'
              }
            </p>
            <Button onClick={() => refetch()} disabled={isOffline} className="gap-2">
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
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <Megaphone className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Campaigns</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Create AI-powered campaigns and manage your outreach efforts
        </p>
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 p-4">
            <WifiOff className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-900">You're currently offline</p>
              <p className="text-sm text-orange-700">Showing cached campaigns. Some features may not be available.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {/* Email Campaigns Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-primary/5 p-4 rounded-lg border border-primary/10">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Email Campaigns
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                AI-powered personalized email campaigns
              </p>
            </div>
            <Button onClick={() => setShowEmailCreator(true)} className="gap-2" disabled={isOffline}>
              <Mail className="w-4 h-4" />
              Create Email Campaign
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {emailCampaigns.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="text-center py-8">
                  <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No email campaigns yet. Create one to get started!</p>
                </CardContent>
              </Card>
            ) : (
              emailCampaigns.map(renderEmailCampaignCard)
            )}
          </div>
        </div>

        {/* Gift Campaigns Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-amber-50 p-4 rounded-lg border border-amber-200">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-900">
                <Gift className="w-5 h-5 text-amber-600" />
                Gift Campaigns
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Physical gift deliveries and tracking
              </p>
            </div>
            <Button 
              onClick={() => setShowGiftCreator(true)} 
              className="gap-2 bg-amber-600 hover:bg-amber-700"
              disabled={isOffline}
            >
              <Gift className="w-4 h-4" />
              Create Gift Campaign
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {giftCampaigns.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No gift campaigns yet. Create one to get started!</p>
                </CardContent>
              </Card>
            ) : (
              giftCampaigns.map(renderGiftCampaignCard)
            )}
          </div>
        </div>

        {/* Other Campaigns Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border">
            <div>
              <h2 className="text-xl font-semibold">Other Campaigns</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Future campaign types (events, ads, etc.)
              </p>
            </div>
          </div>
          
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">Coming soon: Additional campaign types</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Campaign Creators */}
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

      {/* Detail Dialogs */}
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

          {/* Execution Dialogs */}
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
