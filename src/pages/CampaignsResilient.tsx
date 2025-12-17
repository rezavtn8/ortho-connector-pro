import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { supabase } from '@/integrations/supabase/client';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { EmailCampaignCreator } from '@/components/campaign/EmailCampaignCreator';
import { PhysicalCampaignCreator } from '@/components/campaign/PhysicalCampaignCreator';
import { 
  Megaphone, 
  Plus, 
  Loader2,
  AlertCircle,
  WifiOff,
  Calendar,
  Users,
  Mail,
  Package
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function CampaignsContent() {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPhysicalDialog, setShowPhysicalDialog] = useState(false);
  const { data: campaigns, isLoading, error, retry, isOffline, refetch } = useResilientQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    fallbackData: [],
    retryMessage: 'Refreshing campaigns...'
  });

  const handleCampaignCreated = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !campaigns?.length) {
    return (
      <div className="space-y-6">
        
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
            <Button onClick={retry} disabled={isOffline} className="gap-2">
              <Loader2 className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailCampaigns = campaigns?.filter(c => c.delivery_method === 'email') || [];
  const giftCampaigns = campaigns?.filter(c => c.delivery_method === 'physical') || [];
  const otherCampaigns = campaigns?.filter(c => c.delivery_method !== 'email' && c.delivery_method !== 'physical') || [];

  const renderCampaignCard = (campaign: any) => (
    <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{campaign.name}</CardTitle>
          <Badge variant={campaign.status === 'Active' ? 'default' : campaign.status === 'Draft' ? 'secondary' : 'outline'}>
            {campaign.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Created</p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Type</p>
              <p className="text-sm text-muted-foreground">
                {campaign.campaign_type || 'General'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Method</p>
              <p className="text-sm text-muted-foreground">
                {campaign.delivery_method || 'Email'}
              </p>
            </div>
          </div>
        </div>

        {campaign.notes && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">{campaign.notes}</p>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={isOffline}>
            View Details
          </Button>
          <Button variant="outline" size="sm" disabled={isOffline}>
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">

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

      {/* Email Campaigns Section */}
      <div className="bg-primary/5 rounded-lg p-6 border border-primary/10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Email Campaigns</h2>
          </div>
          <Button 
            variant="outline"
            className="gap-2" 
            disabled={isOffline}
            onClick={() => setShowEmailDialog(true)}
          >
            <Plus className="h-4 w-4" />
            Create Email Campaign
          </Button>
        </div>
        {emailCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No email campaigns yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {emailCampaigns.map(renderCampaignCard)}
          </div>
        )}
      </div>

      {/* Gift Campaigns Section */}
      <div className="bg-accent/30 rounded-lg p-6 border border-accent/40">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-accent-foreground" />
            <h2 className="text-xl font-semibold">Gift Campaigns</h2>
          </div>
          <Button 
            className="gap-2" 
            disabled={isOffline}
            onClick={() => setShowPhysicalDialog(true)}
          >
            <Plus className="h-4 w-4" />
            Create Gift Campaign
          </Button>
        </div>
        {giftCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No gift campaigns yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {giftCampaigns.map(renderCampaignCard)}
          </div>
        )}
      </div>

      {/* Other Campaigns Section */}
      <div className="bg-muted/50 rounded-lg p-6 border border-muted">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Other Campaigns</h2>
          </div>
        </div>
        {otherCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Future campaign types like events, ads, etc. will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {otherCampaigns.map(renderCampaignCard)}
          </div>
        )}
      </div>

      {/* Campaign Creator Dialogs */}
      <EmailCampaignCreator
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        onCampaignCreated={handleCampaignCreated}
      />
      <PhysicalCampaignCreator
        open={showPhysicalDialog}
        onOpenChange={setShowPhysicalDialog}
        onCampaignCreated={handleCampaignCreated}
      />
    </div>
  );
}

export function Campaigns() {
  return (
    <ResilientErrorBoundary showNetworkStatus>
      <CampaignsContent />
    </ResilientErrorBoundary>
  );
}