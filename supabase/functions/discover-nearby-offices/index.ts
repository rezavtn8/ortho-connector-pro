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

    // Check rate limiting - last fetch should be more than 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: lastFetch } = await supabase
      .from('discovered_offices')
      .select('fetched_at')
      .eq('clinic_id', clinic_id)
      .eq('discovered_by', user.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (lastFetch && new Date(lastFetch.fetched_at) > sevenDaysAgo) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit: You can refresh once every 7 days',
          canRefresh: false,
          nextRefreshDate: new Date(new Date(lastFetch.fetched_at).getTime() + 7 * 24 * 60 * 60 * 1000)
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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

    const offices = [];
    const newOffices = [];

    if (placesData.results && placesData.results.length > 0) {
      // Get details for each place to get more complete information
      for (const place of placesData.results) {
        try {
          // Skip if it's the same as user's clinic (same name or very close location)
          const distance = calculateDistance(
            clinic.latitude, clinic.longitude,
            place.geometry.location.lat, place.geometry.location.lng
          );
          
          if (distance < 0.1 && place.name.toLowerCase().includes(clinic.name.toLowerCase().split(' ')[0])) {
            console.log(`Skipping ${place.name} - appears to be user's own clinic`);
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