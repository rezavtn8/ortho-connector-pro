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
}

interface UserProfile {
  clinic_id: string | null;
  clinic_latitude: number | null;
  clinic_longitude: number | null;
}

export const Discover = () => {
  const [currentSession, setCurrentSession] = useState<DiscoverySession | null>(null);
  const [discoveredOffices, setDiscoveredOffices] = useState<DiscoveredOffice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [weeklyUsage, setWeeklyUsage] = useState({ used: 0, limit: 2 });
  const [canDiscover, setCanDiscover] = useState(true);
  const [nextRefreshDate, setNextRefreshDate] = useState<Date | null>(null);
  const [clinicLocation, setClinicLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

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
        .select('clinic_id, clinic_latitude, clinic_longitude')
        .eq('user_id', user.id)
        .single();

      if (error || !profile?.clinic_id) {
        return;
      }

      if (profile.clinic_latitude && profile.clinic_longitude) {
        setClinicLocation({ 
          lat: profile.clinic_latitude, 
          lng: profile.clinic_longitude 
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadWeeklyUsage = async () => {
    if (!user) return;

    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: sessions, error } = await supabase
        .from('discovery_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('api_call_made', true)
        .gte('created_at', oneWeekAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading weekly usage:', error);
        return;
      }

      const usedCount = sessions?.length || 0;
      setWeeklyUsage({ used: usedCount, limit: 2 });
      setCanDiscover(usedCount < 2);

      if (usedCount >= 2 && sessions && sessions.length > 0) {
        const nextWeek = new Date(sessions[0].created_at);
        nextWeek.setDate(nextWeek.getDate() + 7);
        setNextRefreshDate(nextWeek);
      }
    } catch (error) {
      console.error('Error loading weekly usage:', error);
    }
  };

  const searchCachedOffices = async (params: DiscoveryParams): Promise<{ offices: DiscoveredOffice[]; session: DiscoverySession | null }> => {
    if (!user || !clinicLocation) {
      return { offices: [], session: null };
    }

    // Determine search coordinates
    let searchLat = clinicLocation.lat;
    let searchLng = clinicLocation.lng;

    // TODO: If ZIP code override is provided, geocode it to get lat/lng
    // For now, we'll use clinic location

    try {
      // Look for cached offices with matching search parameters
      const { data: offices, error } = await supabase
        .from('discovered_offices')
        .select(`
          *,
          discovery_sessions!inner(*)
        `)
        .eq('discovered_by', user.id)
        .eq('search_distance', params.distance)
        .eq('search_location_lat', searchLat)
        .eq('search_location_lng', searchLng)
        .order('fetched_at', { ascending: false });

      if (error) {
        console.error('Error searching cached offices:', error);
        return { offices: [], session: null };
      }

      if (offices && offices.length > 0) {
        // Calculate distances and get the session info
        const officesWithDistance = offices.map(office => {
          const distance = office.lat && office.lng ? calculateDistance(
            searchLat, searchLng, office.lat, office.lng
          ) : undefined;
          
          return { ...office, distance };
        });

        // Get the most recent session for these results
        const { data: sessionData } = await supabase
          .from('discovery_sessions')
          .select('*')
          .eq('id', offices[0].discovery_session_id)
          .single();

        return { 
          offices: officesWithDistance as DiscoveredOffice[], 
          session: sessionData as DiscoverySession | null 
        };
      }
    } catch (error) {
      console.error('Error in searchCachedOffices:', error);
    }

    return { offices: [], session: null };
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

      // Determine search coordinates
      let searchLat = clinicLocation.lat;
      let searchLng = clinicLocation.lng;

      const { data, error } = await supabase.functions.invoke('discover-nearby-offices', {
        body: {
          clinic_id: profile.clinic_id,
          distance: params.distance,
          search_lat: searchLat,
          search_lng: searchLng,
          office_type_filter: params.officeType === 'all' ? null : params.officeType,
          zip_code_override: params.zipCode || null
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        
        if (error.message?.includes('Edge Function returned a non-2xx status code')) {
          toast({
            title: "Rate Limited",
            description: "You've reached the weekly discovery limit. Try again next week.",
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

      if (!data.success) {
        if (data.error?.includes('Weekly discovery limit')) {
          toast({
            title: "Rate Limited",
            description: data.error,
            variant: "destructive"
          });
          await loadWeeklyUsage();
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to discover offices",
            variant: "destructive"
          });
        }
        return;
      }

      // Success
      toast({
        title: "Success",
        description: data.newOfficesCount > 0 
          ? `✅ Discovered ${data.newOfficesCount} new dental offices!`
          : `Found ${data.totalOfficesCount} offices matching your criteria`,
      });

      // Calculate distances for returned offices
      const officesWithDistance = (data.offices || []).map((office: any) => {
        const distance = office.lat && office.lng ? calculateDistance(
          searchLat, searchLng, office.lat, office.lng
        ) : undefined;
        
        return { ...office, distance };
      });

      setDiscoveredOffices(officesWithDistance);

      // Create a session object for display
      const session: DiscoverySession = {
        id: data.sessionId,
        search_distance: params.distance,
        search_lat: searchLat,
        search_lng: searchLng,
        office_type_filter: params.officeType,
        zip_code_override: params.zipCode,
        results_count: data.totalOfficesCount,
        api_call_made: true,
        created_at: new Date().toISOString()
      };

      setCurrentSession(session);
      await loadWeeklyUsage();

    } catch (error) {
      console.error('Error in callGooglePlacesAPI:', error);
      toast({
        title: "Error",
        description: "Failed to discover offices. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDiscover = async (params: DiscoveryParams) => {
    setIsLoading(true);
    
    try {
      // First, check for cached results
      const { offices: cachedOffices, session: cachedSession } = await searchCachedOffices(params);
      
      if (cachedOffices.length > 0) {
        setDiscoveredOffices(cachedOffices);
        setCurrentSession(cachedSession);
        toast({
          title: "Cached Results",
          description: `Found ${cachedOffices.length} cached offices matching your search parameters`,
        });
        return;
      }

      // No cached results, check if we can make an API call
      if (!canDiscover) {
        toast({
          title: "Rate Limited",
          description: "You've reached the weekly discovery limit. Try again next week.",
          variant: "destructive"
        });
        return;
      }

      // Prompt user before making API call
      if (window.confirm(`No cached offices found for these parameters. Would you like to search Google Places API?\n\nThis will use 1 of your ${weeklyUsage.limit} weekly discoveries.`)) {
        await callGooglePlacesAPI(params);
      }

    } finally {
      setIsLoading(false);
    }
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
    setCurrentSession(null);
    setDiscoveredOffices([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-2">
              Discovery Assistant
            </h1>
            <p className="text-muted-foreground">
              Smart discovery tool to find and connect with dental offices in your area
            </p>
          </div>
          {currentSession && (
            <Button 
              onClick={handleStartOver}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              New Search
            </Button>
          )}
        </div>

        {!canDiscover && nextRefreshDate && (
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
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
      </div>

      {/* Main Content */}
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
  );
};