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

// Helper function to refresh token
async function refreshToken(supabase: any, tokenData: any): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('OAuth credentials not configured');
  }

  console.log(`Refreshing token for clinic ${tokenData.clinic_id}...`);

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
    throw new Error('Token refresh failed');
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

  return access_token;
}

// Convert Google star rating to number
function parseStarRating(starRating: string): number {
  const ratings: Record<string, number> = {
    'FIVE': 5,
    'FOUR': 4,
    'THREE': 3,
    'TWO': 2,
    'ONE': 1,
  };
  return ratings[starRating] || 1;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SyncRequest = await req.json().catch(() => ({}));
    const { clinic_id, sync_all } = body;

    console.log('Sync request received:', { clinic_id, sync_all });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get tokens to sync
    let tokenQuery = supabase.from('google_business_tokens').select('*');
    
    if (clinic_id && !sync_all) {
      tokenQuery = tokenQuery.eq('clinic_id', clinic_id);
    }

    const { data: tokens, error: tokenError } = await tokenQuery;

    if (tokenError || !tokens || tokens.length === 0) {
      console.error('Token error:', tokenError?.message);
      return new Response(JSON.stringify({ 
        error: 'No connected Google Business Profile found',
        message: 'Please connect your Google Business Profile first.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`Found ${tokens.length} token(s) to sync`);
    const results = [];

    for (const token of tokens) {
      try {
        // Refresh token if expired
        let accessToken = token.access_token;
        if (new Date(token.expires_at) < new Date()) {
          accessToken = await refreshToken(supabase, token);
        }

        // Get location name from token - this was stored during OAuth
        const locationName = token.scope; // We store the location name in metadata
        
        // The location_id should be the full resource name
        // Format: accounts/{account_id}/locations/{location_id}
        // We need to get the account info first if we don't have it
        
        // First, get the accounts the user has access to
        const accountsResponse = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!accountsResponse.ok) {
          const errorText = await accountsResponse.text();
          console.error(`Failed to get accounts: ${errorText}`);
          throw new Error(`Failed to get Google accounts: ${accountsResponse.status}`);
        }

        const accountsData = await accountsResponse.json();
        const accounts = accountsData.accounts || [];
        
        console.log(`Found ${accounts.length} account(s)`);

        let totalNewCount = 0;
        let totalUpdatedCount = 0;
        let totalFetchedCount = 0;

        // For each account, get locations and reviews
        for (const account of accounts) {
          const accountName = account.name; // e.g., "accounts/123456789"
          
          // Get locations for this account
          const locationsResponse = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!locationsResponse.ok) {
            console.log(`Failed to get locations for ${accountName}, trying alternate endpoint...`);
            // Try the legacy endpoint
            const legacyLocationsResponse = await fetch(
              `https://mybusiness.googleapis.com/v4/${accountName}/locations`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            
            if (!legacyLocationsResponse.ok) {
              console.error(`Failed to get locations for ${accountName}`);
              continue;
            }
            
            const legacyData = await legacyLocationsResponse.json();
            const locations = legacyData.locations || [];
            
            for (const location of locations) {
              const locationName = location.name; // e.g., "accounts/123/locations/456"
              
              // Get reviews for this location using legacy API
              const reviewsResponse = await fetch(
                `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (!reviewsResponse.ok) {
                console.error(`Failed to get reviews for ${locationName}`);
                continue;
              }

              const reviewsData = await reviewsResponse.json();
              const reviews = reviewsData.reviews || [];
              
              console.log(`Found ${reviews.length} review(s) for ${locationName}`);
              totalFetchedCount += reviews.length;

              // Upsert reviews
              for (const review of reviews) {
                const rating = parseStarRating(review.starRating);
                const reviewData = {
                  google_review_id: review.reviewId,
                  location_id: locationName,
                  clinic_id: token.clinic_id,
                  user_id: token.user_id,
                  author_name: review.reviewer?.displayName || 'Anonymous',
                  author_profile_url: review.reviewer?.profilePhotoUrl || null,
                  rating,
                  review_text: review.comment || null,
                  review_reply: review.reviewReply?.comment || null,
                  review_reply_updated_at: review.reviewReply?.updateTime || null,
                  posted_at: review.createTime,
                  needs_attention: !review.reviewReply && rating <= 3,
                  metadata: review,
                  synced_at: new Date().toISOString(),
                };

                const { data: existing } = await supabase
                  .from('google_reviews')
                  .select('id')
                  .eq('google_review_id', review.reviewId)
                  .eq('clinic_id', token.clinic_id)
                  .maybeSingle();

                if (existing) {
                  await supabase
                    .from('google_reviews')
                    .update({
                      ...reviewData,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);
                  totalUpdatedCount++;
                } else {
                  await supabase
                    .from('google_reviews')
                    .insert(reviewData);
                  totalNewCount++;
                }
              }
            }
            continue;
          }

          const locationsData = await locationsResponse.json();
          const locations = locationsData.locations || [];
          
          console.log(`Found ${locations.length} location(s) for ${accountName}`);

          for (const location of locations) {
            const locationName = location.name; // e.g., "locations/123456789"
            const fullLocationName = `${accountName}/${locationName}`;
            
            // Get reviews for this location
            const reviewsResponse = await fetch(
              `https://mybusiness.googleapis.com/v4/${fullLocationName}/reviews`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (!reviewsResponse.ok) {
              const errorText = await reviewsResponse.text();
              console.error(`Failed to get reviews for ${fullLocationName}: ${errorText}`);
              continue;
            }

            const reviewsData = await reviewsResponse.json();
            const reviews = reviewsData.reviews || [];
            
            console.log(`Found ${reviews.length} review(s) for ${fullLocationName}`);
            totalFetchedCount += reviews.length;

            // Upsert reviews
            for (const review of reviews) {
              const rating = parseStarRating(review.starRating);
              const reviewData = {
                google_review_id: review.reviewId,
                location_id: fullLocationName,
                clinic_id: token.clinic_id,
                user_id: token.user_id,
                author_name: review.reviewer?.displayName || 'Anonymous',
                author_profile_url: review.reviewer?.profilePhotoUrl || null,
                rating,
                review_text: review.comment || null,
                review_reply: review.reviewReply?.comment || null,
                review_reply_updated_at: review.reviewReply?.updateTime || null,
                posted_at: review.createTime,
                needs_attention: !review.reviewReply && rating <= 3,
                metadata: review,
                synced_at: new Date().toISOString(),
              };

              const { data: existing } = await supabase
                .from('google_reviews')
                .select('id')
                .eq('google_review_id', review.reviewId)
                .eq('clinic_id', token.clinic_id)
                .maybeSingle();

              if (existing) {
                await supabase
                  .from('google_reviews')
                  .update({
                    ...reviewData,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existing.id);
                totalUpdatedCount++;
              } else {
                await supabase
                  .from('google_reviews')
                  .insert(reviewData);
                totalNewCount++;
              }
            }
          }
        }

        // Log sync
        await supabase
          .from('review_sync_log')
          .insert({
            location_id: 'all_locations',
            clinic_id: token.clinic_id,
            user_id: token.user_id,
            sync_status: 'success',
            reviews_fetched: totalFetchedCount,
            reviews_new: totalNewCount,
            reviews_updated: totalUpdatedCount,
            completed_at: new Date().toISOString(),
          });

        results.push({
          clinic_id: token.clinic_id,
          success: true,
          reviews_fetched: totalFetchedCount,
          new: totalNewCount,
          updated: totalUpdatedCount,
        });

        console.log(`Sync complete for clinic ${token.clinic_id}: ${totalFetchedCount} fetched, ${totalNewCount} new, ${totalUpdatedCount} updated`);

      } catch (error: any) {
        console.error(`Error syncing reviews for clinic ${token.clinic_id}:`, error);
        
        await supabase
          .from('review_sync_log')
          .insert({
            location_id: 'error',
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
    return new Response(JSON.stringify({ 
      error: error.message,
      message: 'Failed to sync reviews'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
