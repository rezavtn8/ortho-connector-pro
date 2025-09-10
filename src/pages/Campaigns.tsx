import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Filter, Users, Calendar, Truck } from 'lucide-react';
import { CreateCampaignDialog } from '@/components/CreateCampaignDialog';
import { CampaignDetailDialog } from '@/components/CampaignDetailDialog';
import { UnifiedCampaignDialog } from '@/components/UnifiedCampaignDialog';
import { CampaignExecutionDialog } from '@/components/CampaignExecutionDialog';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/DateRangePicker';
import { CalendarView } from '@/components/CalendarView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  campaign_mode?: string;
  delivery_method: string;
  assigned_rep_id: string | null;
  materials_checklist: string[] | null;
  selected_gift_bundle?: any;
  email_settings?: any;
  planned_delivery_date: string | null;
  notes: string | null;
  status: 'Draft' | 'Scheduled' | 'In Progress' | 'Completed';
  created_at: string;
  office_count?: number;
  delivered_count?: number;
}

const campaignTypeColors: Record<string, string> = {
  'Intro Package': 'bg-blue-100 text-blue-800',
  'Mug Drop': 'bg-purple-100 text-purple-800',
  'Lunch Drop': 'bg-green-100 text-green-800',
  'CE Invite Pack': 'bg-orange-100 text-orange-800',
  'Monthly Promo Pack': 'bg-indigo-100 text-indigo-800',
  'Holiday Card Drop': 'bg-red-100 text-red-800',
  'Educational Material Drop': 'bg-teal-100 text-teal-800',
  'Unified Outreach': 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800'
};

const statusColors: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-800',
  'Scheduled': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800'
};

export function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [unifiedCampaignOpen, setUnifiedCampaignOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('grid');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchCampaigns = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch campaigns with office count
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_deliveries (
            id,
            delivery_status
          )
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Process data to include counts
      const processedCampaigns = campaignsData?.map(campaign => ({
        ...campaign,
        office_count: campaign.campaign_deliveries?.length || 0,
        delivered_count: campaign.campaign_deliveries?.filter((d: any) => d.delivery_status === 'Delivered').length || 0
      })) || [];

      setCampaigns(processedCampaigns as Campaign[]);
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: "Error",
        description: "Failed to load campaigns.",
        variant: "destructive",
      });
      setCampaigns([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
      const matchesType = typeFilter === 'all' || campaign.campaign_type === typeFilter;
      
      // Date range filtering
      const plannedDate = campaign.planned_delivery_date ? new Date(campaign.planned_delivery_date) : null;
      const matchesDateRange = (!dateRange?.from || !plannedDate || plannedDate >= dateRange.from) &&
                              (!dateRange?.to || !plannedDate || plannedDate <= dateRange.to);
      
      return matchesSearch && matchesStatus && matchesType && matchesDateRange;
    });
  }, [campaigns, searchQuery, statusFilter, typeFilter, dateRange]);

  const handleCampaignClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    if (campaign.campaign_mode === 'unified') {
      setExecutionDialogOpen(true);
    } else {
      setDetailDialogOpen(true);
    }
  };

  const handleCampaignCreated = useCallback(() => {
    fetchCampaigns();
    toast({
      title: "Success",
      description: "Campaign created successfully.",
    });
  }, [fetchCampaigns]);

  const handleCampaignUpdated = useCallback(() => {
    fetchCampaigns();
    toast({
      title: "Success",
      description: "Campaign updated successfully.",
    });
  }, [fetchCampaigns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] animate-fade-in">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground animate-pulse">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Plan, execute, and track physical outreach campaigns to dental offices.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setUnifiedCampaignOpen(true)} className="gap-2 hover-scale transition-all duration-300">
            <Plus className="w-4 h-4" />
            Create Unified Campaign
          </Button>
          <Button variant="outline" onClick={() => setCreateDialogOpen(true)} className="gap-2 hover-scale transition-all duration-300">
            <Plus className="w-4 h-4" />
            Traditional Campaign
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <h3 className="font-semibold">Filters</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="min-w-[200px]">
              <DateRangePicker
                value={dateRange}
                onChange={(range) => setDateRange(range)}
                placeholder="Filter by delivery date"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Campaign Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Intro Package">Intro Package</SelectItem>
                <SelectItem value="Mug Drop">Mug Drop</SelectItem>
                <SelectItem value="Lunch Drop">Lunch Drop</SelectItem>
                <SelectItem value="CE Invite Pack">CE Invite Pack</SelectItem>
                <SelectItem value="Monthly Promo Pack">Monthly Promo Pack</SelectItem>
                <SelectItem value="Holiday Card Drop">Holiday Card Drop</SelectItem>
                <SelectItem value="Educational Material Drop">Educational Material Drop</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="grid">Grid View</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>
          <div className="text-sm text-muted-foreground">
            {filteredCampaigns.length} campaigns found
          </div>
        </div>

        <TabsContent value="grid">
          {/* Campaigns Grid */}
          {filteredCampaigns.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
                <p className="text-muted-foreground mb-4">
                  {campaigns.length === 0 
                    ? "Get started by creating your first campaign"
                    : "Try adjusting your filters or search query"
                  }
                </p>
                {campaigns.length === 0 && (
                  <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Campaign
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((campaign) => (
                <Card 
                  key={campaign.id} 
                  className="cursor-pointer hover:shadow-md hover-scale transition-all duration-300 animate-fade-in"
                  onClick={() => handleCampaignClick(campaign)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg leading-tight">{campaign.name}</h3>
                        <div className="flex gap-2">
                          <Badge 
                            variant="secondary" 
                            className={campaignTypeColors[campaign.campaign_type] || 'bg-gray-100 text-gray-800'}
                          >
                            {campaign.campaign_type}
                          </Badge>
                          {campaign.campaign_mode === 'unified' && (
                            <Badge variant="secondary" className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800">
                              AI + Gifts
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="secondary"
                        className={statusColors[campaign.status]}
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Truck className="w-4 h-4" />
                      <span>{campaign.delivery_method}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>
                        {campaign.delivered_count || 0} / {campaign.office_count || 0} offices delivered
                      </span>
                    </div>
                    
                    {campaign.planned_delivery_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Planned: {new Date(campaign.planned_delivery_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarView
            events={filteredCampaigns.map(campaign => ({
              id: campaign.id,
              title: campaign.name,
              date: campaign.planned_delivery_date ? new Date(campaign.planned_delivery_date) : new Date(),
              type: 'campaign' as const,
              status: campaign.status,
              description: `${campaign.campaign_type} - ${campaign.office_count || 0} offices`
            }))}
            onEventClick={(event) => {
              const campaign = campaigns.find(c => c.id === event.id);
              if (campaign) {
                handleCampaignClick(campaign);
              }
            }}
            onAddEvent={(date) => {
              setCreateDialogOpen(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Create Unified Campaign Dialog */}
      <UnifiedCampaignDialog
        open={unifiedCampaignOpen}
        onOpenChange={setUnifiedCampaignOpen}
        onCampaignCreated={handleCampaignCreated}
      />

      {/* Create Traditional Campaign Dialog */}
      <CreateCampaignDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCampaignCreated={handleCampaignCreated}
      />

      {/* Campaign Detail Dialog */}
      {selectedCampaign && (
        <CampaignDetailDialog
          campaign={selectedCampaign}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onCampaignUpdated={handleCampaignUpdated}
        />
      )}

      {/* Campaign Execution Dialog */}
      {selectedCampaign && (
        <CampaignExecutionDialog
          campaign={selectedCampaign}
          open={executionDialogOpen}
          onOpenChange={setExecutionDialogOpen}
          onCampaignUpdated={handleCampaignUpdated}
        />
      )}
    </div>
  );
}