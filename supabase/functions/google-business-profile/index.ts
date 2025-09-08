import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

interface ReviewReplyRequest {
  location_id: string
  review_id: string
  reply_text: string
}

interface OAuth2TokenRequest {
  code: string
  redirect_uri: string
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID()
  console.log(`google-business-profile: ${req.method} request received [${requestId}]`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    // OAuth2 authorization URL generation
    if (req.method === 'GET' && path.endsWith('/auth-url')) {
      const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
      const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI') || 'https://vqkzqwibbcvmdwgqladn.supabase.co/functions/v1/google-business-profile/callback'
      
      if (!clientId) {
        return new Response(
          JSON.stringify({
            error: 'Google OAuth Client ID not configured',
            code: 'OAUTH_CLIENT_ID_MISSING',
            success: false,
            request_id: requestId
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const scope = encodeURIComponent('https://www.googleapis.com/auth/business.manage')
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&access_type=offline&prompt=consent`

      return new Response(
        JSON.stringify({
          auth_url: authUrl,
          success: true,
          request_id: requestId
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // OAuth2 token exchange
    if (req.method === 'POST' && path.endsWith('/token')) {
      const { code, redirect_uri }: OAuth2TokenRequest = await req.json()
      
      const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
      const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
      
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({
            error: 'Google OAuth credentials not configured',
            code: 'OAUTH_CREDENTIALS_MISSING',
            success: false,
            request_id: requestId
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirect_uri,
          grant_type: 'authorization_code'
        })
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text()
        console.error(`google-business-profile: Token exchange failed [${requestId}]:`, error)
        return new Response(
          JSON.stringify({
            error: 'Failed to exchange authorization code for tokens',
            code: 'TOKEN_EXCHANGE_FAILED',
            success: false,
            request_id: requestId
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const tokens = await tokenResponse.json()
      
      return new Response(
        JSON.stringify({
          ...tokens,
          success: true,
          request_id: requestId
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get all reviews for a location
    if (req.method === 'POST' && path.endsWith('/reviews')) {
      const authHeader = req.headers.get('authorization')
      const accessToken = authHeader?.replace('Bearer ', '')
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({
            error: 'Access token required',
            code: 'ACCESS_TOKEN_MISSING',
            success: false,
            request_id: requestId
          }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const { location_id } = await req.json()
      
      if (!location_id) {
        return new Response(
          JSON.stringify({
            error: 'Location ID is required',
            code: 'LOCATION_ID_MISSING',
            success: false,
            request_id: requestId
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Fetch reviews from Google My Business API
      const reviewsResponse = await fetch(
        `https://mybusiness.googleapis.com/v4/accounts/-/locations/${location_id}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      )

      if (!reviewsResponse.ok) {
        const error = await reviewsResponse.text()
        console.error(`google-business-profile: Failed to fetch reviews [${requestId}]:`, error)
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch reviews from Google My Business API',
            code: 'REVIEWS_FETCH_FAILED',
            success: false,
            request_id: requestId
          }),
          {
            status: reviewsResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const reviewsData = await reviewsResponse.json()
      
      return new Response(
        JSON.stringify({
          ...reviewsData,
          success: true,
          request_id: requestId
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Reply to a review
    if (req.method === 'POST' && path.endsWith('/reply')) {
      const authHeader = req.headers.get('authorization')
      const accessToken = authHeader?.replace('Bearer ', '')
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({
            error: 'Access token required',
            code: 'ACCESS_TOKEN_MISSING',
            success: false,
            request_id: requestId
          }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const { location_id, review_id, reply_text }: ReviewReplyRequest = await req.json()
      
      if (!location_id || !review_id || !reply_text) {
        return new Response(
          JSON.stringify({
            error: 'Location ID, review ID, and reply text are required',
            code: 'MISSING_REQUIRED_FIELDS',
            success: false,
            request_id: requestId
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Post reply to Google My Business API
      const replyResponse = await fetch(
        `https://mybusiness.googleapis.com/v4/accounts/-/locations/${location_id}/reviews/${review_id}/reply`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            comment: reply_text
          })
        }
      )

      if (!replyResponse.ok) {
        const error = await replyResponse.text()
        console.error(`google-business-profile: Failed to post reply [${requestId}]:`, error)
        return new Response(
          JSON.stringify({
            error: 'Failed to post reply to Google My Business API',
            code: 'REPLY_POST_FAILED',
            success: false,
            request_id: requestId
          }),
          {
            status: replyResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const replyData = await replyResponse.json()
      
      return new Response(
        JSON.stringify({
          ...replyData,
          success: true,
          request_id: requestId
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Invalid endpoint
    return new Response(
      JSON.stringify({
        error: 'Endpoint not found',
        code: 'ENDPOINT_NOT_FOUND',
        success: false,
        request_id: requestId
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error(`google-business-profile: Unexpected error [${requestId}]:`, error)
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        success: false,
        details: error.message,
        request_id: requestId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})