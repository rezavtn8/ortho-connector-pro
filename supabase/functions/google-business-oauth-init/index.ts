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

    // SECURITY CHECK: Verify user owns a clinic
    const { data: clinics, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (clinicError || !clinics) {
      return new Response(JSON.stringify({ 
        error: 'Only clinic owners can connect Google Business Profile',
        message: 'You must own a clinic to use Reviews Magic'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if clinic already has a token
    const { data: existingToken } = await supabase
      .from('google_business_tokens')
      .select('id')
      .eq('clinic_id', clinics.id)
      .maybeSingle();

    if (existingToken) {
      return new Response(JSON.stringify({
        error: 'Google Business Profile already connected',
        message: 'This clinic already has a connected Google Business Profile'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // We'll finalize the OAuth state after computing redirect strategy
    let encodedState = '';

    // Get OAuth credentials and determine redirect strategy
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');

    // Read optional body to decide redirect target
    let preferredRedirect: 'supabase' | 'site' = 'supabase';
    let siteOrigin: string | null = null;
    try {
      if (req.method === 'POST' && (req.headers.get('content-type') || '').includes('application/json')) {
        const body = await req.json().catch(() => null);
        if (body?.redirect_target === 'site') preferredRedirect = 'site';
        if (typeof body?.site_origin === 'string') siteOrigin = body.site_origin;
      }
    } catch (_) {
      // ignore body parse errors
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!clientId) {
      throw new Error('GOOGLE_OAUTH_CLIENT_ID not configured');
    }
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL not configured');
    }

    // Allow-listed site origins that can be used for OAuth redirect
    const allowedOrigins = [
      'https://nexoradental.com',
      supabaseUrl.replace('.supabase.co', '.lovable.app'),
      'http://localhost:5173',
      'http://localhost:3000',
    ];

    // Decide redirect URI
    let redirectUri = `${supabaseUrl}/functions/v1/google-business-oauth-callback`;
    if (preferredRedirect === 'site' && siteOrigin && allowedOrigins.includes(siteOrigin)) {
      redirectUri = `${siteOrigin}/google-business/oauth/callback`;
    }

    // Debug logging (safe): verify values used to build the OAuth URL
    console.info('oauth-init env', {
      client_id_preview: clientId ? `${clientId.slice(0, 6)}...${clientId.slice(-4)}` : null,
      redirect_uri: redirectUri,
      supabase_url_matches_project: supabaseUrl?.includes('vqkzqwibbcvmdwgqladn.supabase.co') ?? false,
      preferredRedirect,
      siteOrigin,
      siteOriginAllowed: siteOrigin ? allowedOrigins.includes(siteOrigin) : null,
    });

    // Finalize OAuth state now that redirect is decided
    const statePayload: Record<string, unknown> = {
      user_id: user.id,
      clinic_id: clinics.id,
      timestamp: Date.now(),
    };
    if (preferredRedirect === 'site' && siteOrigin && allowedOrigins.includes(siteOrigin)) {
      // Include origin to let the callback redirect back to the same site domain
      // (validated again server-side in the callback function)
      // @ts-ignore - Deno runtime
      statePayload.site_origin = siteOrigin;
    }
    encodedState = btoa(JSON.stringify(statePayload));

    // Build OAuth URL
    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', encodedState);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    console.info('oauth-init authUrl constructed', { authorization_url: authUrl.toString() });

    return new Response(JSON.stringify({
      authorization_url: authUrl.toString(),
      state: encodedState,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in google-business-oauth-init:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
