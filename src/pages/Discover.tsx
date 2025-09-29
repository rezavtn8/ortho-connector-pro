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
  place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
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
  const [currentSession, setCurrentSession] = useState<DiscoverySession | null>(() => {
    // Restore session from localStorage on component mount
    try {
      const saved = localStorage.getItem('discoverySession');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [discoveredOffices, setDiscoveredOffices] = useState<DiscoveredOffice[]>(() => {
    // Restore offices from localStorage on component mount
    try {
      const saved = localStorage.getItem('discoveredOffices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [weeklyUsage, setWeeklyUsage] = useState({ used: 0, limit: 999 });
  const [canDiscover, setCanDiscover] = useState(true);
  const [nextRefreshDate, setNextRefreshDate] = useState<Date | null>(null);
  const [clinicLocation, setClinicLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  // Persist results to localStorage whenever they change
  useEffect(() => {
    if (currentSession) {
      localStorage.setItem('discoverySession', JSON.stringify(currentSession));
    } else {
      localStorage.removeItem('discoverySession');
    }
  }, [currentSession]);

  useEffect(() => {
    if (discoveredOffices.length > 0) {
      localStorage.setItem('discoveredOffices', JSON.stringify(discoveredOffices));
    } else {
      localStorage.removeItem('discoveredOffices');
    }
  }, [discoveredOffices]);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadWeeklyUsage();
    }
  }, [user]);

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

  const searchCachedOffices = async (params: DiscoveryParams): Promise<{ offices: DiscoveredOffice[]; session: DiscoverySession | null }> => {
    console.log('🔍 searchCachedOffices: Starting search with params:', params);
    
    if (!user || !clinicLocation) {
      console.log('❌ searchCachedOffices: Missing user or clinic location');
      return { offices: [], session: null };
    }

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.clinic_id) {
        console.log('❌ searchCachedOffices: No clinic_id found');
        return { offices: [], session: null };
      }

      // Look for cached offices with matching search parameters
      const { data: offices, error } = await supabase
        .from('discovered_offices')
        .select('*')
        .eq('discovered_by', user.id)
        .eq('clinic_id', profile.clinic_id)
        .eq('search_distance', params.distance)
        .order('fetched_at', { ascending: false });

      console.log(`✅ searchCachedOffices: Found ${offices?.length || 0} cached offices`);

      if (error) {
        console.error('❌ searchCachedOffices: Query error:', error);
        return { offices: [], session: null };
      }

      if (offices && offices.length > 0) {
        // Calculate distances
        const searchLat = clinicLocation.lat;
        const searchLng = clinicLocation.lng;
        
        const officesWithDistance = offices.map(office => {
          const distance = office.lat && office.lng ? calculateDistance(
            searchLat, searchLng, office.lat, office.lng
          ) : undefined;
          
          return { ...office, distance };
        });

        // Get session info from the first office
        const sessionId = offices[0].discovery_session_id;
        let sessionData = null;
        
        if (sessionId) {
          const { data: session } = await supabase
            .from('discovery_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
            
          if (session) {
            sessionData = session as DiscoverySession;
          }
        }

        console.log(`✅ searchCachedOffices: Returning ${officesWithDistance.length} offices with session`);
        return { 
          offices: officesWithDistance as DiscoveredOffice[], 
          session: sessionData 
        };
      }
    } catch (error) {
      console.error('❌ searchCachedOffices: Exception:', error);
    }

    return { offices: [], session: null };
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
      
      if (data.cached) {
        toast({
          title: "Cached Results",
          description: `Found ${officesCount} cached offices from previous search`,
        });
      } else {
        toast({
          title: "Success",
          description: data.newOfficesCount > 0 
            ? `✅ Discovered ${data.newOfficesCount} new dental offices!`
            : `Found ${officesCount} offices matching your criteria`,
        });
      }

      // Calculate distances for returned offices
      const officesWithDistance = (data.offices || []).map((office: any) => {
        const distance = office.lat && office.lng ? calculateDistance(
          clinicLocation.lat, clinicLocation.lng, office.lat, office.lng
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
      // Skip cache check if force refresh is requested
      if (!forceRefresh) {
        console.log('🔍 handleDiscover: Checking for cached results...');
        const { offices: cachedOffices, session: cachedSession } = await searchCachedOffices(params);
        
        if (cachedOffices.length > 0) {
          console.log(`✅ handleDiscover: Found ${cachedOffices.length} cached offices`);
          setDiscoveredOffices(cachedOffices);
          setCurrentSession(cachedSession);
          toast({
            title: "Cached Results",
            description: `Found ${cachedOffices.length} cached offices matching your search parameters. Click "Refresh" to search again.`,
          });
          return;
        }
      } else {
        console.log('🔄 handleDiscover: Force refresh requested, skipping cache check');
      }

      // No rate limiting - directly call API
      console.log('🚀 handleDiscover: Making API call...');
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
    // Clear localStorage as well
    localStorage.removeItem('discoverySession');
    localStorage.removeItem('discoveredOffices');
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