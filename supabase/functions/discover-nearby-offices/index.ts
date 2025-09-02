import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { clinic_id } = await req.json();
    if (!clinic_id) {
      throw new Error('clinic_id is required');
    }

    // Get clinic coordinates
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('latitude, longitude, name')
      .eq('id', clinic_id)
      .single();

    if (clinicError || !clinic || !clinic.latitude || !clinic.longitude) {
      throw new Error('Clinic not found or missing coordinates');
    }

    // Enhanced rate limiting security - check multiple conditions  
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    // Check both fetched_at and created_at for more security
    const { data: recentFetches, error: fetchError } = await supabase
      .from('discovered_offices')
      .select('fetched_at, created_at')
      .eq('discovered_by', user.id)
      .or(`fetched_at.gt.${sevenDaysAgo.toISOString()},created_at.gt.${sevenDaysAgo.toISOString()}`)
      .order('fetched_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error checking rate limit:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error checking rate limit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (recentFetches && recentFetches.length > 0) {
      const lastFetch = recentFetches[0];
      const lastFetchDate = new Date(lastFetch.fetched_at || lastFetch.created_at);
      const daysSinceLastFetch = (now.getTime() - lastFetchDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastFetch < 7) {
        const nextRefreshDate = new Date(lastFetchDate.getTime() + (7 * 24 * 60 * 60 * 1000));
        console.log(`Rate limited: ${daysSinceLastFetch.toFixed(2)} days since last fetch, need 7 days`);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Rate limited. You can only refresh office discoveries once every 7 days.',
            nextRefreshDate: nextRefreshDate.toISOString(),
            canRefresh: false,
            daysSinceLastFetch: Math.floor(daysSinceLastFetch * 10) / 10
          }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Call Google Places API
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const radius = 10000; // 10km in meters
    const type = 'dentist';
    
    console.log(`Searching for dentists within ${radius}m of ${clinic.latitude}, ${clinic.longitude}`);
    
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${clinic.latitude},${clinic.longitude}&radius=${radius}&type=${type}&key=${googleApiKey}`;
    
    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

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
          if (place.place_id === clinic.google_place_id) {
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
          const distance = calculateDistance(
            clinic.latitude, clinic.longitude,
            place.geometry.location.lat, place.geometry.location.lng
          );
          
          if (distance < 0.1 && place.name.toLowerCase().includes(clinic.name.toLowerCase().split(' ')[0])) {
            console.log(`Skipping ${place.name} - appears to be user's own clinic by proximity and name`);
            continue;
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
            source: 'google'
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

    return new Response(
      JSON.stringify({
        success: true,
        message: `Found ${offices.length} dental offices nearby`,
        newOfficesCount: newOffices.length,
        totalOfficesCount: offices.length,
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