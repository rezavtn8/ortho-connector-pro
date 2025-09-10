import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Check, X, MapPin, Phone, Globe, Building2, AlertTriangle, Info, Clock, Shield } from 'lucide-react';
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
  onComplete: (confirmedOffices: ImportedOffice[], sourceMapping: Map<string, string>) => void;
}

export function OfficeMatchConfirmation({ importedOffices, onComplete }: OfficeMatchConfirmationProps) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Map<string, GooglePlaceMatch | null>>(new Map());
  const [confirmedOffices, setConfirmedOffices] = useState<Set<string>>(new Set());
  const [skippedOffices, setSkippedOffices] = useState<Set<string>>(new Set());
  const [searchingOfficeId, setSearchingOfficeId] = useState<string | null>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false); // Prevent multiple searches
  // Session-level tracking to prevent duplicates within this import session
  const [sessionOffices, setSessionOffices] = useState<Map<string, string>>(new Map()); // normalizedName -> officeId
  // Track mapping from original CSV source names to database source IDs
  const [sourceMapping, setSourceMapping] = useState<Map<string, string>>(new Map()); // originalSourceName -> databaseSourceId
  // Enhanced conflict detection and audit tracking
  const [placeIdConflicts, setPlaceIdConflicts] = useState<Map<string, any>>(new Map()); // placeId -> existing office
  const [processingOfficeId, setProcessingOfficeId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<Map<string, any[]>>(new Map()); // officeId -> audit entries
  const { toast } = useToast();

  // Enhanced name normalization with professional titles and descriptors
  const normalizeOfficeName = (name: string): string => {
    let normalized = name.toLowerCase();
    
    // Remove professional titles and suffixes
    const titles = [
      'dr\\.?\\s+', 'doctor\\s+', 'dds\\s*', 'dmd\\s*', 'md\\s*', 'phd\\s*',
      'dentist\\s*', 'dental\\s*', 'orthodontist\\s*', 'oral surgeon\\s*',
      'periodontist\\s*', 'endodontist\\s*', 'prosthodontist\\s*',
      'pc\\s*$', 'pllc\\s*$', 'llc\\s*$', 'inc\\s*$', 'corp\\s*$'
    ];
    titles.forEach(title => {
      normalized = normalized.replace(new RegExp(title, 'gi'), '');
    });
    
    // Remove location descriptors and separators
    normalized = normalized
      .replace(/:\s*[^,]+$/i, '') // Remove ": Location" at end
      .replace(/-\s*[^,]+$/i, '') // Remove "- Location" at end  
      .replace(/\s*\([^)]*\)\s*/g, '') // Remove parenthetical content
      .replace(/\s*\[[^\]]*\]\s*/g, '') // Remove bracketed content
      .replace(/,.*$/i, ''); // Remove everything after first comma (addresses)
    
    // Normalize business entity variations
    const businessTerms = [
      ['group', ''], ['center', ''], ['centre', ''], ['clinic', ''], 
      ['office', ''], ['practice', ''], ['associates', ''], ['assoc', ''],
      ['dental care', ''], ['oral care', ''], ['family', ''], ['general', ''],
      ['cosmetic', ''], ['restorative', ''], ['implant', ''], ['surgery', ''],
      ['medical', ''], ['health', ''], ['wellness', ''], ['care', ''],
      ['& associates', ''], ['and associates', ''], ['pa$', ''], ['p\\.a\\.$', '']
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

  // Generate name variations for better matching
  const generateNameVariations = (name: string): string[] => {
    const variations = new Set<string>();
    const normalized = normalizeOfficeName(name);
    variations.add(normalized);
    variations.add(name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim());
    
    // Add variations without common words
    const words = normalized.split(' ').filter(w => w.length > 2);
    if (words.length > 1) {
      variations.add(words.join(' '));
      // Try first two significant words
      if (words.length >= 2) {
        variations.add(words.slice(0, 2).join(' '));
      }
    }
    
    return Array.from(variations).filter(v => v.length > 2);
  };

  // Enhanced phone number normalization
  const normalizePhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    // Return last 10 digits for US numbers, or full cleaned number
    return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
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

  // Enhanced duplicate detection with comprehensive matching and merge-oriented approach
  const findExistingOffice = async (
    officeName: string, 
    googleName?: string, 
    phone?: string, 
    address?: string,
    googlePlaceId?: string
  ): Promise<any | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      console.log(`[DEBUG] Finding existing office for: "${officeName}", Google: "${googleName}"`);

      // Strategy 1: Check session offices first with all variations
      const officeVariations = generateNameVariations(officeName);
      const googleVariations = googleName ? generateNameVariations(googleName) : [];
      const allVariations = [...officeVariations, ...googleVariations];

      for (const variation of allVariations) {
        if (sessionOffices.has(variation)) {
          const id = sessionOffices.get(variation)!;
          console.log(`[DEBUG] Found in session: "${variation}" -> ${id}`);
          // Get full office data for session match
          const { data: sessionOffice } = await supabase
            .from('patient_sources')
            .select('*')
            .eq('id', id)
            .eq('created_by', user.id)
            .maybeSingle();
          return sessionOffice;
        }
      }

      // Strategy 2: Google Place ID matching (highest priority)
      if (googlePlaceId) {
        const { data: placeIdMatch } = await supabase
          .from('patient_sources')
          .select('*')
          .eq('google_place_id', googlePlaceId)
          .eq('created_by', user.id)
          .eq('source_type', 'Office')
          .maybeSingle();

        if (placeIdMatch) {
          console.log(`[DEBUG] Found by Place ID: ${placeIdMatch.name} (${placeIdMatch.id})`);
          return placeIdMatch;
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
          .select('*')
          .eq('name', name)
          .eq('created_by', user.id)
          .eq('source_type', 'Office')
          .maybeSingle();

        if (exactMatch) {
          console.log(`[DEBUG] Exact name match: ${exactMatch.name} (${exactMatch.id})`);
          return exactMatch;
        }
      }

      // Strategy 4: Get all offices for advanced matching
      const { data: allOffices } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('created_by', user.id)
        .eq('source_type', 'Office');

      if (!allOffices || allOffices.length === 0) return null;

      // Strategy 5: Enhanced name variation matching
      for (const office of allOffices) {
        const existingVariations = generateNameVariations(office.name);
        
        // Check all variations against all variations
        for (const testVariation of allVariations) {
          for (const existingVariation of existingVariations) {
            // Exact normalized match
            if (existingVariation === testVariation) {
              console.log(`[DEBUG] Variation match: "${testVariation}" -> ${office.name} (${office.id})`);
              return office;
            }
            
            // Fuzzy match (85%+ similarity for more precision)
            const similarity = calculateSimilarity(existingVariation, testVariation);
            if (similarity >= 0.85) {
              console.log(`[DEBUG] Fuzzy match: "${testVariation}" ~= "${existingVariation}" (${similarity.toFixed(2)}) -> ${office.name} (${office.id})`);
              return office;
            }
          }
        }
      }

      // Strategy 6: Enhanced phone number matching
      if (phone) {
        const cleanPhone = normalizePhoneNumber(phone);
        if (cleanPhone.length >= 10) {
          for (const office of allOffices) {
            if (office.phone) {
              const existingCleanPhone = normalizePhoneNumber(office.phone);
              if (existingCleanPhone.length >= 10 && cleanPhone === existingCleanPhone) {
                console.log(`[DEBUG] Phone match: ${cleanPhone} -> ${office.name} (${office.id})`);
                return office;
              }
            }
          }
        }
      }

      // Strategy 7: Enhanced address similarity matching
      if (address && address.length > 10) {
        const normalizedAddress = address.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        for (const office of allOffices) {
          if (office.address && office.address.length > 10) {
            const existingNormalizedAddress = office.address.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
            const addressSimilarity = calculateSimilarity(normalizedAddress, existingNormalizedAddress);
            if (addressSimilarity >= 0.85) {
              console.log(`[DEBUG] Address match: "${addressSimilarity.toFixed(2)}" -> ${office.name} (${office.id})`);
              return office;
            }
          }
        }
      }

      console.log(`[DEBUG] No match found for "${officeName}"`);
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
        const response = await supabase.functions.invoke('get-google-maps-key', {
          method: 'GET'
        });
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

  // Enhanced conflict detection for Google Place IDs
  const checkGooglePlaceIdConflict = async (placeId: string, currentOfficeId?: string): Promise<any | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !placeId) return null;

      const { data: existingOffice } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('google_place_id', placeId)
        .eq('created_by', user.id)
        .eq('source_type', 'Office')
        .not('id', 'eq', currentOfficeId || 'null')
        .maybeSingle();

      return existingOffice;
    } catch (error) {
      console.error('Error checking Google Place ID conflict:', error);
      return null;
    }
  };

  // Audit logging function
  const logGooglePlacesAction = async (
    officeId: string,
    placeId: string,
    action: string,
    fieldUpdates?: any,
    oldValues?: any,
    newValues?: any,
    conflictDetails?: any
  ) => {
    try {
      const { error } = await supabase.rpc('log_google_places_update', {
        p_office_id: officeId,
        p_google_place_id: placeId,
        p_action: action,
        p_field_updates: fieldUpdates,
        p_old_values: oldValues,
        p_new_values: newValues,
        p_conflict_details: conflictDetails
      });

      if (error) {
        console.error('Audit logging failed:', error);
      }
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  };

  // Enhanced field comparison - only fill empty fields, preserve CSV data
  const createSafeUpdateData = (existingOffice: any, googleMatch: GooglePlaceMatch) => {
    const safeUpdates: any = {};
    const fieldUpdates: any = {};
    const oldValues: any = {};
    const newValues: any = {};

    // Helper function to check if field is truly empty
    const isEmpty = (value: any) => {
      return value === null || value === undefined || 
             (typeof value === 'string' && value.trim() === '') ||
             (typeof value === 'number' && isNaN(value));
    };

    // CRITICAL: Always preserve the original imported name - NEVER change it
    safeUpdates.name = existingOffice.name;
    console.log(`[DEBUG] Preserving original name: "${existingOffice.name}" (Google suggested: "${googleMatch.name}")`);

    // CRITICAL: Preserve all existing data, only fill truly empty fields

    // Only fill empty fields, never overwrite existing data
    if (isEmpty(existingOffice.address) && googleMatch.formatted_address) {
      safeUpdates.address = googleMatch.formatted_address;
      fieldUpdates.address = 'filled';
      oldValues.address = null;
      newValues.address = googleMatch.formatted_address;
    } else {
      safeUpdates.address = existingOffice.address;
    }

    if (isEmpty(existingOffice.phone) && googleMatch.formatted_phone_number) {
      safeUpdates.phone = googleMatch.formatted_phone_number;
      fieldUpdates.phone = 'filled';
      oldValues.phone = null;
      newValues.phone = googleMatch.formatted_phone_number;
    } else {
      safeUpdates.phone = existingOffice.phone;
    }

    if (isEmpty(existingOffice.website) && googleMatch.website) {
      safeUpdates.website = googleMatch.website;
      fieldUpdates.website = 'filled';
      oldValues.website = null;
      newValues.website = googleMatch.website;
    } else {
      safeUpdates.website = existingOffice.website;
    }

    if (isEmpty(existingOffice.latitude) && googleMatch.geometry.location.lat) {
      safeUpdates.latitude = googleMatch.geometry.location.lat;
      fieldUpdates.latitude = 'filled';
      oldValues.latitude = null;
      newValues.latitude = googleMatch.geometry.location.lat;
    } else {
      safeUpdates.latitude = existingOffice.latitude;
    }

    if (isEmpty(existingOffice.longitude) && googleMatch.geometry.location.lng) {
      safeUpdates.longitude = googleMatch.geometry.location.lng;
      fieldUpdates.longitude = 'filled';
      oldValues.longitude = null;
      newValues.longitude = googleMatch.geometry.location.lng;
    } else {
      safeUpdates.longitude = existingOffice.longitude;
    }

    if (isEmpty(existingOffice.google_place_id)) {
      safeUpdates.google_place_id = googleMatch.place_id;
      fieldUpdates.google_place_id = 'filled';
      oldValues.google_place_id = null;
      newValues.google_place_id = googleMatch.place_id;
    } else {
      safeUpdates.google_place_id = existingOffice.google_place_id;
    }

    if (isEmpty(existingOffice.google_rating) && googleMatch.rating) {
      safeUpdates.google_rating = googleMatch.rating;
      fieldUpdates.google_rating = 'filled';
      oldValues.google_rating = null;
      newValues.google_rating = googleMatch.rating;
    } else {
      safeUpdates.google_rating = existingOffice.google_rating;
    }

    // Always update the timestamp
    safeUpdates.last_updated_from_google = new Date().toISOString();
    safeUpdates.updated_at = new Date().toISOString();

    return {
      updateData: safeUpdates,
      fieldUpdates,
      oldValues,
      newValues,
      hasChanges: Object.keys(fieldUpdates).length > 0
    };
  };

  // Check for existing Google Places links on search
  useEffect(() => {
    if (matches.size > 0) {
      checkForConflicts();
    }
  }, [matches]);

  const checkForConflicts = async () => {
    const conflicts = new Map();
    
    for (const [officeId, match] of matches.entries()) {
      if (match?.place_id) {
        const conflict = await checkGooglePlaceIdConflict(match.place_id);
        if (conflict) {
          conflicts.set(match.place_id, conflict);
        }
      }
    }
    
    setPlaceIdConflicts(conflicts);
  };

  // Search for matches once Google Maps is loaded (run only once)
  useEffect(() => {
    if (googleMapsLoaded && importedOffices.length > 0 && !hasSearched) {
      searchForMatches();
    }
  }, [googleMapsLoaded, importedOffices, hasSearched]);

  const searchForMatches = async () => {
    if (!window.google) {
      toast({
        title: "Google Maps not loaded",
        description: "Please check your Google Maps API key configuration.",
        variant: "destructive",
      });
      return;
    }

    if (hasSearched) {
      console.log('[DEBUG] Search already completed, skipping...');
      return;
    }

    console.log('[DEBUG] Starting Google Places search for', importedOffices.length, 'offices');
    setLoading(true);
    setHasSearched(true); // Mark as searched to prevent re-runs
    
    const service = new window.google.maps.places.PlacesService(document.createElement('div'));
    const newMatches = new Map<string, GooglePlaceMatch | null>();

    for (const office of importedOffices) {
      setSearchingOfficeId(office.id);
      console.log(`[DEBUG] Searching for: "${office.name}"`);
      
      try {
        const match = await searchOffice(service, office.name);
        newMatches.set(office.id, match);
        console.log(`[DEBUG] Search result for "${office.name}":`, match ? match.name : 'No match');
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      } catch (error) {
        console.error(`Error searching for ${office.name}:`, error);
        newMatches.set(office.id, null);
      }
    }

    setMatches(newMatches);
    setSearchingOfficeId(null);
    setLoading(false);
    console.log('[DEBUG] Google Places search completed');
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
      setProcessingOfficeId(officeId);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Get the original office data from imported offices
      const importedOffice = importedOffices.find(o => o.id === officeId);
      if (!importedOffice) return;

      // Step 1: Check for Google Place ID conflicts FIRST
      const placeIdConflict = await checkGooglePlaceIdConflict(match.place_id);
      if (placeIdConflict) {
        await logGooglePlacesAction(
          'conflict', 
          match.place_id, 
          'conflict_detected',
          null,
          null,
          null,
          {
            conflicting_office: placeIdConflict.name,
            conflicting_office_id: placeIdConflict.id,
            attempted_office: importedOffice.name
          }
        );
        
        toast({
          title: "Google Place Conflict",
          description: `This Google Place is already linked to "${placeIdConflict.name}". Please resolve the conflict first.`,
          variant: "destructive",
        });
        return;
      }

      // Step 2: Find existing office using enhanced matching
      const existingOffice = await findExistingOffice(
        importedOffice.name, 
        match.name, 
        match.formatted_phone_number,
        match.formatted_address,
        match.place_id
      );

      if (existingOffice) {
        // Step 3: Create safe update data that only fills empty fields
        const {
          updateData,
          fieldUpdates,
          oldValues,
          newValues,
          hasChanges
        } = createSafeUpdateData(existingOffice, match);

        if (!hasChanges) {
          // No empty fields to fill - log and notify
          await logGooglePlacesAction(
            existingOffice.id,
            match.place_id,
            'confirmed_no_changes',
            {},
            {},
            {},
            { message: 'All fields already populated' }
          );

          toast({
            title: "No updates needed",
            description: `${existingOffice.name} already has all available information.`,
            variant: "default",
          });
        } else {
          // Step 4: Apply safe updates
          const { error } = await supabase
            .from('patient_sources')
            .update(updateData)
            .eq('id', existingOffice.id);

          if (error) {
            if (error.message?.includes('unique_google_place_id')) {
              toast({
                title: "Google Place Already Linked",
                description: "This Google Place is already linked to another office.",
                variant: "destructive",
              });
              return;
            }
            throw error;
          }
          
          // Step 5: Log the update
          await logGooglePlacesAction(
            existingOffice.id,
            match.place_id,
            'updated',
            fieldUpdates,
            oldValues,
            newValues
          );

          // Step 6: Track all name variations in session
          const allVariations = [
            ...generateNameVariations(importedOffice.name),
            ...generateNameVariations(match.name),
            ...generateNameVariations(updateData.name),
            importedOffice.name,
            match.name,
            updateData.name
          ];
          
          setSessionOffices(prev => {
            const updated = new Map(prev);
            allVariations.forEach(variation => {
              if (variation && variation.trim()) {
                updated.set(variation.toLowerCase().trim(), existingOffice.id);
              }
            });
            return updated;
          });

          const filledFields = Object.keys(fieldUpdates);
          toast({
            title: "Office Updated",
            description: `${updateData.name} - Filled ${filledFields.length} empty field(s): ${filledFields.join(', ')}`,
          });
        }

        // Map original CSV source name to existing database source ID
        setSourceMapping(prev => new Map(prev.set(importedOffice.name, existingOffice.id)));
        
        console.log(`[DEBUG] Processed existing office: ${importedOffice.name} -> ${existingOffice.id}`);
        
      } else {
        // Step 7: Create new office with PRESERVED CSV name + Google Places data for empty fields
        const newOfficeData = {
          name: importedOffice.name, // CRITICAL: Always use imported CSV name, never Google name
          address: importedOffice.address || match.formatted_address,
          phone: importedOffice.phone || match.formatted_phone_number,
          website: importedOffice.website || match.website,
          latitude: match.geometry.location.lat,
          longitude: match.geometry.location.lng,
          google_place_id: match.place_id,
          google_rating: match.rating,
          last_updated_from_google: new Date().toISOString(),
          source_type: 'Office' as const,
          is_active: true,
          created_by: user.id,
        };

        console.log(`[DEBUG] Creating new office with preserved CSV name: "${importedOffice.name}" (Google suggested: "${match.name}")`);

        const { data: newOffice, error } = await supabase
          .from('patient_sources')
          .insert(newOfficeData)
          .select('id')
          .single();

        if (error) {
          if (error.message?.includes('unique_google_place_id')) {
            toast({
              title: "Google Place Already Linked",
              description: "This Google Place is already linked to another office.",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }
        
        if (newOffice) {
          // Log the creation with preserved CSV name
          await logGooglePlacesAction(
            newOffice.id,
            match.place_id,
            'confirmed',
            { 
              created: true, 
              preserved_csv_name: importedOffice.name,
              google_suggested_name: match.name 
            },
            {},
            newOfficeData
          );

          // Track all name variations in session
          const allVariations = [
            ...generateNameVariations(importedOffice.name),
            ...generateNameVariations(match.name),
            importedOffice.name,
            match.name
          ];
          
          setSessionOffices(prev => {
            const updated = new Map(prev);
            allVariations.forEach(variation => {
              if (variation && variation.trim()) {
                updated.set(variation.toLowerCase().trim(), newOffice.id);
              }
            });
            return updated;
          });

          // Map original CSV source name to new database source ID
          setSourceMapping(prev => new Map(prev.set(importedOffice.name, newOffice.id)));
          
          console.log(`[DEBUG] Created new office: ${importedOffice.name} -> ${newOffice.id}`);
          
          toast({
            title: "Office Created",
            description: `"${importedOffice.name}" created with Google Places data (address, phone, rating filled).`,
          });
        }
      }

      setConfirmedOffices(prev => new Set([...prev, officeId]));
      
    } catch (error) {
      console.error('Error confirming office:', error);
      
      // Log the error
      await logGooglePlacesAction(
        'error',
        match.place_id,
        'error',
        null,
        null,
        null,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      
      toast({
        title: "Error",
        description: "Failed to confirm office match. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProcessingOfficeId(null);
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
            source_type: 'Office' as const,
            is_active: true,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (error) throw error;
        
        // Track ALL name variations in session
        if (newOffice) {
          const allVariations = [
            ...generateNameVariations(importedOffice.name),
            importedOffice.name // Always include exact original name
          ];
          
          setSessionOffices(prev => {
            const updated = new Map(prev);
            allVariations.forEach(variation => {
              if (variation && variation.trim()) {
                updated.set(variation.toLowerCase().trim(), newOffice.id);
              }
            });
            return updated;
          });
          
          // Map original CSV source name to new database source ID
          setSourceMapping(prev => new Map(prev.set(importedOffice.name, newOffice.id)));
          
          console.log(`[DEBUG] Created new office from skip: ${importedOffice.name} -> ${newOffice.id}`);
        }
        
        toast({
          title: "Office created",
          description: `${importedOffice.name} has been added with original data.`,
        });
      } else {
        // Office already exists - map it so patient data goes to existing office
        setSourceMapping(prev => new Map(prev.set(importedOffice.name, existingOffice.id)));
        
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
    onComplete(finalOffices, sourceMapping);
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

      {/* Search Progress - Show completion status */}
      {googleMapsLoaded && (loading || hasSearched) && (
        <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
          {loading && searchingOfficeId ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">
                Searching for matches... ({importedOffices.findIndex(o => o.id === searchingOfficeId) + 1} of {importedOffices.length})
              </span>
            </>
          ) : hasSearched && !loading ? (
            <>
              <Check className="w-4 h-4 text-green-600 mr-2" />
              <span className="text-sm text-muted-foreground">
                Search completed - Review matches below ({confirmedOffices.size + skippedOffices.size} of {importedOffices.length} processed)
              </span>
            </>
          ) : null}
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
                        {/* Google Place ID Conflict Alert */}
                        {placeIdConflicts.has(match.place_id) && (
                          <Alert className="border-destructive bg-destructive/10">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Google Place Conflict</AlertTitle>
                            <AlertDescription>
                              This Google Place is already linked to "{placeIdConflicts.get(match.place_id)?.name}".
                              You cannot link the same Google Place to multiple offices.
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Side-by-Side Comparison */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-500" />
                            Compare Data Sources:
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            {/* Your CSV Data */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                                <Shield className="w-4 h-4" />
                                Your CSV Data (Will Be Preserved)
                              </div>
                              
                              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg space-y-3">
                                <div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <Building2 className="w-3 h-3" />
                                    Business Name
                                  </div>
                                  <div className="font-medium text-sm">{office.name}</div>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <MapPin className="w-3 h-3" />
                                    Address
                                  </div>
                                  <div className="text-sm">
                                    {office.address || <span className="text-muted-foreground italic">Not provided</span>}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <Phone className="w-3 h-3" />
                                    Phone
                                  </div>
                                  <div className="text-sm">
                                    {office.phone || <span className="text-muted-foreground italic">Not provided</span>}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <Globe className="w-3 h-3" />
                                    Website
                                  </div>
                                  <div className="text-sm">
                                    {office.website || <span className="text-muted-foreground italic">Not provided</span>}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Google Places Data */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                                <span className="text-yellow-500">⭐</span>
                                Google Places Data (To Fill Missing Fields)
                              </div>
                              
                              <div className="p-4 bg-green-50/50 border border-green-200 rounded-lg space-y-3">
                                <div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <Building2 className="w-3 h-3" />
                                    Business Name
                                  </div>
                                  <div className="font-medium text-sm text-muted-foreground">
                                    {match.name} 
                                    <span className="text-xs ml-2 text-orange-600">(will not replace your name)</span>
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <MapPin className="w-3 h-3" />
                                    Address
                                  </div>
                                  <div className="text-sm">
                                    {match.formatted_address ? (
                                      <div>
                                        {match.formatted_address}
                                        {!office.address && (
                                          <Badge variant="outline" className="ml-2 bg-green-100 text-green-700 text-xs">
                                            Will fill empty
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground italic">Not available</span>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <Phone className="w-3 h-3" />
                                    Phone
                                  </div>
                                  <div className="text-sm">
                                    {match.formatted_phone_number ? (
                                      <div>
                                        {match.formatted_phone_number}
                                        {!office.phone && (
                                          <Badge variant="outline" className="ml-2 bg-green-100 text-green-700 text-xs">
                                            Will fill empty
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground italic">Not available</span>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <Globe className="w-3 h-3" />
                                    Website
                                  </div>
                                  <div className="text-sm">
                                    {match.website ? (
                                      <div>
                                        <span className="truncate block max-w-full">{match.website}</span>
                                        {!office.website && (
                                          <Badge variant="outline" className="mt-1 bg-green-100 text-green-700 text-xs">
                                            Will fill empty
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground italic">Not available</span>
                                    )}
                                  </div>
                                </div>

                                {match.rating && (
                                  <div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                      <span className="text-yellow-500">⭐</span>
                                      Google Rating
                                    </div>
                                    <div className="text-sm">
                                      {match.rating} stars ({match.user_ratings_total} reviews)
                                      <Badge variant="outline" className="ml-2 bg-green-100 text-green-700 text-xs">
                                        Will add
                                      </Badge>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Summary of what will happen */}
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-sm font-medium mb-2">What happens when you confirm:</div>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              <li>✓ Your CSV business name "{office.name}" will be preserved</li>
                              <li>✓ Patient count data will be imported to this business</li>
                              <li>✓ Empty fields (address, phone, website) will be filled from Google Places</li>
                              <li>✓ Google rating and location will be added</li>
                            </ul>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-4 border-t">
                          <Button 
                            onClick={() => handleConfirm(office.id)}
                            className="flex items-center gap-2"
                            disabled={loading || processingOfficeId === office.id || placeIdConflicts.has(match.place_id)}
                          >
                            {processingOfficeId === office.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            {placeIdConflicts.has(match.place_id) ? 'Resolve Conflict First' : 'Confirm Match'}
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleSkip(office.id)}
                            className="flex items-center gap-2"
                            disabled={loading || processingOfficeId === office.id}
                          >
                            <X className="w-4 h-4" />
                            Skip Google Places
                          </Button>
                        </div>

                        {/* Processing Indicator */}
                        {processingOfficeId === office.id && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                            <Clock className="w-4 h-4" />
                            <span>Processing office data...</span>
                          </div>
                        )}
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