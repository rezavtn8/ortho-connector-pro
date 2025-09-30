import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { supabase } from '@/integrations/supabase/client';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { EmailCampaignCreator } from '@/components/EmailCampaignCreator';
import { PhysicalCampaignCreator } from '@/components/PhysicalCampaignCreator';
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
            <Button onClick={retry} disabled={isOffline} className="gap-2">
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
          Manage your marketing campaigns and outreach efforts
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

      {/* Create Campaign Buttons */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Campaigns</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            className="gap-2" 
            disabled={isOffline}
            onClick={() => setShowEmailDialog(true)}
          >
            <Mail className="h-4 w-4" />
            Email Campaign
          </Button>
          <Button 
            className="gap-2" 
            disabled={isOffline}
            onClick={() => setShowPhysicalDialog(true)}
          >
            <Package className="h-4 w-4" />
            Physical Campaign
          </Button>
        </div>
      </div>

      {/* Campaigns List */}
      {campaigns?.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by creating your first marketing campaign to reach out to your referral sources.
            </p>
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline"
                className="gap-2" 
                disabled={isOffline}
                onClick={() => setShowEmailDialog(true)}
              >
                <Mail className="h-4 w-4" />
                Email Campaign
              </Button>
              <Button 
                className="gap-2" 
                disabled={isOffline}
                onClick={() => setShowPhysicalDialog(true)}
              >
                <Package className="h-4 w-4" />
                Physical Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns?.map((campaign) => (
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
          ))}
        </div>
      )}

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