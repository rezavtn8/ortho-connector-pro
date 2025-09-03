import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Loader2, RefreshCw, Star, Phone, Globe, MapPin, Plus, Check, 
  Search, Filter, BarChart3, Map, Grid3X3, Clock, TrendingUp,
  Building2, Users, Calendar, ExternalLink, ArrowUpDown, AlertCircle, Navigation
} from 'lucide-react';
import { ImportDiscoveredOfficeDialog } from '@/components/ImportDiscoveredOfficeDialog';
import { MapView } from '@/components/MapView';
import { DistanceSelector } from '@/components/DistanceSelector';
import { calculateDistance, DistanceOption, DISTANCE_OPTIONS } from '@/utils/distanceCalculation';

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
  discovered_by: string;
  clinic_id: string | null;
  fetched_at: string;
  source: string;
  imported: boolean;
  distance?: number; // Distance from clinic in miles
}

interface UserProfile {
  clinic_id: string | null;
  clinic_latitude: number | null;
  clinic_longitude: number | null;
}

export const Discover = () => {
  const [offices, setOffices] = useState<DiscoveredOffice[]>([]);
  const [filteredOffices, setFilteredOffices] = useState<DiscoveredOffice[]>([]);
  const [clinicLocation, setClinicLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<DistanceOption>(5); // Default to 5 miles
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOffices, setIsLoadingOffices] = useState(true);
  const [canRefresh, setCanRefresh] = useState(true);
  const [nextRefreshDate, setNextRefreshDate] = useState<Date | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<DiscoveredOffice | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'distance' | 'added'>('distance');
  const [filterBy, setFilterBy] = useState<'all' | 'imported' | 'not-imported'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [showNoResultsPrompt, setShowNoResultsPrompt] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load discovered offices on component mount
  useEffect(() => {
    loadDiscoveredOffices();
  }, []);

  // Filter and sort offices when search/filter/distance changes
  useEffect(() => {
    let filtered = offices.filter(office => {
      const matchesSearch = searchQuery === '' || 
        office.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        office.address?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = filterBy === 'all' || 
        (filterBy === 'imported' && office.imported) ||
        (filterBy === 'not-imported' && !office.imported);

      // Distance filtering
      const matchesDistance = !clinicLocation || !office.lat || !office.lng || 
        office.distance === undefined || office.distance <= selectedDistance;

      return matchesSearch && matchesFilter && matchesDistance;
    });

    // Sort offices
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'distance':
          return (a.distance || 0) - (b.distance || 0);
        case 'added':
          return Number(b.imported) - Number(a.imported);
        default:
          return 0;
      }
    });

    setFilteredOffices(filtered);
    
    // Check if we should show the "no results" prompt for Google API search
    setShowNoResultsPrompt(filtered.length === 0 && offices.length > 0);
  }, [offices, searchQuery, sortBy, filterBy, selectedDistance, clinicLocation]);

  const loadDiscoveredOffices = async () => {
    if (!user) return;
    
    try {
      setIsLoadingOffices(true);
      
      // Get user's clinic_id and location
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('clinic_id, clinic_latitude, clinic_longitude')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile?.clinic_id) {
        return;
      }

      // Set clinic location for distance calculations
      if (profile.clinic_latitude && profile.clinic_longitude) {
        setClinicLocation({ lat: profile.clinic_latitude, lng: profile.clinic_longitude });
      }

      // Load discovered offices
      const { data, error } = await supabase
        .from('discovered_offices')
        .select('*')
        .eq('clinic_id', profile.clinic_id)
        .eq('discovered_by', user.id)
        .order('fetched_at', { ascending: false });

      if (error) {
        console.error('Error loading discovered offices:', error);
        return;
      }

      // Calculate distances if clinic location is available
      const officesWithDistance = (data || []).map(office => {
        if (profile.clinic_latitude && profile.clinic_longitude && office.lat && office.lng) {
          const distance = calculateDistance(
            profile.clinic_latitude,
            profile.clinic_longitude,
            office.lat,
            office.lng
          );
          return { ...office, distance };
        }
        return office;
      });

      setOffices(officesWithDistance);

      // Check if user can refresh (rate limiting)
      if (data && data.length > 0) {
        const lastFetch = new Date(data[0].fetched_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        if (lastFetch > sevenDaysAgo) {
          setCanRefresh(false);
          const nextRefresh = new Date(lastFetch.getTime() + 7 * 24 * 60 * 60 * 1000);
          setNextRefreshDate(nextRefresh);
        } else {
          setCanRefresh(true);
          setNextRefreshDate(null);
        }
      }
    } catch (error) {
      console.error('Error in loadDiscoveredOffices:', error);
    } finally {
      setIsLoadingOffices(false);
    }
  };

  const discoverNearbyOffices = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Get user's clinic_id
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile?.clinic_id) {
        toast({
          title: "Error",
          description: "Please set up your clinic information in Settings first.",
          variant: "destructive"
        });
        return;
      }

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('discover-nearby-offices', {
        body: { clinic_id: profile.clinic_id }
      });

      if (error) {
        console.error('Edge function error:', error);
        
        // Handle rate limiting specifically (429 status)
        if (error.message?.includes('Edge Function returned a non-2xx status code')) {
          toast({
            title: "Rate Limited",
            description: "You can only refresh office discoveries once every 7 days.",
            variant: "destructive"
          });
          
          // Force reload to update the UI state
          await loadDiscoveredOffices();
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
        if (data.error?.includes('Rate limit')) {
          setCanRefresh(false);
          if (data.nextRefreshDate) {
            setNextRefreshDate(new Date(data.nextRefreshDate));
          }
          toast({
            title: "Rate Limited",
            description: data.error,
            variant: "destructive"
          });
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
          : `Found ${data.totalOfficesCount} offices (no new ones since last search)`,
      });

      // Reload the offices list
      await loadDiscoveredOffices();

    } catch (error) {
      console.error('Error discovering offices:', error);
      toast({
        title: "Error",
        description: "Failed to discover offices. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToSources = (office: DiscoveredOffice) => {
    setSelectedOffice(office);
    setShowAddDialog(true);
  };

  const handleSourceAdded = async () => {
    if (!selectedOffice) return;

    try {
      // Mark as imported in discovered_offices
      const { error } = await supabase
        .from('discovered_offices')
        .update({ imported: true })
        .eq('id', selectedOffice.id);

      if (error) {
        console.error('Error updating discovered office:', error);
        toast({
          title: "Error",
          description: "Failed to mark office as imported",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      setOffices(prev => prev.map(office => 
        office.id === selectedOffice.id 
          ? { ...office, imported: true }
          : office
      ));

      toast({
        title: "Success",
        description: `✅ ${selectedOffice.name} added to your referring offices!`
      });

    } catch (error) {
      console.error('Error in handleSourceAdded:', error);
    }
    
    setSelectedOffice(null);
    setShowAddDialog(false);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }
    
    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-4 h-4 fill-yellow-400/50 text-yellow-400" />);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-muted-foreground" />);
    }
    
    return (
      <div className="flex items-center gap-1">
        {stars}
        <span className="text-sm text-muted-foreground ml-1">({rating})</span>
      </div>
    );
  };

  const formatNextRefreshDate = () => {
    if (!nextRefreshDate) return '';
    return nextRefreshDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStats = () => {
    const total = offices.length;
    const imported = offices.filter(o => o.imported).length;
    const pending = total - imported;
    const avgRating = offices.length > 0 
      ? offices.reduce((sum, o) => sum + (o.rating || 0), 0) / offices.filter(o => o.rating).length 
      : 0;

    return { total, imported, pending, avgRating };
  };

  const stats = getStats();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent mb-2">
              Discover Network
            </h1>
            <p className="text-muted-foreground">
              Find and connect with dental offices in your area to expand your referral network
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={discoverNearbyOffices}
              disabled={isLoading || !canRefresh}
              className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Discover New Offices
            </Button>
          </div>
        </div>

        {!canRefresh && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Discovery rate limited to once every 7 days to prevent API overuse.
                {nextRefreshDate && ` Next refresh available: ${formatNextRefreshDate()}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Discovered</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Added to Network</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.imported}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-600 rounded-lg">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Pending Review</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Star className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Avg Rating</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search offices by name or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="all">All Offices</SelectItem>
                  <SelectItem value="not-imported">Available to Add</SelectItem>
                  <SelectItem value="imported">Already Added</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-full sm:w-48">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="distance">Sort by Distance</SelectItem>
                  <SelectItem value="rating">Sort by Rating</SelectItem>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="added">Sort by Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                onClick={() => setViewMode('grid')}
                size="sm"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'map' ? 'default' : 'outline'}
                onClick={() => setViewMode('map')}
                size="sm"
              >
                <Map className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Distance Selector */}
          <div className="mt-4 pt-4 border-t">
            <DistanceSelector
              selectedDistance={selectedDistance}
              onDistanceChange={setSelectedDistance}
              officeCount={filteredOffices.length}
            />
          </div>

          {filteredOffices.length !== offices.length && (
            <div className="mt-3 text-sm text-muted-foreground">
              Showing {filteredOffices.length} of {offices.length} offices
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      {isLoadingOffices ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Loading discovered offices...</h3>
            <p className="text-muted-foreground">Please wait while we fetch your network data</p>
          </div>
        </div>
      ) : offices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="mb-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Ready to Expand Your Network?</h3>
                <p className="text-muted-foreground mb-6">
                  Discover dental offices in your area and start building meaningful referral relationships. 
                  Our intelligent discovery system finds practices that align with your specialties.
                </p>
              </div>
              <Button onClick={discoverNearbyOffices} disabled={isLoading || !canRefresh} size="lg" className="bg-gradient-to-r from-primary to-blue-600">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4 mr-2" />
                )}
                Start Discovering Offices
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'map' ? (
        <Card>
          <CardContent className="p-0">
            <div className="h-96">
              <MapView height="100%" />
            </div>
          </CardContent>
        </Card>
      ) : filteredOffices.length === 0 ? (
        showNoResultsPrompt ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="max-w-md mx-auto">
                <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No offices found in this range</h3>
                <p className="text-muted-foreground mb-6">
                  No cached offices found within {DISTANCE_OPTIONS.find(d => d.value === selectedDistance)?.description} of your clinic.
                  Would you like to search Google for new offices in this area?
                </p>
                <div className="flex gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchQuery('');
                      setFilterBy('all');
                      setSelectedDistance(25); // Expand to wider network
                    }}
                  >
                    Expand Search Area
                  </Button>
                  <Button 
                    onClick={discoverNearbyOffices}
                    disabled={isLoading || !canRefresh}
                    className="bg-gradient-to-r from-primary to-blue-600"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Search Google
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No offices match your search</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search terms, filters, or distance range to find offices
              </p>
              <Button variant="outline" onClick={() => {
                setSearchQuery('');
                setFilterBy('all');
                setSelectedDistance(10);
              }}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredOffices.map((office) => (
            <Card key={office.id} className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-l-4 border-l-transparent hover:border-l-primary">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                      {office.name}
                    </CardTitle>
                    {office.rating && (
                      <div className="mt-2">
                        {renderStars(office.rating)}
                      </div>
                    )}
                  </div>
                  {office.imported && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      Added
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
                <CardContent className="space-y-4">
                  {office.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm text-muted-foreground line-clamp-2">{office.address}</span>
                        {office.distance !== undefined && (
                          <div className="flex items-center gap-1 mt-1">
                            <Navigation className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{office.distance} miles away</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    {office.phone && (
                      <Button variant="outline" size="sm" asChild className="h-8 px-2">
                        <a href={`tel:${office.phone}`}>
                          <Phone className="w-3 h-3 mr-1" />
                          Call
                        </a>
                      </Button>
                    )}
                    
                    {office.website && (
                      <Button variant="outline" size="sm" asChild className="h-8 px-2">
                        <a href={office.website} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Website
                        </a>
                      </Button>
                    )}
                  </div>
                  
                  <div className="pt-2 border-t">
                    <Button 
                      onClick={() => handleAddToSources(office)}
                      disabled={office.imported}
                      variant={office.imported ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                    >
                      {office.imported ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Added to Network
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add to Network
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Source Dialog */}
      {showAddDialog && selectedOffice && (
        <ImportDiscoveredOfficeDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSourceAdded={handleSourceAdded}
          prefillData={{
            name: selectedOffice.name,
            address: selectedOffice.address || '',
            phone: selectedOffice.phone || '',
            website: selectedOffice.website || '',
            latitude: selectedOffice.lat,
            longitude: selectedOffice.lng,
            google_place_id: selectedOffice.place_id,
            google_rating: selectedOffice.rating
          }}
        />
      )}
    </div>
  );
};