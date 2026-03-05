import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    if (claimsError || !claimsData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.user.id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY not configured');
    }

    const body = await req.json();
    const { action, watchlist_entry, place_id } = body;

    // Action: add competitor to watchlist
    if (action === 'add') {
      const { data, error } = await supabase
        .from('competitor_watchlist')
        .upsert({
          user_id: userId,
          google_place_id: watchlist_entry.google_place_id,
          name: watchlist_entry.name,
          address: watchlist_entry.address,
          specialty: watchlist_entry.specialty,
          latitude: watchlist_entry.latitude,
          longitude: watchlist_entry.longitude,
          clinic_id: watchlist_entry.clinic_id || null,
        }, { onConflict: 'user_id,google_place_id' })
        .select()
        .single();

      if (error) throw error;

      // Take an initial snapshot
      const snapshot = await fetchGooglePlaceData(data.google_place_id, GOOGLE_MAPS_API_KEY);
      if (snapshot) {
        await supabase.from('competitor_snapshots').upsert({
          watchlist_id: data.id,
          user_id: userId,
          google_rating: snapshot.rating,
          review_count: snapshot.review_count,
          review_velocity: 0,
          snapshot_date: new Date().toISOString().split('T')[0],
          raw_data: snapshot.raw,
        }, { onConflict: 'watchlist_id,snapshot_date' });
      }

      return new Response(JSON.stringify({ success: true, data, snapshot }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: remove competitor
    if (action === 'remove') {
      await supabase
        .from('competitor_watchlist')
        .delete()
        .eq('id', watchlist_entry.id)
        .eq('user_id', userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: refresh all snapshots for user
    if (action === 'refresh') {
      const { data: watchlist } = await supabase
        .from('competitor_watchlist')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!watchlist || watchlist.length === 0) {
        return new Response(JSON.stringify({ success: true, refreshed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const today = new Date().toISOString().split('T')[0];
      let refreshed = 0;

      for (const entry of watchlist) {
        try {
          const snapshot = await fetchGooglePlaceData(entry.google_place_id, GOOGLE_MAPS_API_KEY);
          if (!snapshot) continue;

          const { data: prevSnapshots } = await supabase
            .from('competitor_snapshots')
            .select('review_count, snapshot_date')
            .eq('watchlist_id', entry.id)
            .order('snapshot_date', { ascending: false })
            .limit(1);

          let velocity = 0;
          if (prevSnapshots && prevSnapshots.length > 0) {
            const prev = prevSnapshots[0];
            const daysDiff = Math.max(1, Math.floor(
              (new Date(today).getTime() - new Date(prev.snapshot_date).getTime()) / (1000 * 60 * 60 * 24)
            ));
            const reviewDiff = (snapshot.review_count || 0) - (prev.review_count || 0);
            velocity = Math.round((reviewDiff / daysDiff) * 7 * 100) / 100;
          }

          await supabase.from('competitor_snapshots').upsert({
            watchlist_id: entry.id,
            user_id: userId,
            google_rating: snapshot.rating,
            review_count: snapshot.review_count,
            review_velocity: velocity,
            snapshot_date: today,
            raw_data: snapshot.raw,
          }, { onConflict: 'watchlist_id,snapshot_date' });

          refreshed++;
        } catch (e) {
          console.error(`Failed to refresh ${entry.name}:`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, refreshed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: search for competitors by specialty near a location
    if (action === 'search') {
      const lat = watchlist_entry?.latitude;
      const lng = watchlist_entry?.longitude;
      const spec = watchlist_entry?.specialty || 'dentist';
      const radiusMeters = ((watchlist_entry?.radius_miles || 10) * 1609.34).toFixed(0);

      // Use keyword for specialty, don't hardcode type=dentist
      const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(spec)}&key=${GOOGLE_MAPS_API_KEY}`;
      
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      const results = (searchData.results || []).map((place: any) => ({
        google_place_id: place.place_id,
        name: place.name,
        address: place.vicinity || place.formatted_address,
        latitude: place.geometry?.location?.lat,
        longitude: place.geometry?.location?.lng,
        google_rating: place.rating,
        review_count: place.user_ratings_total,
        specialty: spec,
      }));

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: suggest competitors from discovered offices
    if (action === 'suggest') {
      const specialty = watchlist_entry?.specialty || 'dentist';

      // Get already-watched place IDs
      const { data: watched } = await supabase
        .from('competitor_watchlist')
        .select('google_place_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      const watchedPlaceIds = (watched || []).map(w => w.google_place_id);

      // Get user's clinic google_place_id to exclude it
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', userId)
        .single();

      let clinicPlaceId: string | null = null;
      if (profile?.clinic_id) {
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('google_place_id')
          .eq('id', profile.clinic_id)
          .single();
        clinicPlaceId = clinicData?.google_place_id || null;
      }

      // Query discovered offices
      const { data: discovered } = await supabase
        .from('discovered_offices')
        .select('id, name, address, google_place_id, google_rating, user_ratings_total, latitude, longitude, office_type, distance_miles')
        .eq('discovered_by', userId)
        .eq('is_active', true)
        .order('distance_miles', { ascending: true })
        .limit(30);

      // Filter: exclude watched/own clinic, use broad dental-family matching
      const excludeIds = new Set(watchedPlaceIds);
      if (clinicPlaceId) excludeIds.add(clinicPlaceId);

      // Dental-family keywords: if any of these appear in the office_type, it's a potential competitor
      const dentalFamily = ['dent', 'ortho', 'endo', 'perio', 'prosth', 'oral', 'maxillo', 'pedodont', 'implant'];
      const specLower = specialty.toLowerCase();
      
      const isDentalSpec = dentalFamily.some(kw => specLower.includes(kw));

      const suggestions = (discovered || [])
        .filter(d => {
          if (excludeIds.has(d.google_place_id)) return false;
          const officeType = (d.office_type || '').toLowerCase();
          
          // If user's specialty is dental-family, match all dental-family offices
          if (isDentalSpec) {
            return dentalFamily.some(kw => officeType.includes(kw)) || officeType === 'unknown';
          }
          
          // Otherwise do flexible matching
          return officeType.includes(specLower) || specLower.includes(officeType) || officeType === 'unknown';
        })
        .slice(0, 10)
        .map(d => ({
          google_place_id: d.google_place_id,
          name: d.name,
          address: d.address,
          latitude: d.latitude,
          longitude: d.longitude,
          google_rating: d.google_rating,
          review_count: d.user_ratings_total,
          specialty,
          distance_miles: d.distance_miles,
        }));

      return new Response(JSON.stringify({ success: true, results: suggestions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in competitor-snapshot:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function fetchGooglePlaceData(placeId: string, apiKey: string) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,types&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.status !== 'OK' || !data.result) return null;

    const result = data.result;
    const recentReviews = (result.reviews || []).filter((r: any) => {
      const reviewDate = new Date(r.time * 1000);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return reviewDate > monthAgo;
    });

    return {
      rating: result.rating || null,
      review_count: result.user_ratings_total || 0,
      recent_reviews: recentReviews.length,
      raw: {
        types: result.types,
        reviews_sample: (result.reviews || []).slice(0, 3).map((r: any) => ({
          rating: r.rating,
          text: r.text?.substring(0, 200),
          time: r.time,
          author: r.author_name,
        })),
      },
    };
  } catch (e) {
    console.error('Failed to fetch place data:', e);
    return null;
  }
}
