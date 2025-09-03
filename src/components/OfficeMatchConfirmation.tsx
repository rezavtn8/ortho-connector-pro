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
  // Session-level tracking to prevent duplicates within this import session
  const [sessionOffices, setSessionOffices] = useState<Map<string, string>>(new Map()); // normalizedName -> officeId
  const { toast } = useToast();

  // Enhanced name normalization with professional titles and descriptors
  const normalizeOfficeName = (name: string): string => {
    let normalized = name.toLowerCase();
    
    // Remove professional titles and suffixes
    const titles = [
      'dr\\.?\\s+', 'doctor\\s+', 'dds\\s*', 'dmd\\s*', 'md\\s*', 'phd\\s*',
      'dentist\\s*', 'dental\\s*', 'orthodontist\\s*', 'oral surgeon\\s*',
      'periodontist\\s*', 'endodontist\\s*', 'prosthodontist\\s*'
    ];
    titles.forEach(title => {
      normalized = normalized.replace(new RegExp(title, 'gi'), '');
    });
    
    // Remove location descriptors and separators
    normalized = normalized
      .replace(/:\s*[^,]+$/i, '') // Remove ": Location" at end
      .replace(/-\s*[^,]+$/i, '') // Remove "- Location" at end  
      .replace(/\s*\([^)]*\)\s*/g, '') // Remove parenthetical content
      .replace(/\s*\[[^\]]*\]\s*/g, ''); // Remove bracketed content
    
    // Normalize business entity variations
    const businessTerms = [
      ['group', ''], ['center', ''], ['centre', ''], ['clinic', ''], 
      ['office', ''], ['practice', ''], ['associates', ''], ['assoc', ''],
      ['dental care', ''], ['oral care', ''], ['family', ''], ['general', ''],
      ['cosmetic', ''], ['restorative', ''], ['implant', ''], ['surgery', '']
    ];
    businessTerms.forEach(([term, replacement]) => {
      normalized = normalized.replace(new RegExp(`\\b${term}\\b`, 'gi'), replacement);
    });
    
    // Clean up and normalize
    return normalized
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };

  // Fuzzy string matching for similar names (simple Levenshtein distance)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Enhanced duplicate detection with fuzzy matching and merge-oriented approach
  const findExistingOffice = async (
    officeName: string, 
    googleName?: string, 
    phone?: string, 
    address?: string,
    googlePlaceId?: string
  ): Promise<{ id: string; name: string; shouldMerge: boolean } | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Strategy 1: Check session offices first (exact matches)
      const normalizedOffice = normalizeOfficeName(officeName);
      const normalizedGoogle = googleName ? normalizeOfficeName(googleName) : null;
      
      if (sessionOffices.has(normalizedOffice)) {
        const id = sessionOffices.get(normalizedOffice)!;
        return { id, name: officeName, shouldMerge: false };
      }
      if (normalizedGoogle && sessionOffices.has(normalizedGoogle)) {
        const id = sessionOffices.get(normalizedGoogle)!;
        return { id, name: googleName!, shouldMerge: false };
      }

      // Strategy 2: Google Place ID matching (highest priority)
      if (googlePlaceId) {
        const { data: placeIdMatch } = await supabase
          .from('patient_sources')
          .select('id, name')
          .eq('google_place_id', googlePlaceId)
          .eq('created_by', user.id)
          .eq('source_type', 'Office')
          .maybeSingle();

        if (placeIdMatch) {
          return { id: placeIdMatch.id, name: placeIdMatch.name, shouldMerge: true };
        }
      }

      // Strategy 3: Exact name matches in database
      const namesToCheck = [officeName];
      if (googleName && googleName !== officeName) {
        namesToCheck.push(googleName);
      }

      for (const name of namesToCheck) {
        const { data: exactMatch } = await supabase
          .from('patient_sources')
          .select('id, name')
          .eq('name', name)
          .eq('created_by', user.id)
          .eq('source_type', 'Office')
          .maybeSingle();

        if (exactMatch) {
          return { id: exactMatch.id, name: exactMatch.name, shouldMerge: true };
        }
      }

      // Strategy 4: Get all offices for advanced matching
      const { data: allOffices } = await supabase
        .from('patient_sources')
        .select('id, name, phone, address, google_place_id')
        .eq('created_by', user.id)
        .eq('source_type', 'Office');

      if (!allOffices || allOffices.length === 0) return null;

      // Strategy 5: Fuzzy normalized name matching (80%+ similarity)
      const namesToTest = [normalizedOffice];
      if (normalizedGoogle && normalizedGoogle !== normalizedOffice) {
        namesToTest.push(normalizedGoogle);
      }

      for (const office of allOffices) {
        const existingNormalized = normalizeOfficeName(office.name);
        
        for (const testName of namesToTest) {
          // Exact normalized match
          if (existingNormalized === testName) {
            return { id: office.id, name: office.name, shouldMerge: true };
          }
          
          // Fuzzy match (80%+ similarity)
          const similarity = calculateSimilarity(existingNormalized, testName);
          if (similarity >= 0.8) {
            return { id: office.id, name: office.name, shouldMerge: true };
          }
        }
      }

      // Strategy 6: Phone number matching (if available)
      if (phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          for (const office of allOffices) {
            if (office.phone) {
              const existingCleanPhone = office.phone.replace(/\D/g, '');
              if (existingCleanPhone.length >= 10 && 
                  cleanPhone.slice(-10) === existingCleanPhone.slice(-10)) {
                return { id: office.id, name: office.name, shouldMerge: true };
              }
            }
          }
        }
      }

      // Strategy 7: Address similarity matching (if available)
      if (address && address.length > 10) {
        const normalizedAddress = address.toLowerCase().replace(/[^\w\s]/g, '').trim();
        for (const office of allOffices) {
          if (office.address && office.address.length > 10) {
            const existingNormalizedAddress = office.address.toLowerCase().replace(/[^\w\s]/g, '').trim();
            const addressSimilarity = calculateSimilarity(normalizedAddress, existingNormalizedAddress);
            if (addressSimilarity >= 0.85) {
              return { id: office.id, name: office.name, shouldMerge: true };
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding existing office:', error);
      return null;
    }
  };

  // Load Google Maps first
  useEffect(() => {
    const initGoogleMaps = async () => {
      try {
        // Get API key securely from edge function
        const response = await supabase.functions.invoke('get-google-maps-key');
        if (response.error) {
          const errorMsg = 'Could not get Google Maps API key from server. Please check your internet connection.';
          console.warn(errorMsg, response.error);
          setGoogleMapsError(errorMsg);
          toast({
            title: "API Key Error",
            description: errorMsg,
            variant: "destructive",
          });
          return;
        }

        const apiKey = response.data?.google_maps_api_key;
        if (!apiKey) {
          const errorMsg = 'Google Maps API key not configured on server.';
          console.warn(errorMsg);
          setGoogleMapsError(errorMsg);
          toast({
            title: "API Key Missing",
            description: errorMsg,
            variant: "destructive",
          });
          return;
        }

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
      
      // Get the original office data from imported offices
      const importedOffice = importedOffices.find(o => o.id === officeId);
      if (!importedOffice) return;

      // Enhanced duplicate detection with merge capability
      const existingOffice = await findExistingOffice(
        importedOffice.name, 
        match.name, 
        match.formatted_phone_number,
        match.formatted_address,
        match.place_id
      );

      if (existingOffice) {
        // Merge with existing office - choose the best data from both sources
        const updateData: any = {
          // Use Google Places name if it's more complete, otherwise keep existing
          name: match.name.length > existingOffice.name.length ? match.name : existingOffice.name,
          // Always update with Google Places data when available
          address: match.formatted_address,
          phone: match.formatted_phone_number,
          website: match.website,
          latitude: match.geometry.location.lat,
          longitude: match.geometry.location.lng,
          google_place_id: match.place_id,
          google_rating: match.rating,
          last_updated_from_google: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('patient_sources')
          .update(updateData)
          .eq('id', existingOffice.id);

        if (error) throw error;
        
        // Track in session with multiple name variations
        const normalizedOriginal = normalizeOfficeName(importedOffice.name);
        const normalizedGoogle = normalizeOfficeName(match.name);
        const normalizedFinal = normalizeOfficeName(updateData.name);
        
        setSessionOffices(prev => {
          const updated = new Map(prev);
          updated.set(normalizedOriginal, existingOffice.id);
          updated.set(normalizedGoogle, existingOffice.id);
          updated.set(normalizedFinal, existingOffice.id);
          return updated;
        });
        
        toast({
          title: "Office merged",
          description: `${updateData.name} has been updated with Google Places data.`,
        });
      } else {
        // Create new office with Google Places data
        const { data: newOffice, error } = await supabase
          .from('patient_sources')
          .insert({
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
          })
          .select('id')
          .single();

        if (error) throw error;
        
        // Track in session using multiple name variations
        if (newOffice) {
          const normalizedOriginal = normalizeOfficeName(importedOffice.name);
          const normalizedGoogle = normalizeOfficeName(match.name);
          setSessionOffices(prev => {
            const updated = new Map(prev);
            updated.set(normalizedOriginal, newOffice.id);
            updated.set(normalizedGoogle, newOffice.id);
            return updated;
          });
        }
        
        toast({
          title: "Office created",
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
      
      // Enhanced duplicate detection
      const existingOffice = await findExistingOffice(
        importedOffice.name,
        undefined,
        importedOffice.phone,
        importedOffice.address
      );

      if (!existingOffice) {
        // Create office with original imported data
        const { data: newOffice, error } = await supabase
          .from('patient_sources')
          .insert({
            name: importedOffice.name,
            address: importedOffice.address || null,
            phone: importedOffice.phone || null,
            website: importedOffice.website || null,
            source_type: 'Office',
            is_active: true,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (error) throw error;
        
        // Track in session
        if (newOffice) {
          const normalizedName = normalizeOfficeName(importedOffice.name);
          setSessionOffices(prev => new Map(prev.set(normalizedName, newOffice.id)));
        }
        
        toast({
          title: "Office created",
          description: `${importedOffice.name} has been added with original data.`,
        });
      } else {
        // Office already exists - just track it as processed
        toast({
          title: "Office already exists",
          description: `${importedOffice.name} was already in your sources (merged with existing).`,
        });
      }
      
      setSkippedOffices(prev => new Set([...prev, officeId]));
    } catch (error) {
      console.error('Error processing skipped office:', error);
      toast({
        title: "Error",
        description: "Failed to process office. Please try again.",
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