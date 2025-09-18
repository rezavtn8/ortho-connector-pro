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
import { formatDistanceToNow, format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/DateRangePicker';
import { CalendarView } from '@/components/CalendarView';
import { ImportantDatesCalendar } from '@/components/ImportantDatesCalendar';
import { ImportantDateCampaignDialog } from '@/components/ImportantDateCampaignDialog';
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
  const [activeTab, setActiveTab] = useState('important-dates');
  
  // Important Dates functionality
  const [selectedImportantDate, setSelectedImportantDate] = useState<any>(null);
  const [importantDateDialogOpen, setImportantDateDialogOpen] = useState(false);
  
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

  const handleImportantDateSelected = (importantDate: any) => {
    setSelectedImportantDate(importantDate);
    setImportantDateDialogOpen(true);
  };

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
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Modern Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Campaigns</h1>
                <p className="text-sm text-muted-foreground">
                  Create seasonal campaigns with AI-generated content or manage ongoing outreach
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={() => setUnifiedCampaignOpen(true)} 
              className="gap-2 shadow-sm"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              AI Campaign
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setCreateDialogOpen(true)} 
              className="gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Traditional
            </Button>
          </div>
        </div>
      </div>

      {/* Modern Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList className="grid w-full sm:w-auto grid-cols-3 bg-muted/50 p-1">
            <TabsTrigger value="important-dates" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Important Dates</span>
              <span className="sm:hidden">Dates</span>
            </TabsTrigger>
            <TabsTrigger value="grid" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">My Campaigns</span>
              <span className="sm:hidden">Campaigns</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Calendar</span>
              <span className="sm:hidden">Cal</span>
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-4">
            {activeTab !== 'important-dates' && (
              <>
                {/* Compact Filters */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 h-8"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-28 h-8">
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
                </div>
                <Badge variant="outline" className="text-xs">
                  {filteredCampaigns.length} campaigns
                </Badge>
              </>
            )}
            {activeTab === 'important-dates' && (
              <Badge variant="outline" className="text-xs">
                Seasonal & Dental Awareness
              </Badge>
            )}
          </div>
        </div>

        <TabsContent value="important-dates">
          <ImportantDatesCalendar onDateSelected={handleImportantDateSelected} />
        </TabsContent>

        <TabsContent value="grid" className="space-y-6">
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                <Calendar className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                {campaigns.length === 0 
                  ? "Create your first campaign to start engaging with referral offices"
                  : "No campaigns match your current filters"
                }
              </p>
              {campaigns.length === 0 && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => setUnifiedCampaignOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    AI Campaign
                  </Button>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Traditional Campaign
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCampaigns.map((campaign) => (
                <Card 
                  key={campaign.id} 
                  className="group cursor-pointer border-border/50 hover:border-border hover:shadow-lg transition-all duration-200"
                  onClick={() => handleCampaignClick(campaign)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-base leading-tight truncate group-hover:text-primary transition-colors">
                          {campaign.name}
                        </h3>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge 
                            variant="secondary" 
                            className="text-xs px-2 py-0.5 bg-muted/80"
                          >
                            {campaign.campaign_type}
                          </Badge>
                          {campaign.campaign_mode === 'unified' && (
                            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary">
                              AI
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className={`text-xs whitespace-nowrap ${
                          campaign.status === 'Completed' ? 'bg-green-50 border-green-200 text-green-700' :
                          campaign.status === 'In Progress' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                          campaign.status === 'Scheduled' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                          'bg-muted/50 border-muted text-muted-foreground'
                        }`}
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {campaign.office_count || 0} offices
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {campaign.planned_delivery_date 
                            ? format(new Date(campaign.planned_delivery_date), 'MMM dd')
                            : 'No date'
                          }
                        </span>
                      </div>
                    </div>
                    
                    {campaign.delivered_count > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>{campaign.delivered_count}/{campaign.office_count}</span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-1.5">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${((campaign.delivered_count || 0) / (campaign.office_count || 1)) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
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

      {/* Important Date Campaign Dialog */}
      <ImportantDateCampaignDialog
        importantDate={selectedImportantDate}
        open={importantDateDialogOpen}
        onOpenChange={setImportantDateDialogOpen}
        onCampaignCreated={handleCampaignCreated}
      />
    </div>
  );
}