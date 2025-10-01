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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { review_id, reply_text, is_ai_generated, ai_content_id }: PostReplyRequest = await req.json();

    if (!review_id || !reply_text) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // SECURITY CHECK: Verify review belongs to user's clinic
    const { data: review, error: reviewError } = await supabase
      .from('google_reviews')
      .select('*, clinics!inner(owner_id)')
      .eq('id', review_id)
      .single();

    if (reviewError || !review) {
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

    // Get clinic token
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
      return new Response(JSON.stringify({ error: 'No Google Business connection found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if token is expired and refresh if needed
    if (new Date(tokenData.expires_at) < new Date()) {
      await serviceSupabase.functions.invoke('refresh-google-business-token', {
        body: { clinic_id: review.clinic_id },
      });
    }

    // Post reply to Google Business Profile API
    const replyResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/-/locations/${review.location_id}/reviews/${review.google_review_id}/reply`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: reply_text,
        }),
      }
    );

    if (!replyResponse.ok) {
      const errorData = await replyResponse.text();
      console.error('Failed to post reply to Google:', errorData);
      throw new Error('Failed to post reply to Google Business Profile');
    }

    // Update review in database
    await supabase
      .from('google_reviews')
      .update({
        review_reply: reply_text,
        review_reply_updated_at: new Date().toISOString(),
        is_read: true,
        needs_attention: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', review_id);

    // Insert reply record
    await supabase
      .from('review_replies')
      .insert({
        review_id,
        user_id: user.id,
        reply_text,
        is_ai_generated: is_ai_generated || false,
        ai_content_id,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

    // Log activity
    await serviceSupabase.rpc('log_activity', {
      p_action_type: 'REVIEW_REPLY_POSTED',
      p_resource_type: 'review',
      p_resource_id: review_id,
      p_details: {
        is_ai_generated,
        review_rating: review.rating,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Reply posted successfully',
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in post-google-business-reply:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
