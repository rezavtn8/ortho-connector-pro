import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, Search, Plus, Building2, Loader2, MapPin, Star, Globe, Compass } from 'lucide-react';
import { DiscoveryWizard } from '@/components/DiscoveryWizard';
import { DiscoveryResults } from '@/components/DiscoveryResults';
import { SelectionActionBar } from '@/components/SelectionActionBar';
import { BulkAddToNetworkDialog } from '@/components/BulkAddToNetworkDialog';
import { calculateDistance } from '@/utils/distanceCalculation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface DiscoveredOffice {
  id: string;
  google_place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  google_rating: number | null;
  user_ratings_total: number | null;
  latitude: number | null;
  longitude: number | null;
  office_type: string;
  search_distance: number;
  search_location_lat: number;
  search_location_lng: number;
  discovery_session_id: string | null;
  imported: boolean;
  fetched_at: string;
  distance?: number;
}

interface DiscoverySession {
  id: string;
  search_distance: number;
  search_lat: number;
  search_lng: number;
  office_type_filter?: string;
  zip_code_override?: string;
  results_count: number;
  api_call_made: boolean;
  created_at: string;
}

interface DiscoveryParams {
  distance: number;
  zipCode?: string;
  officeType?: string;
  minRating?: number;
  searchStrategy?: string;
  includeSpecialties?: boolean;
  requireWebsite?: boolean;
}

export const Discover = () => {
  const [currentSession, setCurrentSession] = useState<DiscoverySession | null>(null);
  const [discoveredOffices, setDiscoveredOffices] = useState<DiscoveredOffice[]>([]);
  const [cacheMetadata, setCacheMetadata] = useState<{ cacheAge?: number; expiresIn?: number } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(true);
  const [weeklyUsage, setWeeklyUsage] = useState({ used: 0, limit: 999 });
  const [canDiscover, setCanDiscover] = useState(true);
  const [nextRefreshDate, setNextRefreshDate] = useState<Date | null>(null);
  const [clinicLocation, setClinicLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
  const [showNewSearchDialog, setShowNewSearchDialog] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadWeeklyUsage();
      loadDiscoveredOfficesFromDB();
    }
  }, [user]);

  const loadDiscoveredOfficesFromDB = async () => {
    if (!user) return;
    
    setIsLoadingFromDB(true);
    try {
      const { data: offices, error } = await supabase
        .from('discovered_offices')
        .select('*')
        .eq('discovered_by', user.id)
        .order('fetched_at', { ascending: false });

      if (error) throw error;

      if (offices && offices.length > 0) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('clinic_id')
          .eq('user_id', user.id)
          .maybeSingle();

        let clinicLat: number | null = null;
        let clinicLng: number | null = null;

        if (profile?.clinic_id) {
          const { data: clinic } = await supabase
            .from('clinics')
            .select('latitude, longitude')
            .eq('id', profile.clinic_id)
            .maybeSingle();

          if (clinic) {
            clinicLat = clinic.latitude;
            clinicLng = clinic.longitude;
            setClinicLocation({ lat: clinic.latitude!, lng: clinic.longitude! });
          }
        }

        const officesWithDistance = offices.map((office: any) => {
          const distance = office.latitude && office.longitude && clinicLat && clinicLng
            ? calculateDistance(clinicLat, clinicLng, office.latitude, office.longitude)
            : undefined;
          return { ...office, distance };
        });

        setDiscoveredOffices(officesWithDistance);

        const { data: latestSession } = await supabase
          .from('discovery_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSession) {
          setCurrentSession({
            id: latestSession.id,
            search_distance: latestSession.search_distance,
            search_lat: latestSession.search_lat,
            search_lng: latestSession.search_lng,
            office_type_filter: latestSession.office_type_filter || undefined,
            zip_code_override: latestSession.zip_code_override || undefined,
            results_count: latestSession.results_count || 0,
            api_call_made: latestSession.api_call_made || false,
            created_at: latestSession.created_at
          });
        }
      }
    } catch (error) {
      console.error('Error loading discovered offices from DB:', error);
    } finally {
      setIsLoadingFromDB(false);
    }
  };

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !profile?.clinic_id) {
        return;
      }

      const { data: clinic } = await supabase
        .from('clinics')
        .select('latitude, longitude')
        .eq('id', profile.clinic_id)
        .maybeSingle();

      if (clinic?.latitude && clinic?.longitude) {
        setClinicLocation({ 
          lat: clinic.latitude, 
          lng: clinic.longitude 
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadWeeklyUsage = async () => {
    if (!user) return;
    setWeeklyUsage({ used: 0, limit: 999 });
    setCanDiscover(true);
    setNextRefreshDate(null);
  };

  const callGooglePlacesAPI = async (params: DiscoveryParams): Promise<void> => {
    if (!user || !clinicLocation) return;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.clinic_id) {
        toast({
          title: "Error",
          description: "Please set up your clinic information in Settings first.",
          variant: "destructive"
        });
        return;
      }

      const requestBody = {
        clinic_id: profile.clinic_id,
        distance: params.distance,
        search_lat: clinicLocation.lat,
        search_lng: clinicLocation.lng,
        office_type_filter: params.officeType === 'all' ? null : params.officeType,
        zip_code_override: params.zipCode || null,
        min_rating: params.minRating || 0,
        search_strategy: params.searchStrategy || 'comprehensive',
        include_specialties: params.includeSpecialties ?? true,
        require_website: params.requireWebsite ?? false
      };

      const { data, error } = await supabase.functions.invoke('discover-nearby-offices', {
        body: requestBody
      });

      if (error) {
        const errMsg = String((error as any)?.message || '');
        if (errMsg.includes('429') || /rate\s*limit/i.test(errMsg)) {
          toast({
            title: "Rate Limited",
            description: "You've reached the weekly discovery limit. Try again later.",
            variant: "destructive"
          });
          await loadWeeklyUsage();
          return;
        }
        
        toast({
          title: "Error", 
          description: "Failed to discover offices. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (!data?.success) {
        if (data?.error?.includes('Weekly discovery limit')) {
          toast({
            title: "Rate Limited",
            description: data.error,
            variant: "destructive"
          });
          await loadWeeklyUsage();
        } else {
          toast({
            title: "Error",
            description: data?.error || "Failed to discover offices",
            variant: "destructive"
          });
        }
        return;
      }

      const officesCount = data.offices?.length || 0;
      
      if (data.cached && data.cacheAge !== undefined && data.expiresIn !== undefined) {
        setCacheMetadata({
          cacheAge: data.cacheAge,
          expiresIn: data.expiresIn
        });
      } else {
        setCacheMetadata(null);
      }
      
      const newCount = data.newOfficesCount || 0;
      toast({
        title: "Offices Found",
        description: newCount > 0 
          ? `Found ${newCount} new offices nearby`
          : `Found ${officesCount} offices matching your criteria`,
      });

      const officesWithDistance = (data.offices || []).map((office: any) => {
        const distance = office.latitude && office.longitude ? calculateDistance(
          clinicLocation.lat, clinicLocation.lng, office.latitude, office.longitude
        ) : undefined;
        return { ...office, distance };
      });

      setDiscoveredOffices(officesWithDistance);

      const session: DiscoverySession = {
        id: data.sessionId || 'temp-' + Date.now(),
        search_distance: params.distance,
        search_lat: clinicLocation.lat,
        search_lng: clinicLocation.lng,
        office_type_filter: params.officeType === 'all' ? undefined : params.officeType,
        zip_code_override: params.zipCode || undefined,
        results_count: officesCount,
        api_call_made: !data.cached,
        created_at: new Date().toISOString()
      };

      setCurrentSession(session);
      setShowNewSearchDialog(false);
      
      if (!data.cached) {
        await loadWeeklyUsage();
      }

    } catch (error) {
      console.error('Error in callGooglePlacesAPI:', error);
      toast({
        title: "Error",
        description: "Failed to discover offices. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDiscover = async (params: DiscoveryParams, forceRefresh = false) => {
    setIsLoading(true);
    try {
      await callGooglePlacesAPI(params);
    } catch (error) {
      console.error('Error in handleDiscover:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred during discovery",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceRefresh = async () => {
    if (!currentSession) return;
    
    const params: DiscoveryParams = {
      distance: currentSession.search_distance,
      zipCode: currentSession.zip_code_override || undefined,
      officeType: currentSession.office_type_filter || 'all',
      minRating: 0,
      searchStrategy: 'comprehensive',
      includeSpecialties: true,
      requireWebsite: false
    };
    
    await handleDiscover(params, true);
  };

  const handleOfficeAdded = async () => {
    await loadDiscoveredOfficesFromDB();
  };

  const handleStartOver = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('discovered_offices')
        .delete()
        .eq('discovered_by', user.id);
      
      setCurrentSession(null);
      setDiscoveredOffices([]);
      setCacheMetadata(null);
      setSelectedIds([]);
      
      toast({
        title: "Cleared",
        description: "All discovered offices have been removed.",
      });
    } catch (error) {
      console.error('Error clearing discoveries:', error);
      toast({
        title: "Error",
        description: "Failed to clear discoveries",
        variant: "destructive"
      });
    }
  };

  const handleSelectionChange = (ids: string[]) => {
    setSelectedIds(ids);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleBulkAdd = () => {
    setShowBulkAddDialog(true);
  };

  const handleBulkAddComplete = async () => {
    setShowBulkAddDialog(false);
    setSelectedIds([]);
    await loadDiscoveredOfficesFromDB();
  };

  const handleRemoveSelected = async () => {
    if (!user || selectedIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('discovered_offices')
        .delete()
        .in('id', selectedIds)
        .eq('discovered_by', user.id);

      if (error) throw error;

      setDiscoveredOffices(prev => prev.filter(o => !selectedIds.includes(o.id)));
      setSelectedIds([]);
      
      toast({
        title: "Removed",
        description: `${selectedIds.length} office(s) removed from discoveries`,
      });
    } catch (error) {
      console.error('Error removing offices:', error);
      toast({
        title: "Error",
        description: "Failed to remove offices",
        variant: "destructive"
      });
    }
  };

  const selectedOffices = discoveredOffices.filter(o => selectedIds.includes(o.id));
  const selectedNames = selectedOffices.map(o => o.name);

  // Calculate stats
  const newOffices = discoveredOffices.filter(o => !o.imported);
  const highRatedOffices = newOffices.filter(o => (o.google_rating || 0) >= 4.0);
  const withWebsite = newOffices.filter(o => o.website);
  const avgRating = newOffices.length > 0 
    ? (newOffices.reduce((sum, o) => sum + (o.google_rating || 0), 0) / newOffices.filter(o => o.google_rating).length).toFixed(1)
    : '0';

  if (isLoadingFromDB) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Loading Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid with Action Buttons */}
      {discoveredOffices.length > 0 ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
              <Card className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/30 group-hover:scale-105 transition-transform">
                      <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="text-xl font-bold text-foreground">{newOffices.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 group-hover:scale-105 transition-transform">
                      <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">High Rated (4+)</p>
                      <p className="text-xl font-bold text-foreground">{highRatedOffices.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 group-hover:scale-105 transition-transform">
                      <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">With Website</p>
                      <p className="text-xl font-bold text-foreground">{withWebsite.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 group-hover:scale-105 transition-transform">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Rating</p>
                      <p className="text-xl font-bold text-foreground">{avgRating}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 shrink-0">
              <Button 
                onClick={handleForceRefresh}
                variant="outline"
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={showNewSearchDialog} onOpenChange={setShowNewSearchDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground">
                    <Search className="w-4 h-4" />
                    New Search
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>New Discovery Search</DialogTitle>
                  </DialogHeader>
                  <DiscoveryWizard
                    onDiscover={handleDiscover}
                    isLoading={isLoading}
                    weeklyUsage={weeklyUsage}
                    canDiscover={canDiscover}
                    nextRefreshDate={nextRefreshDate}
                    compact
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </>
      ) : null}

      {/* Main Content */}
      {discoveredOffices.length === 0 ? (
        <DiscoveryWizard
          onDiscover={handleDiscover}
          isLoading={isLoading}
          weeklyUsage={weeklyUsage}
          canDiscover={canDiscover}
          nextRefreshDate={nextRefreshDate}
        />
      ) : (
        <DiscoveryResults
          offices={discoveredOffices}
          session={currentSession}
          onAddToNetwork={() => {}}
          onOfficeAdded={handleOfficeAdded}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          onStartOver={handleStartOver}
        />
      )}

      {/* Selection Action Bar */}
      {selectedIds.length > 0 && (
        <SelectionActionBar
          selectedIds={selectedIds}
          selectedNames={selectedNames}
          onClear={handleClearSelection}
          onBulkAdd={handleBulkAdd}
          onRemove={handleRemoveSelected}
          isDiscoveredOffices={true}
        />
      )}

      {/* Bulk Add Dialog */}
      <BulkAddToNetworkDialog
        open={showBulkAddDialog}
        onOpenChange={setShowBulkAddDialog}
        offices={selectedOffices}
        onComplete={handleBulkAddComplete}
      />
    </div>
  );
};
