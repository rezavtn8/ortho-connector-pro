import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, RefreshCw, Star, Phone, Globe, MapPin, Plus, Check } from 'lucide-react';
import { ImportDiscoveredOfficeDialog } from '@/components/ImportDiscoveredOfficeDialog';

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
}

interface UserProfile {
  clinic_id: string | null;
}

export const Discover = () => {
  const [offices, setOffices] = useState<DiscoveredOffice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOffices, setIsLoadingOffices] = useState(true);
  const [canRefresh, setCanRefresh] = useState(true);
  const [nextRefreshDate, setNextRefreshDate] = useState<Date | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<DiscoveredOffice | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load discovered offices on component mount
  useEffect(() => {
    loadDiscoveredOffices();
  }, []);

  const loadDiscoveredOffices = async () => {
    if (!user) return;
    
    try {
      setIsLoadingOffices(true);
      
      // Get user's clinic_id
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile?.clinic_id) {
        return;
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

      setOffices(data || []);

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

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Discover Nearby Offices</h1>
        <p className="text-muted-foreground">
          Find dental offices in your area and add them to your referring network
        </p>
      </div>

      {/* Discover Button */}
      <div className="mb-6">
        <Button 
          onClick={discoverNearbyOffices}
          disabled={isLoading || !canRefresh}
          className="bg-primary hover:bg-primary/90"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Discover New Offices
        </Button>
        
        {!canRefresh && (
          <p className="text-sm text-muted-foreground mt-2">
            You can refresh once every 7 days to avoid API overuse.
            {nextRefreshDate && ` Next refresh available: ${formatNextRefreshDate()}`}
          </p>
        )}
      </div>

      {/* Offices List */}
      {isLoadingOffices ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2 text-muted-foreground">Loading discovered offices...</span>
        </div>
      ) : offices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No offices discovered yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Discover New Offices" to find dental offices in your area
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {offices.map((office) => (
            <Card key={office.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg leading-tight">{office.name}</CardTitle>
                  {office.imported && (
                    <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                      <Check className="w-3 h-3 mr-1" />
                      Added
                    </Badge>
                  )}
                </div>
                {office.rating && (
                  <div className="mt-2">
                    {renderStars(office.rating)}
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="space-y-3">
                {office.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{office.address}</span>
                  </div>
                )}
                
                {office.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a 
                      href={`tel:${office.phone}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {office.phone}
                    </a>
                  </div>
                )}
                
                {office.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <a 
                      href={office.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline truncate"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
                
                <div className="pt-2">
                  <Button 
                    onClick={() => handleAddToSources(office)}
                    disabled={office.imported}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {office.imported ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Added to Sources
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add to Referring Offices
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