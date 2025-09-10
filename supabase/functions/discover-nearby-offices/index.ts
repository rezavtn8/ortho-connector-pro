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

    // Check for cached results first based on search parameters
    const { data: cachedOffices, error: cacheError } = await supabase
      .from('discovered_offices')
      .select('*')
      .eq('discovered_by', user.id)
      .eq('clinic_id', clinic_id)
      .eq('search_distance', distance)
      .eq('search_location_lat', searchLatitude)
      .eq('search_location_lng', searchLongitude)
      .order('fetched_at', { ascending: false });

    // If we have cached results matching these exact parameters, return them
    if (cachedOffices && cachedOffices.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          message: `Found ${cachedOffices.length} cached offices for your search parameters`,
          offices: cachedOffices,
          canRefresh: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const radiusMeters = distance * 1609.34; // Convert miles to meters
    
    console.log(`Using ${search_strategy} search strategy within ${distance} miles (${radiusMeters}m) of ${searchLatitude}, ${searchLongitude}`);
    
    // Perform multiple searches based on strategy
    let allResults = [];
    
    // 1. Primary dentist search
    const dentistUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLatitude},${searchLongitude}&radius=${radiusMeters}&type=dentist&key=${googleApiKey}`;
    console.log('Searching for dentists...');
    const dentistResponse = await fetch(dentistUrl);
    const dentistData = await dentistResponse.json();
    
    if (dentistData.status === 'OK' && dentistData.results) {
      allResults.push(...dentistData.results);
      console.log(`Found ${dentistData.results.length} dentists`);
    }
    
    // 2. Text-based searches for comprehensive strategy
    if (search_strategy === 'comprehensive' || search_strategy === 'specialty') {
      const searchTerms = [
        'dental office',
        'dental clinic',
        'family dentistry',
        'cosmetic dentistry'
      ];
      
      if (include_specialties || search_strategy === 'specialty') {
        searchTerms.push(
          'orthodontics',
          'oral surgery',
          'endodontics', 
          'periodontics',
          'pediatric dentistry',
          'oral surgeon',
          'orthodontist'
        );
      }
      
      for (const term of searchTerms) {
        try {
          const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(term + ' near me')}&location=${searchLatitude},${searchLongitude}&radius=${radiusMeters}&key=${googleApiKey}`;
          console.log(`Searching for: ${term}`);
          const textResponse = await fetch(textSearchUrl);
          const textData = await textResponse.json();
          
          if (textData.status === 'OK' && textData.results) {
            // Filter for dental-related results
            const dentalResults = textData.results.filter(place => {
              const name = place.name.toLowerCase();
              const types = place.types || [];
              return name.includes('dental') || name.includes('dentist') || 
                     name.includes('orthodont') || name.includes('oral') ||
                     types.includes('dentist') || types.includes('doctor');
            });
            allResults.push(...dentalResults);
            console.log(`Found ${dentalResults.length} results for ${term}`);
          }
          
          // Rate limiting - small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error searching for ${term}:`, error);
        }
      }
    }
    
    // Remove duplicates by place_id
    const uniqueResults = [];
    const seenPlaceIds = new Set();
    
    for (const place of allResults) {
      if (place.place_id && !seenPlaceIds.has(place.place_id)) {
        seenPlaceIds.add(place.place_id);
        uniqueResults.push(place);
      }
    }
    
    console.log(`Total unique places found: ${uniqueResults.length}`);
    
    // Create a mock response object for compatibility
    const placesData = {
      status: uniqueResults.length > 0 ? 'OK' : 'ZERO_RESULTS',
      results: uniqueResults
    };

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', placesData);
      throw new Error(`Google Places API error: ${placesData.status}`);
    }

    console.log(`Found ${placesData.results?.length || 0} places from Google`);

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
    const newOffices = [];

    if (placesData.results && placesData.results.length > 0) {
      // Get details for each place to get more complete information
      for (const place of placesData.results) {
        try {
          // Skip if this appears to be the user's own clinic or already exists as a source  
          if (clinic.google_place_id && place.place_id === clinic.google_place_id) {
            console.log(`Skipping own clinic: ${place.name}`);
            continue;
          }

          if (existingPlaceIds.has(place.place_id)) {
            console.log(`Skipping existing source by place_id: ${place.name}`);
            continue;
          }

          if (existingNames.has(place.name.toLowerCase())) {
            console.log(`Skipping existing source by name: ${place.name}`);
            continue;
          }

          const placeAddress = place.vicinity || place.formatted_address;
          if (placeAddress && existingAddresses.has(placeAddress.toLowerCase())) {
            console.log(`Skipping existing source by address: ${place.name}`);
            continue;
          }

          // Skip if it's too close and has similar name (likely same clinic)
          const distanceFromSearch = calculateDistance(
            searchLatitude, searchLongitude,
            place.geometry.location.lat, place.geometry.location.lng
          );
          
          if (clinicName && distanceFromSearch < 0.1) {
            const clinicFirstWord = clinicName.toLowerCase().split(' ')[0];
            if (clinicFirstWord && place.name.toLowerCase().includes(clinicFirstWord)) {
              console.log(`Skipping ${place.name} - appears to be user's own clinic by proximity and name`);
              continue;
            }
          }

          // Get place details for phone and website
          let phone = null;
          let website = null;
          
          if (place.place_id) {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${googleApiKey}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();
            
            if (detailsData.status === 'OK' && detailsData.result) {
              phone = detailsData.result.formatted_phone_number || null;
              website = detailsData.result.website || null;
            }
          }

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
            search_distance: distance,
            search_location_lat: searchLatitude,
            search_location_lng: searchLongitude,
            office_type: inferredType,
            discovery_session_id: session.id
          };

          offices.push(office);
        } catch (error) {
          console.error(`Error processing place ${place.name}:`, error);
          // Continue with other places
        }
      }

      // Insert only new offices (by place_id)
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

        // Filter to only truly new offices (those that were just inserted)
        const existingPlaceIds = new Set();
        const { data: existing } = await supabase
          .from('discovered_offices')
          .select('place_id')
          .eq('clinic_id', clinic_id)
          .eq('discovered_by', user.id);
        
        if (existing) {
          existing.forEach(office => existingPlaceIds.add(office.place_id));
        }

        newOffices.push(...offices.filter(office => !existingPlaceIds.has(office.place_id)));
      }
    }

    console.log(`Successfully processed ${offices.length} offices, ${newOffices.length} were new`);

    // Update session with results count
    await supabase
      .from('discovery_sessions')
      .update({ results_count: offices.length })
      .eq('id', session.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Found ${offices.length} dental offices nearby`,
        newOfficesCount: newOffices.length,
        totalOfficesCount: offices.length,
        offices: offices,
        sessionId: session.id,
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
        error: error.message,
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