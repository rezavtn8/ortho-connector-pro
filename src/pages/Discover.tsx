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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50 backdrop-blur-sm">
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

  // Diamond decoration component
  const DiamondDecoration = ({ className = "" }: { className?: string }) => (
    <div className={`absolute w-4 h-4 rotate-45 border border-violet-400/30 dark:border-violet-500/20 ${className}`} />
  );

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Ambient Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-fuchsia-500/5 dark:bg-fuchsia-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Stats Grid with Action Buttons */}
      {discoveredOffices.length > 0 ? (
        <>
          {/* Header Banner with Diamond Pattern */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-purple-500/10 dark:from-violet-600/20 dark:via-fuchsia-600/10 dark:to-purple-600/20 border border-violet-200/50 dark:border-violet-800/30 p-6">
            {/* Diamond Grid Pattern */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-4 left-8 w-3 h-3 rotate-45 bg-violet-400/40 dark:bg-violet-400/30" />
              <div className="absolute top-12 left-24 w-2 h-2 rotate-45 bg-fuchsia-400/30 dark:bg-fuchsia-400/20" />
              <div className="absolute top-6 right-16 w-4 h-4 rotate-45 border-2 border-violet-300/40 dark:border-violet-500/30" />
              <div className="absolute bottom-4 right-32 w-2 h-2 rotate-45 bg-purple-400/40 dark:bg-purple-400/30" />
              <div className="absolute top-1/2 left-1/3 w-3 h-3 rotate-45 border border-fuchsia-300/30 dark:border-fuchsia-500/20" />
            </div>
            
            {/* Gradient Orb */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-violet-400/20 via-fuchsia-400/10 to-transparent rounded-full blur-2xl" />
            
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl blur-lg opacity-40" />
                  <div className="relative p-3 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/25">
                    <Compass className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    Discovery Results
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-violet-700 dark:text-violet-300 border border-violet-300/30 dark:border-violet-600/30">
                      {newOffices.length} new
                    </span>
                  </h2>
                  <p className="text-sm text-muted-foreground">Offices available to add to your network</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleForceRefresh}
                  variant="outline"
                  disabled={isLoading}
                  className="flex items-center gap-2 border-violet-300/50 dark:border-violet-700/50 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Dialog open={showNewSearchDialog} onOpenChange={setShowNewSearchDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white shadow-lg shadow-violet-500/25 border-0">
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
          </div>

          {/* Stats Cards with Glassmorphism */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden border-violet-200/30 dark:border-violet-800/30 bg-gradient-to-br from-white/80 to-violet-50/50 dark:from-violet-950/30 dark:to-fuchsia-950/20 backdrop-blur-sm hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300 group">
              <DiamondDecoration className="top-2 right-2 opacity-50" />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-900/50 dark:to-violet-800/30 group-hover:scale-110 transition-transform">
                    <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">{newOffices.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden border-amber-200/30 dark:border-amber-800/30 bg-gradient-to-br from-white/80 to-amber-50/50 dark:from-amber-950/30 dark:to-orange-950/20 backdrop-blur-sm hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 group">
              <DiamondDecoration className="top-2 right-2 opacity-50 border-amber-400/30 dark:border-amber-500/20" />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-800/30 group-hover:scale-110 transition-transform">
                    <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">High Rated</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">{highRatedOffices.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden border-sky-200/30 dark:border-sky-800/30 bg-gradient-to-br from-white/80 to-sky-50/50 dark:from-sky-950/30 dark:to-blue-950/20 backdrop-blur-sm hover:shadow-lg hover:shadow-sky-500/10 transition-all duration-300 group">
              <DiamondDecoration className="top-2 right-2 opacity-50 border-sky-400/30 dark:border-sky-500/20" />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-100 to-sky-50 dark:from-sky-900/50 dark:to-sky-800/30 group-hover:scale-110 transition-transform">
                    <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">With Website</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">{withWebsite.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden border-emerald-200/30 dark:border-emerald-800/30 bg-gradient-to-br from-white/80 to-emerald-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 backdrop-blur-sm hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 group">
              <DiamondDecoration className="top-2 right-2 opacity-50 border-emerald-400/30 dark:border-emerald-500/20" />
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/50 dark:to-emerald-800/30 group-hover:scale-110 transition-transform">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">{avgRating}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
