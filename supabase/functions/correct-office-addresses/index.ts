import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface OfficeAddress {
  id: string;
  name: string;
  address: string | null;
}

interface CorrectedAddress {
  id: string;
  original: string | null;
  corrected: string;
  components: {
    street_number?: string;
    route?: string;
    locality?: string;
    administrative_area_level_1?: string;
    postal_code?: string;
    country?: string;
  };
  formatted: string;
  success: boolean;
  error?: string;
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`correct-office-addresses: ${req.method} request [${requestId}]`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get Google Maps API key
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google Maps API key not configured');
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const { officeIds } = await req.json();
    
    if (!Array.isArray(officeIds) || officeIds.length === 0) {
      throw new Error('officeIds must be a non-empty array');
    }

    console.log(`correct-office-addresses: Processing ${officeIds.length} offices [${requestId}]`);

    // Fetch offices from database
    const { data: offices, error: fetchError } = await supabase
      .from('patient_sources')
      .select('id, name, address')
      .in('id', officeIds)
      .eq('source_type', 'Office')
      .eq('created_by', user.id);

    if (fetchError) {
      throw new Error(`Failed to fetch offices: ${fetchError.message}`);
    }

    if (!offices || offices.length === 0) {
      throw new Error('No offices found');
    }

    // Process each office address
    const results: CorrectedAddress[] = [];
    const updates: Array<{ id: string; address: string }> = [];

    for (const office of offices) {
      try {
        if (!office.address) {
          results.push({
            id: office.id,
            original: null,
            corrected: '',
            components: {},
            formatted: '',
            success: false,
            error: 'No address to correct'
          });
          continue;
        }

        // Call Google Geocoding API to validate and get standardized address
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(office.address)}&key=${googleApiKey}`;
        
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();

        if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
          results.push({
            id: office.id,
            original: office.address,
            corrected: office.address,
            components: {},
            formatted: office.address,
            success: false,
            error: `Geocoding failed: ${geocodeData.status}`
          });
          continue;
        }

        const result = geocodeData.results[0];
        const components: CorrectedAddress['components'] = {};

        // Extract address components
        result.address_components.forEach((component: any) => {
          const types = component.types;
          if (types.includes('street_number')) {
            components.street_number = component.long_name;
          } else if (types.includes('route')) {
            components.route = component.long_name;
          } else if (types.includes('locality')) {
            components.locality = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            components.administrative_area_level_1 = component.short_name;
          } else if (types.includes('postal_code')) {
            components.postal_code = component.long_name;
          } else if (types.includes('country')) {
            components.country = component.short_name;
          }
        });

        const correctedAddress = result.formatted_address;

        results.push({
          id: office.id,
          original: office.address,
          corrected: correctedAddress,
          components,
          formatted: correctedAddress,
          success: true
        });

        // Only update if address is different
        if (correctedAddress !== office.address) {
          updates.push({
            id: office.id,
            address: correctedAddress
          });
        }

        // Add delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing office ${office.id}:`, error);
        results.push({
          id: office.id,
          original: office.address,
          corrected: office.address || '',
          components: {},
          formatted: office.address || '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Don't auto-update - return results for review
    console.log(`correct-office-addresses: Processed ${offices.length} offices, ${updates.length} need updates [${requestId}]`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: offices.length,
        needsUpdate: updates.length,
        results: results.map(r => ({
          ...r,
          changed: updates.some(u => u.id === r.id)
        })),
        requestId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error(`correct-office-addresses: Error [${requestId}]:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
