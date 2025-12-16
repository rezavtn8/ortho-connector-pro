import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, AlertCircle, Search } from 'lucide-react';
import { DiscoveryWizard } from '@/components/DiscoveryWizard';
import { DiscoveryResults } from '@/components/DiscoveryResults';
import { calculateDistance } from '@/utils/distanceCalculation';

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

interface UserProfile {
  clinic_id: string | null;
  clinic_latitude: number | null;
  clinic_longitude: number | null;
}

export const Discover = () => {
  const [currentSession, setCurrentSession] = useState<DiscoverySession | null>(null);
  const [discoveredOffices, setDiscoveredOffices] = useState<DiscoveredOffice[]>([]);
  const [cacheMetadata, setCacheMetadata] = useState<{ cacheAge?: number; expiresIn?: number } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [weeklyUsage, setWeeklyUsage] = useState({ used: 0, limit: 999 });
  const [canDiscover, setCanDiscover] = useState(true);
  const [nextRefreshDate, setNextRefreshDate] = useState<Date | null>(null);
  const [clinicLocation, setClinicLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  // Load persisted discovery results on mount
  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadWeeklyUsage();
      loadPersistedResults();
    }
  }, [user]);

  // Persist results whenever they change
  useEffect(() => {
    if (currentSession && discoveredOffices.length > 0) {
      localStorage.setItem('discovery_session', JSON.stringify(currentSession));
      localStorage.setItem('discovered_offices', JSON.stringify(discoveredOffices));
      if (cacheMetadata) {
        localStorage.setItem('discovery_cache_metadata', JSON.stringify(cacheMetadata));
      }
    }
  }, [currentSession, discoveredOffices, cacheMetadata]);

  const loadPersistedResults = () => {
    try {
      const sessionStr = localStorage.getItem('discovery_session');
      const officesStr = localStorage.getItem('discovered_offices');
      const cacheStr = localStorage.getItem('discovery_cache_metadata');
      
      if (sessionStr && officesStr) {
        setCurrentSession(JSON.parse(sessionStr));
        setDiscoveredOffices(JSON.parse(officesStr));
        if (cacheStr) {
          setCacheMetadata(JSON.parse(cacheStr));
        }
      }
    } catch (error) {
      console.error('Error loading persisted discovery results:', error);
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

    try {
      // Rate limiting disabled for testing
      setWeeklyUsage({ used: 0, limit: 999 });
      setCanDiscover(true);
      setNextRefreshDate(null);
    } catch (error) {
      console.error('Error loading weekly usage:', error);
    }
  };


  const callGooglePlacesAPI = async (params: DiscoveryParams): Promise<void> => {
    console.log('🚀 callGooglePlacesAPI: Starting with params:', params);
    
    if (!user || !clinicLocation) {
      console.log('❌ callGooglePlacesAPI: Missing user or clinic location');
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.clinic_id) {
        console.log('❌ callGooglePlacesAPI: No clinic_id found');
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

      console.log('📤 callGooglePlacesAPI: Sending request:', requestBody);

      const { data, error } = await supabase.functions.invoke('discover-nearby-offices', {
        body: requestBody
      });

      console.log('📥 callGooglePlacesAPI: Response received:', { 
        success: data?.success, 
        cached: data?.cached,
        officesCount: data?.offices?.length, 
        error 
      });

      if (error) {
        console.error('❌ callGooglePlacesAPI: Function error:', error);
        
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
        console.log('❌ callGooglePlacesAPI: API call failed:', data?.error);
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

      // Success - handle both cached and new results
      const officesCount = data.offices?.length || 0;
      console.log(`✅ callGooglePlacesAPI: Success! ${officesCount} offices found (cached: ${data.cached})`);
      
      // Store cache metadata for display
      if (data.cached && data.cacheAge !== undefined && data.expiresIn !== undefined) {
        setCacheMetadata({
          cacheAge: data.cacheAge,
          expiresIn: data.expiresIn
        });
      } else {
        setCacheMetadata(null);
      }
      
      // Single unified success message
      const newCount = data.newOfficesCount || 0;
      toast({
        title: "Offices Found",
        description: newCount > 0 
          ? `Found ${newCount} new offices nearby`
          : `Found ${officesCount} offices matching your criteria`,
      });

      // Calculate distances for returned offices
      const officesWithDistance = (data.offices || []).map((office: any) => {
        const distance = office.latitude && office.longitude ? calculateDistance(
          clinicLocation.lat, clinicLocation.lng, office.latitude, office.longitude
        ) : undefined;
        
        return { ...office, distance };
      });

      setDiscoveredOffices(officesWithDistance);

      // Create a session object for display
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
      
      if (!data.cached) {
        await loadWeeklyUsage();
      }

    } catch (error) {
      console.error('❌ callGooglePlacesAPI: Exception:', error);
      toast({
        title: "Error",
        description: "Failed to discover offices. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDiscover = async (params: DiscoveryParams, forceRefresh = false) => {
    console.log('🎯 handleDiscover: Starting discovery with params:', params, 'forceRefresh:', forceRefresh);
    setIsLoading(true);
    
    try {
      // Edge function handles all caching - just call it directly
      console.log('🚀 handleDiscover: Calling edge function (handles caching internally)');
      await callGooglePlacesAPI(params);
    } catch (error) {
      console.error('❌ handleDiscover: Exception:', error);
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

  const handleAddToNetwork = (office: DiscoveredOffice) => {
    // This is handled by the DiscoveryResults component
  };

  const handleOfficeAdded = async () => {
    // Refresh the current results to update imported status
    if (currentSession && discoveredOffices.length > 0) {
      const updatedOffices = await Promise.all(
        discoveredOffices.map(async (office) => {
          const { data, error } = await supabase
            .from('discovered_offices')
            .select('imported')
            .eq('id', office.id)
            .single();
          
          if (!error && data) {
            return { ...office, imported: data.imported };
          }
          return office;
        })
      );
      
      setDiscoveredOffices(updatedOffices);
    }
  };

  const handleStartOver = () => {
    console.log('🔄 handleStartOver: Clearing all discovery results and starting fresh');
    setCurrentSession(null);
    setDiscoveredOffices([]);
    setCacheMetadata(null);
    // Clear persisted results
    localStorage.removeItem('discovery_session');
    localStorage.removeItem('discovered_offices');
    localStorage.removeItem('discovery_cache_metadata');
  };

  const handleClearCache = async () => {
    if (!user || !currentSession) return;
    
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.clinic_id) return;

      // Delete cached offices for this search
      await supabase
        .from('discovered_offices')
        .delete()
        .eq('discovered_by', user.id)
        .eq('clinic_id', profile.clinic_id)
        .eq('search_distance', currentSession.search_distance);

      toast({
        title: "Cache Cleared",
        description: "Cached results removed. Ready for a new search.",
      });

      handleStartOver();
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        title: "Error",
        description: "Failed to clear cache",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Search className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Find Offices</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Smart discovery tool to find and connect with dental offices in your area
        </p>
      </div>


      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mb-6">
        {currentSession && (
          <>
            <Button 
              onClick={handleForceRefresh}
              variant="default"
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Searching...' : 'Refresh Results'}
            </Button>
            <Button 
              onClick={handleStartOver}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              New Search
            </Button>
          </>
        )}
      </div>

      {/* Rate Limit Notice */}
      {!canDiscover && nextRefreshDate && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Weekly discovery limit reached. Next discovery available: {nextRefreshDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="animate-fade-in">
        {!currentSession ? (
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
            onAddToNetwork={handleAddToNetwork}
            onOfficeAdded={handleOfficeAdded}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
};