import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { validateGoogleApiKey, testApiKeyValidity, createApiKeyErrorResponse, getApiKeyHealthStatus } from "../_shared/google-api-validation.ts"

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
    const healthStatus = getApiKeyHealthStatus();
    
    return new Response(
      JSON.stringify({
        status: healthStatus.status,
        service: 'google-maps-api-key',
        timestamp: healthStatus.timestamp
      }),
      { 
        status: healthStatus.status === 'healthy' ? 200 : 503,
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
    // Get and validate Google Maps API key
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    console.log(`get-google-maps-key: Processing request [${requestId}]`)
    
    // Perform secure validation
    const validation = validateGoogleApiKey(googleMapsApiKey, requestId);
    if (!validation.isValid) {
      return createApiKeyErrorResponse(validation, requestId, corsHeaders);
    }

    // Optional: Test API key validity (use sparingly to avoid quota usage)
    const testResult = await testApiKeyValidity(googleMapsApiKey!, requestId);
    if (!testResult.isValid) {
      return createApiKeyErrorResponse(testResult, requestId, corsHeaders);
    }

    console.log(`get-google-maps-key: Successfully validated and returning API key [${requestId}]`)
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