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

async function fetchReviewsWithRetry(url: string, accessToken: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      if (response.status === 429 && attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw new Error(`API request failed: ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { office_id, sync_all } = await req.json();

    let tokensQuery = supabase.from('google_business_tokens').select('*');
    
    if (!sync_all && office_id) {
      tokensQuery = tokensQuery.eq('office_id', office_id);
    }

    const { data: tokens, error: tokensError } = await tokensQuery;

    if (tokensError || !tokens || tokens.length === 0) {
      throw new Error('No connected locations found');
    }

    const results = [];

    for (const tokenRecord of tokens) {
      const syncLog = {
        location_id: 'unknown',
        office_id: tokenRecord.office_id,
        clinic_id: tokenRecord.clinic_id,
        user_id: tokenRecord.user_id,
        sync_status: 'pending',
        reviews_fetched: 0,
        reviews_new: 0,
        reviews_updated: 0,
        started_at: new Date().toISOString(),
      };

      try {
        const accessToken = await refreshTokenIfNeeded(supabase, tokenRecord);

        // Fetch account locations
        const accountsResponse = await fetchReviewsWithRetry(
          'https://mybusinessbusinessinformation.googleapis.com/v1/accounts',
          accessToken
        );

        if (!accountsResponse.accounts || accountsResponse.accounts.length === 0) {
          throw new Error('No accounts found');
        }

        const accountId = accountsResponse.accounts[0].name;
        
        const locationsResponse = await fetchReviewsWithRetry(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`,
          accessToken
        );

        if (!locationsResponse.locations || locationsResponse.locations.length === 0) {
          throw new Error('No locations found');
        }

        for (const location of locationsResponse.locations) {
          syncLog.location_id = location.name;

          // Fetch reviews for this location
          const reviewsResponse = await fetchReviewsWithRetry(
            `https://mybusiness.googleapis.com/v4/${location.name}/reviews`,
            accessToken
          );

          const reviews = reviewsResponse.reviews || [];
          syncLog.reviews_fetched = reviews.length;

          for (const review of reviews) {
            const reviewData = {
              google_review_id: review.reviewId,
              location_id: location.name,
              office_id: tokenRecord.office_id,
              clinic_id: tokenRecord.clinic_id,
              user_id: tokenRecord.user_id,
              author_name: review.reviewer?.displayName || 'Anonymous',
              author_profile_url: review.reviewer?.profilePhotoUrl || null,
              rating: review.starRating === 'FIVE' ? 5 :
                      review.starRating === 'FOUR' ? 4 :
                      review.starRating === 'THREE' ? 3 :
                      review.starRating === 'TWO' ? 2 : 1,
              review_text: review.comment || null,
              review_reply: review.reviewReply?.comment || null,
              review_reply_updated_at: review.reviewReply?.updateTime || null,
              posted_at: review.createTime,
              needs_attention: (review.starRating === 'ONE' || review.starRating === 'TWO') && !review.reviewReply,
              metadata: review,
              synced_at: new Date().toISOString(),
            };

            const { error: upsertError } = await supabase
              .from('google_reviews')
              .upsert(reviewData, {
                onConflict: 'google_review_id,location_id',
              });

            if (upsertError) {
              console.error('Error upserting review:', upsertError);
            } else {
              syncLog.reviews_new++;
            }
          }
        }

        syncLog.sync_status = 'success';
      } catch (error) {
        console.error('Sync error for token:', tokenRecord.id, error);
        syncLog.sync_status = 'failed';
        syncLog.error_message = error.message;
      } finally {
        syncLog.completed_at = new Date().toISOString();
        syncLog.next_sync_at = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
        
        await supabase.from('review_sync_log').insert(syncLog);
        results.push(syncLog);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-google-business-reviews:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
