import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

serve(async (req) => {
  console.log(`get-google-maps-key: ${req.method} request received`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    console.error('get-google-maps-key: Method not allowed:', req.method)
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED' 
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Get the Google Maps API key from environment variables (Supabase secrets)
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    console.log('get-google-maps-key: API key exists:', !!googleMapsApiKey)
    
    if (!googleMapsApiKey) {
      console.error('get-google-maps-key: Google Maps API key not configured in secrets')
      return new Response(
        JSON.stringify({ 
          error: 'Google Maps API key not configured in server secrets. Please contact support.',
          code: 'API_KEY_MISSING',
          success: false
        }),
        { 
          status: 503, // Service Unavailable
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate API key format (basic check)
    if (googleMapsApiKey.length < 20 || !googleMapsApiKey.startsWith('AIza')) {
      console.error('get-google-maps-key: Invalid API key format')
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Google Maps API key configuration',
          code: 'INVALID_API_KEY',
          success: false
        }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('get-google-maps-key: Successfully returning API key')
    return new Response(
      JSON.stringify({ 
        google_maps_api_key: googleMapsApiKey,
        success: true,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('get-google-maps-key: Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error. Please try again later.',
        code: 'INTERNAL_ERROR',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})