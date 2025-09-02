import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleBusinessReview {
  name: string
  reviewer: {
    profilePhotoUrl?: string
    displayName: string
    isAnonymous?: boolean
  }
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comment?: string
  createTime: string
  updateTime: string
  reviewId?: string
}

interface BusinessReviewsResponse {
  reviews?: GoogleBusinessReview[]
  nextPageToken?: string
  totalReviewCount?: number
  averageRating?: number
}

const starRatingToNumber = (rating: string): number => {
  const map: { [key: string]: number } = {
    'ONE': 1,
    'TWO': 2,
    'THREE': 3,
    'FOUR': 4,
    'FIVE': 5
  }
  return map[rating] || 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { place_id, account_id, location_id } = await req.json()
    
    if (!place_id || !account_id || !location_id) {
      throw new Error('Place ID, Account ID, and Location ID are required')
    }

    // Get the user's service account key from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get the request headers to find the user
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      throw new Error('Authorization required')
    }

    // Create client with user's JWT to access their data
    const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    })

    const { data: config, error: configError } = await userSupabase
      .from('business_api_configs')
      .select('service_account_key')
      .single()

    if (configError || !config) {
      throw new Error('Business API configuration not found')
    }

    // Parse the service account key
    const serviceAccountKey = JSON.parse(config.service_account_key)
    
    // Get OAuth2 token for Google My Business API
    const tokenUrl = 'https://oauth2.googleapis.com/token'
    const now = Math.floor(Date.now() / 1000)
    
    // Create JWT for service account
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    }
    
    const payload = {
      iss: serviceAccountKey.client_email,
      scope: 'https://www.googleapis.com/auth/business.manage',
      aud: tokenUrl,
      exp: now + 3600,
      iat: now
    }

    // Note: This is a simplified version. In production, you'd need to properly sign the JWT
    // For now, we'll return a helpful error message
    throw new Error('Business API integration requires additional setup. Please use the Google Places API for now, or contact support for full Business API integration.')

  } catch (error) {
    console.error('Error in get-business-reviews:', error)
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