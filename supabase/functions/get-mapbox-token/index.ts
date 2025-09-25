import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { handleCorsPreflightRequest, createCorsResponse, validateOrigin, createOriginErrorResponse } from "../_shared/cors-config.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['GET']);
  }

  // Validate origin for browser requests
  const { isValid: originValid, origin } = validateOrigin(req);
  if (!originValid) {
    return createOriginErrorResponse(origin);
  }
  try {
    // Get the Mapbox token from environment variables (Supabase secrets)
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    
    if (!mapboxToken) {
      return createCorsResponse(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' }
        }, req
      )
    }

    return createCorsResponse(
      JSON.stringify({ token: mapboxToken }),
      { 
        headers: { 'Content-Type': 'application/json' }
      }, req
    )

  } catch (error) {
    return createCorsResponse(
      JSON.stringify({ error: (error as Error).message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' }
      }, req
    )
  }
})