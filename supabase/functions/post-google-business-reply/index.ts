import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshTokenIfNeeded(supabase: any, tokenRecord: any) {
  const expiresAt = new Date(tokenRecord.expires_at);
  const now = new Date();
  
  if (expiresAt <= now) {
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-google-business-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ token_id: tokenRecord.id }),
      }
    );
    
    const result = await response.json();
    return result.access_token;
  }
  
  return tokenRecord.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { review_id, reply_text, ai_content_id } = await req.json();

    // Get review details
    const { data: review, error: reviewError } = await supabase
      .from('google_reviews')
      .select('*')
      .eq('id', review_id)
      .single();

    if (reviewError || !review) {
      throw new Error('Review not found');
    }

    // Get token for this location
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let tokenQuery = serviceSupabase
      .from('google_business_tokens')
      .select('*')
      .eq('user_id', user.id);

    if (review.office_id) {
      tokenQuery = tokenQuery.eq('office_id', review.office_id);
    } else if (review.clinic_id) {
      tokenQuery = tokenQuery.eq('clinic_id', review.clinic_id);
    }

    const { data: tokenRecord, error: tokenError } = await tokenQuery.single();

    if (tokenError || !tokenRecord) {
      throw new Error('Location not connected to Google Business');
    }

    const accessToken = await refreshTokenIfNeeded(serviceSupabase, tokenRecord);

    // Post reply to Google
    const replyUrl = `https://mybusiness.googleapis.com/v4/${review.location_id}/reviews/${review.google_review_id}/reply`;
    
    const replyResponse = await fetch(replyUrl, {
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
      const errorText = await replyResponse.text();
      console.error('Failed to post reply:', errorText);
      
      // Save failed reply
      await supabase.from('review_replies').insert({
        review_id,
        user_id: user.id,
        reply_text,
        is_ai_generated: !!ai_content_id,
        ai_content_id: ai_content_id || null,
        status: 'failed',
        error_message: errorText,
      });
      
      throw new Error('Failed to post reply to Google');
    }

    const replyData = await replyResponse.json();

    // Update review with reply
    await supabase
      .from('google_reviews')
      .update({
        review_reply: reply_text,
        review_reply_updated_at: new Date().toISOString(),
        is_read: true,
      })
      .eq('id', review_id);

    // Save successful reply
    await supabase.from('review_replies').insert({
      review_id,
      user_id: user.id,
      reply_text,
      is_ai_generated: !!ai_content_id,
      ai_content_id: ai_content_id || null,
      status: 'sent',
      sent_at: new Date().toISOString(),
      google_reply_id: replyData.name || null,
    });

    // Update AI content if used
    if (ai_content_id) {
      await supabase
        .from('ai_generated_content')
        .update({
          used: true,
          status: 'approved',
        })
        .eq('id', ai_content_id);
    }

    return new Response(
      JSON.stringify({ success: true, reply: replyData }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error posting reply:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
