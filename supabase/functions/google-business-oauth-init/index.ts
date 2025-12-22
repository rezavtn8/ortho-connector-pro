import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-business-oauth-callback`;

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user with token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      throw new Error('Not authenticated');
    }

    console.log('User authenticated:', user.id);

    // Get user's clinic
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError.message);
      throw new Error('Failed to get user profile');
    }

    if (!profile?.clinic_id) {
      throw new Error('No clinic found. Please complete onboarding first.');
    }

    console.log('Clinic found:', profile.clinic_id);

    // Parse request body for redirect URL
    let successRedirectUrl = 'https://nexoradental.com/review-magic';
    try {
      const body = await req.json();
      if (body.redirect_url) {
        successRedirectUrl = body.redirect_url;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Get Google OAuth client ID
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    if (!clientId) {
      throw new Error('Google OAuth not configured');
    }

    // Create state with all necessary info
    const state = btoa(JSON.stringify({
      user_id: user.id,
      clinic_id: profile.clinic_id,
      timestamp: Date.now(),
      redirect_url: successRedirectUrl,
    }));

    // Google Business Profile scopes
    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
    ].join(' ');

    // Build authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    console.log('OAuth init success:', {
      user_id: user.id,
      clinic_id: profile.clinic_id,
      redirect_uri: REDIRECT_URI,
    });

    return new Response(
      JSON.stringify({ 
        auth_url: authUrl.toString(),
        state,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('OAuth init error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
