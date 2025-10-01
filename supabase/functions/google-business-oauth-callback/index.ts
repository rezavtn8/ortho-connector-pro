import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      // Redirect to app with error
      return Response.redirect(`${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/review-magic?error=${error}`, 302);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // Decode state
    const stateData = JSON.parse(atob(state));
    const { user_id, clinic_id, timestamp } = stateData;

    // Verify state is not too old (15 minutes)
    if (Date.now() - timestamp > 15 * 60 * 1000) {
      throw new Error('State expired');
    }

    // Exchange code for tokens
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const redirectUri = `${supabaseUrl}/functions/v1/google-business-oauth-callback`;

    // Debug logging (safe)
    console.info('oauth-callback params', {
      client_id_preview: clientId ? `${clientId.slice(0, 6)}...${clientId.slice(-4)}` : null,
      redirect_uri: redirectUri,
      code_present: Boolean(code),
      state_length: state?.length ?? 0,
      supabase_url_matches_project: supabaseUrl?.includes('vqkzqwibbcvmdwgqladn.supabase.co') ?? false,
    });

    if (!clientId || !clientSecret) {
      throw new Error('OAuth credentials not configured');
    }
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL not configured');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokens;

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Store tokens in database
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    
    const { error: insertError } = await supabase
      .from('google_business_tokens')
      .insert({
        user_id,
        clinic_id,
        access_token,
        refresh_token,
        expires_at: expiresAt.toISOString(),
        scope,
      });

    if (insertError) {
      console.error('Failed to store tokens:', insertError);
      throw new Error('Failed to store OAuth tokens');
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      p_user_id: user_id,
      p_action_type: 'GOOGLE_BUSINESS_CONNECTED',
      p_table_name: 'google_business_tokens',
      p_details: { clinic_id, scope },
    });

    // Trigger initial sync
    await supabase.functions.invoke('sync-google-business-reviews', {
      body: { clinic_id },
    });

    // Redirect to app with success
    return Response.redirect(`${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/review-magic?connected=true`, 302);

  } catch (error: any) {
    console.error('Error in google-business-oauth-callback:', error);
    return Response.redirect(`${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/review-magic?error=${encodeURIComponent(error.message)}`, 302);
  }
};

serve(handler);
