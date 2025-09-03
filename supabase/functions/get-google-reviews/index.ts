import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  console.log(`get-google-reviews: ${req.method} request received`)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    console.error('get-google-reviews: Method not allowed:', req.method)
    return new Response(
      JSON.stringify({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
        success: false
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
    console.log('get-google-reviews: Processing place_id:', place_id)
    
    if (!place_id || typeof place_id !== 'string') {
      console.error('get-google-reviews: Invalid place_id provided')
      return new Response(
        JSON.stringify({
          error: 'Valid Place ID is required',
          code: 'INVALID_PLACE_ID',
          success: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Get Google Maps API key from Supabase secrets
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!googleApiKey) {
      console.error('get-google-reviews: Google Maps API key not configured')
      return new Response(
        JSON.stringify({
          error: 'Google Maps API key not configured in server secrets',
          code: 'API_KEY_MISSING',
          success: false
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Fetch place details including reviews with timeout
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=reviews,rating,user_ratings_total&key=${googleApiKey}`
    console.log('get-google-reviews: Making Google API request')
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Nexora-Reviews/1.0'
        }
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error('get-google-reviews: HTTP error from Google API:', response.status, response.statusText)
        return new Response(
          JSON.stringify({
            error: `Google API returned ${response.status}: ${response.statusText}`,
            code: 'GOOGLE_API_HTTP_ERROR',
            success: false
          }),
          {
            status: 502, // Bad Gateway
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      const data: GooglePlaceDetails | GoogleErrorResponse = await response.json()
      console.log('get-google-reviews: Google API response status:', (data as any).status)

      // Handle Google Places API specific errors
      if (data.status !== 'OK') {
        const errorMessage = data.error_message || `Google Places API error: ${data.status}`
        console.error('get-google-reviews: Google Places API error:', data.status, errorMessage)
        
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
            success: false
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

      console.log(`get-google-reviews: Successfully fetched ${reviews.length} reviews`)
      
      return new Response(
        JSON.stringify({
          reviews,
          place_rating: placeData.result.rating,
          total_reviews: placeData.result.user_ratings_total,
          success: true,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )

    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      if (fetchError.name === 'AbortError') {
        console.error('get-google-reviews: Request timeout')
        return new Response(
          JSON.stringify({
            error: 'Request timeout. Google API is taking too long to respond.',
            code: 'REQUEST_TIMEOUT',
            success: false
          }),
          {
            status: 504,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
      
      throw fetchError // Re-throw other fetch errors
    }

  } catch (error) {
    console.error('get-google-reviews: Unexpected error:', error)
    
    let errorMessage = 'Internal server error while fetching reviews'
    let statusCode = 500
    
    if (error.message.includes('JSON')) {
      errorMessage = 'Invalid request format'
      statusCode = 400
    }
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        code: 'INTERNAL_ERROR',
        success: false,
        details: error.message
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})