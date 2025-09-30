import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { useResilientQuery } from '@/hooks/useResilientQuery';
import { supabase } from '@/integrations/supabase/client';
import { CreateCampaignDialog } from '@/components/CreateCampaignDialog';
import { CampaignDetailDialog } from '@/components/CampaignDetailDialog';
import { CampaignExecutionDialog } from '@/components/CampaignExecutionDialog';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { 
  Megaphone, 
  Plus, 
  Loader2,
  AlertCircle,
  WifiOff,
  Calendar,
  Users,
  Mail,
  Eye,
  Edit,
  Play,
  Sparkles,
  Package
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
}

function CampaignsContent() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showExecutionDialog, setShowExecutionDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);

  const { data: campaigns, isLoading, error, refetch, isOffline } = useResilientQuery({
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


  const handleCreateCampaign = () => {
    refetch();
    setShowCreateDialog(false);
  };

  const handleCampaignUpdated = () => {
    refetch();
    setShowDetailDialog(false);
    setShowExecutionDialog(false);
  };

  const handleViewDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowDetailDialog(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowDetailDialog(true);
  };

  const handleExecuteCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowExecutionDialog(true);
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
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4" />
            Create Email Campaign
          </Button>
        </div>
        {campaigns?.filter(c => c.delivery_method === 'email').length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No email campaigns yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns?.filter(c => c.delivery_method === 'email').map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <Badge 
                      variant={
                        campaign.status === 'Active' ? 'default' : 
                        campaign.status === 'Draft' ? 'secondary' : 
                        campaign.status === 'Completed' ? 'outline' : 'secondary'
                      }
                    >
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isOffline}
                      onClick={() => handleViewDetails(campaign as any)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isOffline}
                      onClick={() => handleEditCampaign(campaign as any)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      disabled={isOffline}
                      onClick={() => handleExecuteCampaign(campaign as any)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate Emails
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Gift Campaigns Section */}
      <div className="bg-accent/30 rounded-lg p-6 border border-accent/40">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-accent-foreground" />
            <h2 className="text-xl font-semibold">Gift Campaigns</h2>
          </div>
          <Button 
            className="gap-2" 
            disabled={isOffline}
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4" />
            Create Gift Campaign
          </Button>
        </div>
        {campaigns?.filter(c => c.delivery_method === 'physical').length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No gift campaigns yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns?.filter(c => c.delivery_method === 'physical').map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <Badge 
                      variant={
                        campaign.status === 'Active' ? 'default' : 
                        campaign.status === 'Draft' ? 'secondary' : 
                        campaign.status === 'Completed' ? 'outline' : 'secondary'
                      }
                    >
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isOffline}
                      onClick={() => handleViewDetails(campaign as any)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isOffline}
                      onClick={() => handleEditCampaign(campaign as any)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
        {campaigns?.filter(c => c.delivery_method !== 'email' && c.delivery_method !== 'physical').length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Future campaign types like events, ads, etc. will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns?.filter(c => c.delivery_method !== 'email' && c.delivery_method !== 'physical').map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <Badge 
                      variant={
                        campaign.status === 'Active' ? 'default' : 
                        campaign.status === 'Draft' ? 'secondary' : 
                        campaign.status === 'Completed' ? 'outline' : 'secondary'
                      }
                    >
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isOffline}
                      onClick={() => handleViewDetails(campaign as any)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isOffline}
                      onClick={() => handleEditCampaign(campaign as any)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateCampaignDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCampaignCreated={handleCreateCampaign}
      />

      {selectedCampaign && (
        <>
          <CampaignDetailDialog
            campaign={selectedCampaign}
            open={showDetailDialog}
            onOpenChange={setShowDetailDialog}
            onCampaignUpdated={handleCampaignUpdated}
          />

          <CampaignExecutionDialog
            campaign={selectedCampaign}
            open={showExecutionDialog}
            onOpenChange={setShowExecutionDialog}
            onCampaignUpdated={handleCampaignUpdated}
          />
        </>
      )}
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