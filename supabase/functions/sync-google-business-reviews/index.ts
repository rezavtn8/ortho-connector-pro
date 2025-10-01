import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  clinic_id?: string;
  sync_all?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SyncRequest = await req.json().catch(() => ({}));
    const { clinic_id, sync_all } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get token for clinic
    let tokenQuery = supabase.from('google_business_tokens').select('*');
    
    if (clinic_id) {
      tokenQuery = tokenQuery.eq('clinic_id', clinic_id);
    }

    const { data: tokens, error: tokenError } = await tokenQuery;

    if (tokenError || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ error: 'No connected Google Business Profile found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const results = [];

    for (const token of tokens) {
      try {
        // Check if token is expired
        if (new Date(token.expires_at) < new Date()) {
          // Refresh token
          await supabase.functions.invoke('refresh-google-business-token', {
            body: { clinic_id: token.clinic_id },
          });
        }

        // Get clinic info
        const { data: clinic } = await supabase
          .from('clinics')
          .select('google_place_id')
          .eq('id', token.clinic_id)
          .single();

        if (!clinic?.google_place_id) {
          console.log(`Clinic ${token.clinic_id} has no google_place_id`);
          continue;
        }

        // Fetch reviews from Google Business Profile API
        // Note: This is a simplified version. The actual implementation would need
        // to handle pagination, rate limiting, and the full GBP API structure
        const reviewsResponse = await fetch(
          `https://mybusiness.googleapis.com/v4/accounts/-/locations/${clinic.google_place_id}/reviews`,
          {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!reviewsResponse.ok) {
          console.error(`Failed to fetch reviews for clinic ${token.clinic_id}`);
          continue;
        }

        const reviewsData = await reviewsResponse.json();
        const reviews = reviewsData.reviews || [];

        let newCount = 0;
        let updatedCount = 0;

        // Upsert reviews
        for (const review of reviews) {
          const reviewData = {
            google_review_id: review.reviewId,
            location_id: clinic.google_place_id,
            clinic_id: token.clinic_id,
            user_id: token.user_id,
            author_name: review.reviewer?.displayName,
            author_profile_url: review.reviewer?.profilePhotoUrl,
            rating: review.starRating === 'FIVE' ? 5 :
                    review.starRating === 'FOUR' ? 4 :
                    review.starRating === 'THREE' ? 3 :
                    review.starRating === 'TWO' ? 2 : 1,
            review_text: review.comment,
            review_reply: review.reviewReply?.comment,
            review_reply_updated_at: review.reviewReply?.updateTime,
            posted_at: review.createTime,
            needs_attention: !review.reviewReply && (
              review.starRating === 'ONE' || 
              review.starRating === 'TWO' || 
              review.starRating === 'THREE'
            ),
            metadata: review,
          };

          const { data: existing } = await supabase
            .from('google_reviews')
            .select('id')
            .eq('google_review_id', review.reviewId)
            .eq('location_id', clinic.google_place_id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('google_reviews')
              .update(reviewData)
              .eq('id', existing.id);
            updatedCount++;
          } else {
            await supabase
              .from('google_reviews')
              .insert(reviewData);
            newCount++;
          }
        }

        // Log sync
        await supabase
          .from('review_sync_log')
          .insert({
            location_id: clinic.google_place_id,
            clinic_id: token.clinic_id,
            user_id: token.user_id,
            sync_status: 'success',
            reviews_fetched: reviews.length,
            reviews_new: newCount,
            reviews_updated: updatedCount,
            completed_at: new Date().toISOString(),
          });

        results.push({
          clinic_id: token.clinic_id,
          success: true,
          reviews_synced: reviews.length,
          new: newCount,
          updated: updatedCount,
        });

      } catch (error: any) {
        console.error(`Error syncing reviews for clinic ${token.clinic_id}:`, error);
        
        await supabase
          .from('review_sync_log')
          .insert({
            location_id: token.clinic_id,
            clinic_id: token.clinic_id,
            user_id: token.user_id,
            sync_status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
          });

        results.push({
          clinic_id: token.clinic_id,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in sync-google-business-reviews:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
