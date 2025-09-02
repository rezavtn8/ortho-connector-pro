import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, MapPin, Phone, Globe, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader } from '@googlemaps/js-api-loader';

interface ImportedOffice {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
}

interface GooglePlaceMatch {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface OfficeMatchConfirmationProps {
  importedOffices: ImportedOffice[];
  onComplete: (confirmedOffices: ImportedOffice[]) => void;
}

export function OfficeMatchConfirmation({ importedOffices, onComplete }: OfficeMatchConfirmationProps) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Map<string, GooglePlaceMatch | null>>(new Map());
  const [confirmedOffices, setConfirmedOffices] = useState<Set<string>>(new Set());
  const [skippedOffices, setSkippedOffices] = useState<Set<string>>(new Set());
  const [searchingOfficeId, setSearchingOfficeId] = useState<string | null>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load Google Maps first
  useEffect(() => {
    const initGoogleMaps = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        const errorMsg = 'Google Maps API key not found. Please add VITE_GOOGLE_MAPS_API_KEY to your environment variables.';
        console.warn(errorMsg);
        setGoogleMapsError(errorMsg);
        toast({
          title: "Google Maps API Key Missing",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      try {
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places']
        });

        await loader.load();
        setGoogleMapsLoaded(true);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        const errorMsg = 'Failed to load Google Maps. Please check your API key and internet connection.';
        setGoogleMapsError(errorMsg);
        toast({
          title: "Google Maps Loading Error",
          description: errorMsg,
          variant: "destructive",
        });
      }
    };

    initGoogleMaps();
  }, []);

  // Search for matches once Google Maps is loaded
  useEffect(() => {
    if (googleMapsLoaded && importedOffices.length > 0) {
      searchForMatches();
    }
  }, [googleMapsLoaded, importedOffices]);

  const searchForMatches = async () => {
    if (!window.google) {
      toast({
        title: "Google Maps not loaded",
        description: "Please check your Google Maps API key configuration.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
    const newMatches = new Map<string, GooglePlaceMatch | null>();

    for (const office of importedOffices) {
      setSearchingOfficeId(office.id);
      
      try {
        const match = await searchOffice(service, office.name);
        newMatches.set(office.id, match);
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      } catch (error) {
        console.error(`Error searching for ${office.name}:`, error);
        newMatches.set(office.id, null);
      }
    }

    setMatches(newMatches);
    setSearchingOfficeId(null);
    setLoading(false);
  };

  const searchOffice = (service: google.maps.places.PlacesService, officeName: string): Promise<GooglePlaceMatch | null> => {
    return new Promise((resolve) => {
      const request = {
        query: officeName,
        fields: ['place_id', 'name', 'formatted_address', 'formatted_phone_number', 'website', 'rating', 'user_ratings_total', 'geometry'],
      };

      service.textSearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
          const place = results[0];
          resolve({
            place_id: place.place_id!,
            name: place.name!,
            formatted_address: place.formatted_address!,
            formatted_phone_number: place.formatted_phone_number,
            website: place.website,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            geometry: {
              location: {
                lat: place.geometry!.location!.lat(),
                lng: place.geometry!.location!.lng(),
              },
            },
          });
        } else {
          resolve(null);
        }
      });
    });
  };

  const handleConfirm = async (officeId: string) => {
    const match = matches.get(officeId);
    if (!match) return;

    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Get the original office name from the imported data
      const importedOffice = importedOffices.find(o => o.id === officeId);
      const originalName = importedOffice?.name || match.name;
      
      // Check if an office with this name already exists
      const { data: existingOffice } = await supabase
        .from('patient_sources')
        .select('id')
        .eq('name', originalName)
        .eq('created_by', user.id)
        .eq('source_type', 'Office')
        .single();

      if (existingOffice) {
        // Update existing office with Google Places data
        const { error } = await supabase
          .from('patient_sources')
          .update({
            name: match.name,
            address: match.formatted_address,
            phone: match.formatted_phone_number,
            website: match.website,
            latitude: match.geometry.location.lat,
            longitude: match.geometry.location.lng,
            google_place_id: match.place_id,
            google_rating: match.rating,
            last_updated_from_google: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingOffice.id);

        if (error) throw error;
        
        toast({
          title: "Office updated",
          description: `${match.name} has been updated with Google Places data.`,
        });
      } else {
        // Create new office if it doesn't exist
        const { error } = await supabase.from('patient_sources').insert({
          name: match.name,
          address: match.formatted_address,
          phone: match.formatted_phone_number,
          website: match.website,
          latitude: match.geometry.location.lat,
          longitude: match.geometry.location.lng,
          google_place_id: match.place_id,
          google_rating: match.rating,
          last_updated_from_google: new Date().toISOString(),
          source_type: 'Office',
          is_active: true,
          created_by: user.id,
        });

        if (error) throw error;
        
        toast({
          title: "Office confirmed",
          description: `${match.name} has been added to your sources.`,
        });
      }

      setConfirmedOffices(prev => new Set([...prev, officeId]));
    } catch (error) {
      console.error('Error saving office:', error);
      toast({
        title: "Error",
        description: "Failed to save office. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async (officeId: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Get the original office data from imported offices
      const importedOffice = importedOffices.find(o => o.id === officeId);
      if (!importedOffice) return;
      
      // Check if an office with this name already exists
      const { data: existingOffice } = await supabase
        .from('patient_sources')
        .select('id')
        .eq('name', importedOffice.name)
        .eq('created_by', user.id)
        .eq('source_type', 'Office')
        .single();

      if (!existingOffice) {
        // Create office with original imported data
        const { error } = await supabase.from('patient_sources').insert({
          name: importedOffice.name,
          address: importedOffice.address || null,
          phone: importedOffice.phone || null,
          website: importedOffice.website || null,
          source_type: 'Office',
          is_active: true,
          created_by: user.id,
        });

        if (error) throw error;
        
        toast({
          title: "Office added",
          description: `${importedOffice.name} has been added with original data.`,
        });
      }
      
      setSkippedOffices(prev => new Set([...prev, officeId]));
    } catch (error) {
      console.error('Error saving original office:', error);
      toast({
        title: "Error",
        description: "Failed to save office. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleComplete = () => {
    const finalOffices = importedOffices.filter(office => 
      confirmedOffices.has(office.id) || skippedOffices.has(office.id)
    );
    onComplete(finalOffices);
  };

  const pendingOffices = importedOffices.filter(office => 
    !confirmedOffices.has(office.id) && !skippedOffices.has(office.id)
  );

  const reviewLaterOffices = importedOffices.filter(office => 
    skippedOffices.has(office.id)
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Confirm Office Matches</h2>
        <p className="text-muted-foreground mt-2">
          Review and confirm the Google Places matches for your imported offices
        </p>
      </div>

      {/* Google Maps Loading State */}
      {!googleMapsLoaded && !googleMapsError && (
        <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-muted-foreground">Loading Google Maps...</span>
        </div>
      )}

      {/* Google Maps Error State */}
      {googleMapsError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <X className="w-4 h-4" />
            <span className="font-medium">Google Maps Error</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{googleMapsError}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
            className="mr-2"
          >
            Refresh Page
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleComplete()}
          >
            Skip Google Places & Continue
          </Button>
        </div>
      )}

      {/* Search Progress */}
      {googleMapsLoaded && loading && searchingOfficeId && (
        <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">
            Searching for matches... ({importedOffices.findIndex(o => o.id === searchingOfficeId) + 1} of {importedOffices.length})
          </span>
        </div>
      )}

      {/* Only show office matches if Google Maps loaded successfully */}
      {googleMapsLoaded && !googleMapsError && (
        <>
          {/* Pending Confirmations */}
          <div className="space-y-4">
            {pendingOffices.map(office => {
              const match = matches.get(office.id);
              
              return (
                <Card key={office.id} className="border-l-4 border-l-warning">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Original: {office.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {match ? (
                      <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">Suggested Match:</h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{match.name}</span>
                                {match.rating && (
                                  <Badge variant="secondary">
                                    ⭐ {match.rating} ({match.user_ratings_total})
                                  </Badge>
                                )}
                              </div>
                              
                              {match.formatted_address && (
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                                  <span className="text-sm">{match.formatted_address}</span>
                                </div>
                              )}
                              
                              {match.formatted_phone_number && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm">{match.formatted_phone_number}</span>
                                </div>
                              )}
                              
                              {match.website && (
                                <div className="flex items-center gap-2">
                                  <Globe className="w-4 h-4 text-muted-foreground" />
                                  <a 
                                    href={match.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline"
                                  >
                                    {match.website}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">Original Data:</h4>
                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div>Name: {office.name}</div>
                              {office.address && <div>Address: {office.address}</div>}
                              {office.phone && <div>Phone: {office.phone}</div>}
                              {office.website && <div>Website: {office.website}</div>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-4 border-t">
                          <Button 
                            onClick={() => handleConfirm(office.id)}
                            className="flex items-center gap-2"
                            disabled={loading}
                          >
                            <Check className="w-4 h-4" />
                            Confirm Match
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleSkip(office.id)}
                            className="flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Skip
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center py-6 text-muted-foreground">
                          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No Google Places match found</p>
                          <p className="text-sm">The original data will be preserved</p>
                        </div>
                        
                        <div className="flex gap-2 pt-4 border-t">
                          <Button 
                            variant="outline"
                            onClick={() => handleSkip(office.id)}
                            className="flex items-center gap-2 mx-auto"
                          >
                            <Check className="w-4 h-4" />
                            Keep Original
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Review Later Section */}
          {reviewLaterOffices.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Review Later</h3>
              <div className="space-y-2">
                {reviewLaterOffices.map(office => (
                  <Card key={office.id} className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{office.name}</h4>
                          <p className="text-sm text-muted-foreground">Will use original imported data</p>
                        </div>
                        <Badge variant="secondary">Skipped</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Complete Button */}
          {pendingOffices.length === 0 && importedOffices.length > 0 && (
            <div className="flex justify-center pt-6">
              <Button onClick={handleComplete} size="lg">
                Complete Import ({confirmedOffices.size} confirmed, {skippedOffices.size} skipped)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}