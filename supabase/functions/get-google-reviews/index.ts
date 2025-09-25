import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateGoogleApiKey, createApiKeyErrorResponse, getApiKeyHealthStatus } from "../_shared/google-api-validation.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

interface GoogleReview {
  author_name: string
  author_url?: string
  profile_photo_url?: string
  rating: number
  relative_time_description: string
  text: string
  time: number
  language?: string
}

interface GooglePlaceDetails {
  result: {
    reviews?: GoogleReview[]
    rating?: number
    user_ratings_total?: number
  }
  status: string
  error_message?: string
}

interface GoogleErrorResponse {
  status: string
  error_message: string
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID()
  console.log(`get-google-reviews: ${req.method} request received [${requestId}]`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Health check endpoint
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
    const healthStatus = getApiKeyHealthStatus();
    
    return new Response(
      JSON.stringify({
        status: healthStatus.status,
        service: 'google-reviews',
        timestamp: healthStatus.timestamp
      }),
      { 
        status: healthStatus.status === 'healthy' ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  // Only allow POST requests for main endpoint
  if (req.method !== 'POST') {
    console.error(`get-google-reviews: Method not allowed: ${req.method} [${requestId}]`)
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
        success: false,
        request_id: requestId
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const requestBody = await req.json()
    const { place_id } = requestBody
    console.log(`get-google-reviews: Processing place_id: ${place_id} [${requestId}]`)
    
    if (!place_id || typeof place_id !== 'string') {
      console.error(`get-google-reviews: Invalid place_id provided [${requestId}]`)
      return new Response(
        JSON.stringify({
          error: 'Valid Place ID is required',
          code: 'INVALID_PLACE_ID',
          success: false,
          request_id: requestId
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Get and validate Google Maps API key
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    console.log(`get-google-reviews: Processing request for place_id: ${place_id} [${requestId}]`)
    
    // Perform secure validation
    const validation = validateGoogleApiKey(googleApiKey, requestId);
    if (!validation.isValid) {
      return createApiKeyErrorResponse(validation, requestId, corsHeaders);
    }

    // Fetch place details including reviews with timeout and retry logic
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=reviews,rating,user_ratings_total&key=${googleApiKey}`
    console.log(`get-google-reviews: Making secure Google API request [${requestId}]`)
    
    // Retry logic for network issues
    const maxRetries = 2
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {  
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Nexora-Clinic-Reviews/1.0',
            'Accept': 'application/json',
            'Referer': 'https://vqkzqwibbcvmdwgqladn.supabase.co'
          }
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          console.error(`get-google-reviews: HTTP error from Google API: ${response.status} ${response.statusText} [${requestId}] (attempt ${attempt})`)
          
          // Don't retry on certain error codes
          if (response.status === 403) {
            return new Response(
              JSON.stringify({
                error: 'Google Maps API key is invalid or lacks required permissions. Please ensure the key has Places API enabled.',
                code: 'FORBIDDEN_API_KEY',
                success: false,
                request_id: requestId
              }),
              {
                status: 503,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            )
          }
          
          if (response.status === 400) {
            return new Response(
              JSON.stringify({
                error: `Google API bad request: ${response.statusText}`,
                code: 'GOOGLE_API_BAD_REQUEST',
                success: false,
                request_id: requestId
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            )
          }
          
          if (response.status === 429) {
            return new Response(
              JSON.stringify({
                error: 'Google API rate limit exceeded. Please try again later.',
                code: 'RATE_LIMIT_EXCEEDED',
                success: false,
                request_id: requestId
              }),
              {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            )
          }
          
          // For 5xx errors, try again if we have attempts left
          if (attempt < maxRetries && response.status >= 500) {
            console.log(`get-google-reviews: Retrying after server error (attempt ${attempt + 1}/${maxRetries}) [${requestId}]`)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
            continue
          }
          
          return new Response(
            JSON.stringify({
              error: `Google API returned ${response.status}: ${response.statusText}`,
              code: 'GOOGLE_API_HTTP_ERROR',
              success: false,
              request_id: requestId
            }),
            {
              status: 502, // Bad Gateway
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }

        const data: GooglePlaceDetails | GoogleErrorResponse = await response.json()
        console.log(`get-google-reviews: Google API response status: ${(data as any).status} [${requestId}]`)

        // Handle Google Places API specific errors
        if (data.status !== 'OK') {
          const errorMessage = data.error_message || `Google Places API error: ${data.status}`
          console.error(`get-google-reviews: Google Places API error: ${data.status} ${errorMessage} [${requestId}]`)
          
          let userMessage = 'Failed to fetch reviews from Google Places API'
          let statusCode = 502
          
          switch (data.status) {
            case 'INVALID_REQUEST':
              userMessage = 'Invalid Place ID provided'
              statusCode = 400
              break
            case 'NOT_FOUND':
              userMessage = 'Place not found in Google Places database'
              statusCode = 404
              break
            case 'ZERO_RESULTS':
              userMessage = 'No reviews found for this place'
              break
            case 'OVER_QUERY_LIMIT':
              userMessage = 'Google API quota exceeded. Please try again later.'
              statusCode = 429
              break
            case 'REQUEST_DENIED':
              userMessage = 'Google API access denied. Please check API key configuration.'
              statusCode = 403
              break
          }

          return new Response(
            JSON.stringify({
              error: userMessage,
              code: `GOOGLE_API_${data.status}`,
              google_status: data.status,
              success: false,
              request_id: requestId
            }),
            {
              status: statusCode,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }

        // Successful response - transform the reviews
        const placeData = data as GooglePlaceDetails
        const reviews = (placeData.result.reviews || []).map((review, index) => ({
          ...review,
          google_review_id: `${place_id}_${review.time}_${index}`, // Create unique ID
          place_id
        }))

        console.log(`get-google-reviews: Successfully fetched ${reviews.length} reviews [${requestId}]`)
        
        return new Response(
          JSON.stringify({
            reviews,
            place_rating: placeData.result.rating,
            total_reviews: placeData.result.user_ratings_total,
            success: true,
            timestamp: new Date().toISOString(),
            request_id: requestId
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )

      } catch (fetchError) {
        clearTimeout(timeoutId)
        lastError = fetchError as Error
        
        if ((fetchError as Error).name === 'AbortError') {
          console.error(`get-google-reviews: Request timeout (attempt ${attempt}) [${requestId}]`)
          if (attempt < maxRetries) {
            console.log(`get-google-reviews: Retrying after timeout (attempt ${attempt + 1}/${maxRetries}) [${requestId}]`)
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
            continue
          }
          
          return new Response(
            JSON.stringify({
              error: 'Request timeout. Google API is taking too long to respond after multiple attempts.',
              code: 'REQUEST_TIMEOUT',
              success: false,
              request_id: requestId
            }),
            {
              status: 504,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }
        
        // For other network errors, retry if we have attempts left
        if (attempt < maxRetries) {
          console.log(`get-google-reviews: Retrying after network error (attempt ${attempt + 1}/${maxRetries}) [${requestId}]`)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        
        // All retries exhausted
        break
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('All retry attempts failed')

  } catch (error) {
    console.error(`get-google-reviews: Unexpected error [${requestId}]:`, error)
    
    let errorMessage = 'Internal server error while fetching reviews'
    let statusCode = 500
    
    if ((error as Error).message.includes('JSON')) {
      errorMessage = 'Invalid request format'
      statusCode = 400
    }
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        code: 'INTERNAL_ERROR',
        success: false,
        details: (error as Error).message,
        request_id: requestId
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})