import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

serve(async (req) => {
  const requestId = crypto.randomUUID()
  console.log(`get-google-maps-key: ${req.method} request received [${requestId}]`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Health check endpoint
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    const isHealthy = !!googleMapsApiKey && googleMapsApiKey.startsWith('AIza')
    
    return new Response(
      JSON.stringify({
        status: isHealthy ? 'healthy' : 'unhealthy',
        service: 'google-maps-api-key',
        timestamp: new Date().toISOString(),
        checks: {
          api_key_present: !!googleMapsApiKey,
          api_key_format_valid: googleMapsApiKey?.startsWith('AIza') || false
        }
      }),
      { 
        status: isHealthy ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  // Only allow GET requests for main endpoint
  if (req.method !== 'GET') {
    console.error(`get-google-maps-key: Method not allowed: ${req.method} [${requestId}]`)
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
        request_id: requestId
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
    
    // Enhanced logging for debugging
    console.log(`get-google-maps-key: Environment check [${requestId}]:`, {
      api_key_exists: !!googleMapsApiKey,
      api_key_length: googleMapsApiKey?.length || 0,
      api_key_prefix: googleMapsApiKey?.substring(0, 4) || 'none',
      all_env_vars: Object.keys(Deno.env.toObject()).filter(key => key.includes('GOOGLE')),
    })
    
    if (!googleMapsApiKey) {
      console.error(`get-google-maps-key: Google Maps API key not configured in secrets [${requestId}]`)
      return new Response(
        JSON.stringify({ 
          error: 'Google Maps API key not configured. Please add the GOOGLE_MAPS_API_KEY secret in your Supabase project settings.',
          code: 'API_KEY_MISSING',
          success: false,
          request_id: requestId,
          help: 'Visit https://supabase.com/dashboard/project/vqkzqwibbcvmdwgqladn/settings/functions to add the secret'
        }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate API key format (enhanced validation)
    if (googleMapsApiKey.length < 20) {
      console.error(`get-google-maps-key: API key too short: ${googleMapsApiKey.length} characters [${requestId}]`)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Google Maps API key: too short',
          code: 'INVALID_API_KEY_LENGTH',
          success: false,
          request_id: requestId
        }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!googleMapsApiKey.startsWith('AIza')) {
      console.error(`get-google-maps-key: Invalid API key format - should start with AIza [${requestId}]`)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Google Maps API key format. Key should start with "AIza"',
          code: 'INVALID_API_KEY_FORMAT',
          success: false,
          request_id: requestId
        }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Test API key validity with a simple request
    try {
      const testResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${googleMapsApiKey}`,
        { 
          signal: AbortSignal.timeout(5000),
          headers: {
            'User-Agent': 'Nexora-Clinic-App/1.0'
          }
        }
      )
      
      if (testResponse.status === 403) {
        console.error(`get-google-maps-key: API key validation failed - forbidden [${requestId}]`)
        return new Response(
          JSON.stringify({ 
            error: 'Google Maps API key is invalid or lacks required permissions',
            code: 'INVALID_API_KEY_FORBIDDEN',
            success: false,
            request_id: requestId
          }),
          { 
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } catch (testError) {
      console.warn(`get-google-maps-key: API key validation test failed (continuing anyway): ${(testError as Error).message} [${requestId}]`)
      // Continue anyway as this might be a network issue
    }

    console.log(`get-google-maps-key: Successfully returning API key [${requestId}]`)
    return new Response(
      JSON.stringify({ 
        google_maps_api_key: googleMapsApiKey,
        success: true,
        timestamp: new Date().toISOString(),
        request_id: requestId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error(`get-google-maps-key: Unexpected error [${requestId}]:`, error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error. Please try again later.',
        code: 'INTERNAL_ERROR',
        success: false,
        request_id: requestId
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})