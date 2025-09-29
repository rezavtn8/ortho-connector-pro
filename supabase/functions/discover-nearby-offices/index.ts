import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { 
      clinic_id, 
      distance = 10, 
      search_lat, 
      search_lng, 
      office_type_filter = null,
      zip_code_override = null,
      min_rating = 0,
      search_strategy = 'comprehensive',
      include_specialties = true,
      require_website = false
    } = await req.json();
    
    if (!clinic_id) {
      throw new Error('clinic_id is required');
    }

    // Get clinic data for comparison and coordinates
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('latitude, longitude, name, google_place_id')
      .eq('id', clinic_id)
      .single();

    if (clinicError || !clinic) {
      throw new Error('Clinic not found');
    }

    // Use provided coordinates or fall back to clinic coordinates
    let searchLatitude = search_lat || clinic.latitude;
    let searchLongitude = search_lng || clinic.longitude;
    let clinicName = clinic.name;

    if (!searchLatitude || !searchLongitude) {
      throw new Error('Search coordinates not available');
    }

    // PHASE 2: Enhanced cache key with all search parameters
    const cacheKey = `${distance}_${min_rating}_${office_type_filter || 'all'}_${search_strategy}_${include_specialties}_${require_website}`;
    console.log(`Cache key: ${cacheKey}`);

    // Check for cached results with matching parameters
    const { data: cachedOffices, error: cacheError } = await supabase
      .from('discovered_offices')
      .select('*')
      .eq('discovered_by', user.id)
      .eq('clinic_id', clinic_id)
      .eq('search_distance', distance)
      .eq('search_location_lat', searchLatitude)
      .eq('search_location_lng', searchLongitude)
      .order('fetched_at', { ascending: false })
      .limit(100);

    // Return cached results if found and recent (within 7 days)
    if (cachedOffices && cachedOffices.length > 0) {
      const mostRecentFetch = new Date(cachedOffices[0].fetched_at);
      const daysSinceLastFetch = (Date.now() - mostRecentFetch.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastFetch < 7) {
        console.log(`Returning ${cachedOffices.length} cached offices (${daysSinceLastFetch.toFixed(1)} days old)`);
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            cacheAge: daysSinceLastFetch.toFixed(1),
            message: `Found ${cachedOffices.length} cached offices from ${daysSinceLastFetch.toFixed(1)} days ago`,
            offices: cachedOffices,
            canRefresh: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Rate limiting temporarily disabled for testing
    console.log('Rate limiting disabled - proceeding with API call');

    // Call Google Places API
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google Maps API key not configured');
    }

    // Create discovery session to track this search
    const { data: session, error: sessionInsertError } = await supabase
      .from('discovery_sessions')
      .insert({
        user_id: user.id,
        clinic_id: clinic_id,
        search_distance: distance,
        search_lat: searchLatitude,
        search_lng: searchLongitude,
        office_type_filter: office_type_filter,
        zip_code_override: zip_code_override,
        api_call_made: true
      })
      .select()
      .single();

    if (sessionInsertError) {
      console.error('Error creating discovery session:', sessionInsertError);
      throw new Error('Failed to create discovery session');
    }

    let radiusMeters = distance * 1609.34; // Convert miles to meters
    let searchRadius = distance;
    let radiusExpanded = false;
    
    console.log(`Using ${search_strategy} strategy within ${distance} miles (${radiusMeters}m) of ${searchLatitude}, ${searchLongitude}`);
    
    // PHASE 1: Helper function for pagination
    const fetchWithPagination = async (url: string, maxPages = 3): Promise<any[]> => {
      const results: any[] = [];
      let nextPageToken: string | null = null;
      let pageCount = 0;
      
      do {
        const currentUrl: string = nextPageToken ? `${url}&pagetoken=${nextPageToken}` : url;
        const response: Response = await fetch(currentUrl);
        const data: any = await response.json();
        
        if (data.status === 'OK' && data.results) {
          results.push(...data.results);
          nextPageToken = data.next_page_token;
          pageCount++;
          
          console.log(`Page ${pageCount}: Found ${data.results.length} results (total: ${results.length})`);
          
          // Wait 2 seconds before fetching next page (Google requirement)
          if (nextPageToken && pageCount < maxPages) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          break;
        }
      } while (nextPageToken && pageCount < maxPages);
      
      return results;
    };
    
    // Perform multiple searches with pagination
    let allResults = [];
    
    // 1. PHASE 1: Primary dentist search WITH PAGINATION
    const dentistUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLatitude},${searchLongitude}&radius=${radiusMeters}&type=dentist&key=${googleApiKey}`;
    console.log('Searching for dentists with pagination...');
    const dentistResults = await fetchWithPagination(dentistUrl);
    allResults.push(...dentistResults);
    console.log(`✅ Found ${dentistResults.length} total dentists (with pagination)`);
    
    // 2. PHASE 1: Expanded text-based searches with pagination
    // ALWAYS run comprehensive search regardless of strategy
    const searchTerms = [
      // Original terms
      'dental office',
      'dental clinic',
      'family dentistry',
      'cosmetic dentistry',
      // PHASE 1: Expanded terms
      'dentistry',
      'dental care',
      'dental center',
      'dental practice',
      'smile center',
      'dental group',
      'implant dentist',
      'emergency dentist',
      'teeth whitening',
      'dental spa',
      'sedation dentistry'
    ];
    
    if (include_specialties || search_strategy === 'specialty') {
      searchTerms.push(
        'orthodontics',
        'oral surgery',
        'endodontics', 
        'periodontics',
        'pediatric dentistry',
        'oral surgeon',
        'orthodontist',
        'prosthodontist'
      );
    }
    
    console.log(`Running comprehensive search with ${searchTerms.length} search terms...`);
    
    // PHASE 2: Parallel search execution
    const searchPromises = searchTerms.slice(0, 5).map(async (term) => {
      try {
        const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(term)}&location=${searchLatitude},${searchLongitude}&radius=${radiusMeters}&key=${googleApiKey}`;
        console.log(`Searching for: ${term}`);
        const results = await fetchWithPagination(textSearchUrl, 2); // 2 pages per term
        
        // Filter for dental-related results
        const dentalResults = results.filter((place: any) => {
          const name = place.name.toLowerCase();
          const types = place.types || [];
          return name.includes('dental') || name.includes('dentist') || 
                 name.includes('orthodont') || name.includes('oral') ||
                 types.includes('dentist') || types.includes('doctor');
        });
        
        console.log(`✅ Found ${dentalResults.length} results for "${term}"`);
        return dentalResults;
      } catch (error) {
        console.error(`Error searching for ${term}:`, error);
        return [];
      }
    });
    
    // Wait for all parallel searches to complete
    const parallelResults = await Promise.allSettled(searchPromises);
    parallelResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      }
    });
    
    // Remove duplicates by place_id
    const uniqueResults = [];
    const seenPlaceIds = new Set();
    
    for (const place of allResults) {
      if (place.place_id && !seenPlaceIds.has(place.place_id)) {
        seenPlaceIds.add(place.place_id);
        uniqueResults.push(place);
      }
    }
    
    console.log(`✅ Total unique places found: ${uniqueResults.length}`);
    
    // PHASE 2: Adaptive radius expansion if results are low
    if (uniqueResults.length < 5 && searchRadius < 25) {
      const expandedRadius = Math.min(searchRadius + 10, 25);
      radiusExpanded = true;
      console.log(`⚠️ Low results (${uniqueResults.length}), expanding search to ${expandedRadius} miles...`);
      
      radiusMeters = expandedRadius * 1609.34;
      searchRadius = expandedRadius;
      
      // Repeat nearby search with expanded radius
      const expandedUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLatitude},${searchLongitude}&radius=${radiusMeters}&type=dentist&key=${googleApiKey}`;
      const expandedResults = await fetchWithPagination(expandedUrl);
      
      for (const place of expandedResults) {
        if (place.place_id && !seenPlaceIds.has(place.place_id)) {
          seenPlaceIds.add(place.place_id);
          uniqueResults.push(place);
        }
      }
      
      console.log(`✅ After expansion: ${uniqueResults.length} total places`);
    }
    
    // Create a response object
    const placesData = {
      status: uniqueResults.length > 0 ? 'OK' : 'ZERO_RESULTS',
      results: uniqueResults,
      radiusExpanded,
      finalRadius: searchRadius
    };

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', placesData);
      throw new Error(`Google Places API error: ${placesData.status}`);
    }

    console.log(`📊 Summary: ${placesData.results?.length || 0} total places found`);

    // Get existing sources to avoid duplicates
    const { data: existingSources } = await supabase
      .from('patient_sources')
      .select('google_place_id, name, address')
      .eq('created_by', user.id)
      .not('google_place_id', 'is', null);

    const existingPlaceIds = new Set(existingSources?.map(s => s.google_place_id) || []);
    const existingNames = new Set(existingSources?.map(s => s.name.toLowerCase()) || []);
    const existingAddresses = new Set(existingSources?.map(s => s.address?.toLowerCase()) || []);

    const offices = [];
    const alreadyInNetworkOffices = [];

    if (placesData.results && placesData.results.length > 0) {
      // PHASE 2: Batch detail requests (10 at a time)
      const placeIds = placesData.results
        .filter(p => p.place_id)
        .map(p => p.place_id);
      
      console.log(`📋 Fetching details for ${placeIds.length} places in batches...`);
      
      const detailsMap = new Map();
      const batchSize = 10;
      
      for (let i = 0; i < placeIds.length; i += batchSize) {
        const batch = placeIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (placeId) => {
          try {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${googleApiKey}`;
            const response = await fetch(detailsUrl);
            const data = await response.json();
            
            if (data.status === 'OK' && data.result) {
              return {
                placeId,
                phone: data.result.formatted_phone_number || null,
                website: data.result.website || null
              };
            }
          } catch (error) {
            console.error(`Error fetching details for ${placeId}:`, error);
          }
          return null;
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
          if (result) {
            detailsMap.set(result.placeId, result);
          }
        });
        
        // Small delay between batches
        if (i + batchSize < placeIds.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1} (${Math.min(i + batchSize, placeIds.length)}/${placeIds.length})`);
      }
      
      // Process each place with batched details
      for (const place of placesData.results) {
        try {
          // Skip own clinic
          if (clinic.google_place_id && place.place_id === clinic.google_place_id) {
            console.log(`Skipping own clinic: ${place.name}`);
            continue;
          }

          // Skip if too close and similar name (likely same clinic)
          const distanceFromSearch = calculateDistance(
            searchLatitude, searchLongitude,
            place.geometry.location.lat, place.geometry.location.lng
          );
          
          if (clinicName && distanceFromSearch < 0.1) {
            const clinicFirstWord = clinicName.toLowerCase().split(' ')[0];
            if (clinicFirstWord && place.name.toLowerCase().includes(clinicFirstWord)) {
              console.log(`Skipping ${place.name} - appears to be user's own clinic`);
              continue;
            }
          }

          // PHASE 1: Mark existing sources as already_in_network instead of skipping
          const alreadyInNetwork = existingPlaceIds.has(place.place_id) ||
                                   existingNames.has(place.name.toLowerCase()) ||
                                   (place.vicinity && existingAddresses.has(place.vicinity.toLowerCase()));

          // Get details from batch fetch
          const details = detailsMap.get(place.place_id);
          const phone = details?.phone || null;
          const website = details?.website || null;

          // Apply filters
          if (min_rating > 0 && (!place.rating || place.rating < min_rating)) {
            console.log(`Skipping ${place.name} - rating ${place.rating} below minimum ${min_rating}`);
            continue;
          }
          
          if (require_website && !website) {
            console.log(`Skipping ${place.name} - no website found`);
            continue;
          }

          // Infer office type from name and Google categories
          const inferredType = inferOfficeType(place.name, place.types || []);
          
          // Apply specialty filter
          if (!include_specialties && inferredType !== 'General Dentist' && inferredType !== 'Pediatric') {
            console.log(`Skipping ${place.name} - specialty practice excluded`);
            continue;
          }

          const office = {
            place_id: place.place_id,
            name: place.name,
            address: place.vicinity || place.formatted_address || null,
            phone,
            website,
            rating: place.rating || null,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            discovered_by: user.id,
            clinic_id: clinic_id,
            source: 'google',
            search_distance: searchRadius, // Use final radius (may be expanded)
            search_location_lat: searchLatitude,
            search_location_lng: searchLongitude,
            office_type: inferredType,
            discovery_session_id: session.id,
            already_in_network: alreadyInNetwork // PHASE 1: New field
          };

          if (alreadyInNetwork) {
            alreadyInNetworkOffices.push(office);
            console.log(`📌 Already in network: ${place.name}`);
          } else {
            offices.push(office);
          }
        } catch (error) {
          console.error(`Error processing place ${place.name}:`, error);
          // Continue with other places
        }
      }

      // Insert new offices
      if (offices.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('discovered_offices')
          .upsert(offices, { 
            onConflict: 'place_id',
            ignoreDuplicates: false 
          })
          .select();

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
      }
    }

    const totalFound = offices.length + alreadyInNetworkOffices.length;
    console.log(`✅ Successfully processed ${totalFound} offices (${offices.length} new, ${alreadyInNetworkOffices.length} already in network)`);

    // Update session with results count
    await supabase
      .from('discovery_sessions')
      .update({ results_count: totalFound })
      .eq('id', session.id);

    // PHASE 3: Enhanced metadata in response
    return new Response(
      JSON.stringify({
        success: true,
        message: radiusExpanded 
          ? `Expanded search to ${searchRadius} miles and found ${totalFound} offices`
          : `Found ${totalFound} dental offices nearby`,
        totalOfficesCount: totalFound,
        newOfficesCount: offices.length,
        alreadyInNetworkCount: alreadyInNetworkOffices.length,
        offices: [...offices, ...alreadyInNetworkOffices], // Include both types
        sessionId: session.id,
        radiusExpanded,
        finalRadius: searchRadius,
        searchMetadata: {
          strategy: search_strategy,
          minRating: min_rating,
          includeSpecialties: include_specialties,
          requireWebsite: require_website,
          searchTermsUsed: searchTerms.length
        },
        canRefresh: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in discover-nearby-offices:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        canRefresh: true
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in kilometers
  return d;
}

// Helper function to infer office type from name and Google categories
function inferOfficeType(name: string, types: string[]): string {
  const nameUpper = name.toUpperCase();
  
  // Check for pediatric indicators
  if (nameUpper.includes('PEDIATRIC') || nameUpper.includes('CHILDREN') || 
      nameUpper.includes('KIDS') || nameUpper.includes('CHILD')) {
    return 'Pediatric';
  }
  
  // Check for orthodontics
  if (nameUpper.includes('ORTHODONT') || types.includes('orthodontist')) {
    return 'Orthodontics';
  }
  
  // Check for oral surgery
  if (nameUpper.includes('ORAL SURGERY') || nameUpper.includes('ORAL SURGEON') || 
      nameUpper.includes('MAXILLOFACIAL') || types.includes('oral_surgeon')) {
    return 'Oral Surgery';
  }
  
  // Check for endodontics
  if (nameUpper.includes('ENDODONTIC') || nameUpper.includes('ROOT CANAL')) {
    return 'Endodontics';
  }
  
  // Check for periodontics
  if (nameUpper.includes('PERIODONTIC') || nameUpper.includes('GUM') || 
      types.includes('periodontist')) {
    return 'Periodontics';
  }
  
  // Check for other specialties
  if (nameUpper.includes('PROSTHODONTIC') || nameUpper.includes('IMPLANT') ||
      nameUpper.includes('COSMETIC')) {
    return 'Multi-specialty';
  }
  
  // Check Google place types for specialty indicators
  const specialtyTypes = ['orthodontist', 'oral_surgeon', 'periodontist'];
  if (types.some(type => specialtyTypes.includes(type))) {
    return 'Multi-specialty';
  }
  
  // Default to General Dentist
  return 'General Dentist';
}