import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';


import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
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
    throw new Error(
      'Google refused to refresh the stored credentials. Disconnect and reconnect your Google Business Profile.'
    );
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

// Turn a Google API failure into a message that tells the user what to actually do.
// The Business Profile APIs are gated behind an access request that Google has to
// approve; until then every call comes back 403/429 with quota 0.
function describeGoogleError(apiLabel: string, status: number, body: string): string {
  let parsed: any = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Google serves an HTML page for some errors (e.g. a removed endpoint)
  }
  const reason = parsed?.error?.status ?? '';
  const detail = parsed?.error?.message ?? body.slice(0, 300);

  if (status === 401) {
    return `Google rejected the saved credentials (${apiLabel}). Disconnect and reconnect your Google Business Profile.`;
  }
  if (status === 403) {
    if (/has not been used in project|is disabled|SERVICE_DISABLED/i.test(`${reason} ${detail}`)) {
      return `The Business Profile API is not enabled on this Google Cloud project (${apiLabel}). Enable it in the Cloud console, and confirm Google approved the Business Profile API access request. Google said: ${detail}`;
    }
    return `Google denied access to ${apiLabel}. Either the Business Profile API access request has not been approved yet (quota stays at 0 until it is), or the Google account you connected does not manage this business. Google said: ${detail}`;
  }
  if (status === 429) {
    return `Google rate-limited ${apiLabel}. Business Profile API quota stays at 0 until Google approves the access request for this project. Google said: ${detail}`;
  }
  if (status === 404) {
    return `${apiLabel} returned 404 — the endpoint or resource does not exist. Google said: ${detail}`;
  }
  return `${apiLabel} failed with HTTP ${status}. Google said: ${detail}`;
}

async function googleGet(url: string, accessToken: string, apiLabel: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`${apiLabel} -> HTTP ${response.status}: ${body}`);
    throw new Error(describeGoogleError(apiLabel, response.status, body));
  }

  return await response.json();
}

// Accounts the connected Google user can manage: "accounts/{account_id}"
async function listAccounts(accessToken: string): Promise<any[]> {
  const accounts: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
    url.searchParams.set('pageSize', '20');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const data = await googleGet(url.toString(), accessToken, 'Account Management API (accounts.list)');
    accounts.push(...(data.accounts || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return accounts;
}

// Locations under an account: "locations/{location_id}"
// readMask is mandatory on this endpoint — omitting it is a hard 400.
async function listLocations(accountName: string, accessToken: string): Promise<any[]> {
  const locations: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`);
    url.searchParams.set('readMask', 'name,title,storefrontAddress');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const data = await googleGet(
      url.toString(),
      accessToken,
      `Business Information API (locations.list for ${accountName})`
    );
    locations.push(...(data.locations || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return locations;
}

// Reviews still live only on the legacy v4 API, keyed by the full
// "accounts/{account_id}/locations/{location_id}" resource name.
async function listReviews(fullLocationName: string, accessToken: string): Promise<any[]> {
  const reviews: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${fullLocationName}/reviews`);
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const data = await googleGet(
      url.toString(),
      accessToken,
      `My Business API (reviews.list for ${fullLocationName})`
    );
    reviews.push(...(data.reviews || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return reviews;
}

async function upsertReview(
  supabase: any,
  token: any,
  fullLocationName: string,
  review: any
): Promise<'new' | 'updated'> {
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
      .update({ ...reviewData, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return 'updated';
  }

  await supabase.from('google_reviews').insert(reviewData);
  return 'new';
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req, { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" });

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req, corsHeaders);
  }

  try {
    // Authenticate the caller via getClaims
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('JWT verification failed:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const authenticatedUserId = claimsData.claims.sub as string;

    const body: SyncRequest = await req.json().catch(() => ({}));
    const { clinic_id, sync_all } = body;

    console.log('Sync request received:', { clinic_id, sync_all, user: authenticatedUserId });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Only allow syncing tokens owned by the authenticated user
    let tokenQuery = supabase.from('google_business_tokens').select('*').eq('user_id', authenticatedUserId);

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

        const accounts = await listAccounts(accessToken);
        console.log(`Found ${accounts.length} account(s)`);

        if (accounts.length === 0) {
          throw new Error(
            'Google returned no Business Profile accounts for the connected user. Make sure you connected the Google account that manages this business.'
          );
        }

        let totalNewCount = 0;
        let totalUpdatedCount = 0;
        let totalFetchedCount = 0;
        let totalLocationCount = 0;

        for (const account of accounts) {
          const accountName = account.name; // e.g. "accounts/123456789"

          const locations = await listLocations(accountName, accessToken);
          console.log(`Found ${locations.length} location(s) for ${accountName}`);
          totalLocationCount += locations.length;

          for (const location of locations) {
            // locations.list returns "locations/456"; reviews need the full path
            const fullLocationName = `${accountName}/${location.name}`;

            const reviews = await listReviews(fullLocationName, accessToken);
            console.log(`Found ${reviews.length} review(s) for ${fullLocationName}`);
            totalFetchedCount += reviews.length;

            for (const review of reviews) {
              const outcome = await upsertReview(supabase, token, fullLocationName, review);
              if (outcome === 'new') totalNewCount++;
              else totalUpdatedCount++;
            }
          }
        }

        if (totalLocationCount === 0) {
          throw new Error(
            'Google returned no locations for the connected account. Confirm the business is verified and that this Google account has access to it.'
          );
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
          locations: totalLocationCount,
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

    const anyFailed = results.some((r: any) => !r?.success);

    // Always 200 so the per-clinic `error` string survives the trip. A non-2xx
    // makes supabase-js discard the body and hand the caller a generic
    // "non-2xx status code" message, which hides the reason Google gave us.
    return new Response(JSON.stringify({
      success: !anyFailed,
      results,
    }), {
      status: 200,
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
