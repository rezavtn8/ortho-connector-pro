import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostReplyRequest {
  review_id: string;
  reply_text: string;
  is_ai_generated?: boolean;
  ai_content_id?: string;
}

// Helper function to refresh token
async function refreshToken(supabase: any, tokenData: any): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('OAuth credentials not configured');
  }

  console.log('Refreshing expired token...');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokenData.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    console.error('Token refresh failed:', errorData);
    throw new Error('Failed to refresh Google token. Please reconnect your Google Business Profile.');
  }

  const tokens = await tokenResponse.json();
  const { access_token, expires_in } = tokens;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  // Update token in database
  await supabase
    .from('google_business_tokens')
    .update({
      access_token,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tokenData.id);

  console.log('Token refreshed successfully');
  return access_token;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create user-authenticated Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user session
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (!user || userError) {
      console.error('Auth error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { review_id, reply_text, is_ai_generated, ai_content_id }: PostReplyRequest = await req.json();

    if (!review_id || !reply_text) {
      return new Response(JSON.stringify({ error: 'Missing required fields: review_id and reply_text' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`Posting reply for review ${review_id}, AI generated: ${is_ai_generated}`);

    // SECURITY CHECK: Verify review belongs to user's clinic
    const { data: review, error: reviewError } = await supabase
      .from('google_reviews')
      .select('*, clinics!inner(owner_id)')
      .eq('id', review_id)
      .single();

    if (reviewError || !review) {
      console.error('Review fetch error:', reviewError?.message);
      return new Response(JSON.stringify({ error: 'Review not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if ((review as any).clinics.owner_id !== user.id) {
      return new Response(JSON.stringify({ 
        error: 'Forbidden',
        message: 'You can only reply to reviews for your own clinic'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get clinic token using service role
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: tokenData, error: tokenError } = await serviceSupabase
      .from('google_business_tokens')
      .select('*')
      .eq('clinic_id', review.clinic_id)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token fetch error:', tokenError?.message);
      return new Response(JSON.stringify({ 
        error: 'No Google Business connection found',
        message: 'Please connect your Google Business Profile first.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) < new Date()) {
      accessToken = await refreshToken(serviceSupabase, tokenData);
    }

    // Post reply to Google Business Profile API
    // The location_id in our DB should be the account/location name from Google
    // Format: accounts/{account_id}/locations/{location_id}/reviews/{review_id}
    const googleReviewName = `${review.location_id}/reviews/${review.google_review_id}`;
    const replyEndpoint = `https://mybusiness.googleapis.com/v4/${googleReviewName}/reply`;

    console.log('Posting to Google API:', replyEndpoint);

    const replyResponse = await fetch(replyEndpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: reply_text,
      }),
    });

    if (!replyResponse.ok) {
      const errorData = await replyResponse.text();
      console.error('Google API error:', errorData);
      
      // Parse error for better message
      let errorMessage = 'Failed to post reply to Google';
      try {
        const parsed = JSON.parse(errorData);
        errorMessage = parsed.error?.message || parsed.error?.status || errorMessage;
      } catch {}
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: errorData
      }), {
        status: replyResponse.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('Reply posted to Google successfully');

    // Update review in database
    const { error: updateError } = await supabase
      .from('google_reviews')
      .update({
        review_reply: reply_text,
        review_reply_updated_at: new Date().toISOString(),
        is_read: true,
        needs_attention: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', review_id);

    if (updateError) {
      console.error('Failed to update review:', updateError.message);
    }

    // Insert reply record
    const { error: replyInsertError } = await supabase
      .from('review_replies')
      .insert({
        review_id,
        user_id: user.id,
        reply_text,
        is_ai_generated: is_ai_generated || false,
        ai_content_id: ai_content_id || null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

    if (replyInsertError) {
      console.error('Failed to insert reply record:', replyInsertError.message);
    }

    // Update AI content status if AI-generated
    if (is_ai_generated && ai_content_id) {
      await serviceSupabase
        .from('ai_generated_content')
        .update({
          status: 'used',
          used: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ai_content_id);
    }

    // Log activity
    await serviceSupabase.rpc('log_activity', {
      p_action_type: 'REVIEW_REPLY_POSTED',
      p_resource_type: 'review',
      p_resource_id: review_id,
      p_details: {
        is_ai_generated: is_ai_generated || false,
        review_rating: review.rating,
        ai_content_id: ai_content_id || null,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Reply posted successfully',
      is_ai_generated: is_ai_generated || false,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in post-google-business-reply:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      message: 'An unexpected error occurred while posting your reply.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
