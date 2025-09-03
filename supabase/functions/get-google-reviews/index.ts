import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://nexoradental.com, https://*.lovable.app, http://localhost:*',
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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { place_id } = await req.json()
    
    if (!place_id) {
      throw new Error('Place ID is required')
    }

    // Get Google Maps API key from Supabase secrets
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!googleApiKey) {
      throw new Error('Google Maps API key not configured')
    }

    // Fetch place details including reviews
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=reviews,rating,user_ratings_total&key=${googleApiKey}`
    
    const response = await fetch(url)
    const data: GooglePlaceDetails = await response.json()

    if (!response.ok) {
      throw new Error('Failed to fetch Google reviews')
    }

    // Transform the reviews to include a unique identifier
    const reviews = (data.result.reviews || []).map((review, index) => ({
      ...review,
      google_review_id: `${place_id}_${review.time}_${index}`, // Create unique ID
      place_id
    }))

    return new Response(
      JSON.stringify({
        reviews,
        place_rating: data.result.rating,
        total_reviews: data.result.user_ratings_total,
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})