import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-business-oauth-callback`;

serve(async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Parse state to get redirect URL
    let redirectBase = 'https://nexoradental.com';
    let userId: string | null = null;
    let clinicId: string | null = null;

    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        userId = stateData.user_id;
        clinicId = stateData.clinic_id;
        
        // Extract origin from redirect_url in state
        if (stateData.redirect_url) {
          const redirectUrl = new URL(stateData.redirect_url);
          redirectBase = redirectUrl.origin;
        }
        
        // Verify state is not too old (15 minutes)
        if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
          return Response.redirect(`${redirectBase}/review-magic?error=Session%20expired`, 302);
        }
      } catch (e) {
        console.error('Failed to parse state:', e);
      }
    }

    // Handle Google OAuth error
    if (error) {
      console.error('Google OAuth error:', error, errorDescription);
      const errorMsg = encodeURIComponent(errorDescription || error);
      return Response.redirect(`${redirectBase}/review-magic?error=${errorMsg}`, 302);
    }

    // Validate required parameters
    if (!code || !userId || !clinicId) {
      console.error('Missing params:', { code: !!code, userId: !!userId, clinicId: !!clinicId });
      return Response.redirect(`${redirectBase}/review-magic?error=Missing%20required%20parameters`, 302);
    }

    // Get OAuth credentials
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('Missing OAuth credentials');
      return Response.redirect(`${redirectBase}/review-magic?error=OAuth%20not%20configured`, 302);
    }

    console.log('Exchanging code for tokens:', {
      redirect_uri: REDIRECT_URI,
      client_id_preview: `${clientId.slice(0, 20)}...`,
    });

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', JSON.stringify(tokenData));
      const errorMsg = tokenData.error_description || tokenData.error || 'Token exchange failed';
      return Response.redirect(`${redirectBase}/review-magic?error=${encodeURIComponent(errorMsg)}`, 302);
    }

    console.log('Token exchange successful, storing tokens...');

    const { access_token, refresh_token, expires_in, scope, token_type } = tokenData;

    // Validate we got the required tokens
    if (!access_token || !refresh_token) {
      console.error('Missing tokens in response:', { 
        has_access_token: !!access_token, 
        has_refresh_token: !!refresh_token 
      });
      return Response.redirect(`${redirectBase}/review-magic?error=Missing%20tokens%20in%20response`, 302);
    }

    // Create Supabase client with service role
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Delete any existing token for this clinic
    await supabase
      .from('google_business_tokens')
      .delete()
      .eq('clinic_id', clinicId);

    // Store new tokens
    const { error: insertError } = await supabase
      .from('google_business_tokens')
      .insert({
        user_id: userId,
        clinic_id: clinicId,
        access_token,
        refresh_token,
        token_type: token_type || 'Bearer',
        expires_at: expiresAt.toISOString(),
        scope: scope || 'https://www.googleapis.com/auth/business.manage',
      });

    if (insertError) {
      console.error('Failed to store tokens:', insertError);
      return Response.redirect(`${redirectBase}/review-magic?error=Failed%20to%20store%20credentials`, 302);
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      p_user_id: userId,
      p_action_type: 'GOOGLE_BUSINESS_CONNECTED',
      p_table_name: 'google_business_tokens',
      p_details: { clinic_id: clinicId, scope },
    });

    console.log('OAuth complete, redirecting to:', `${redirectBase}/review-magic?connected=true`);

    // Redirect to success page
    return Response.redirect(`${redirectBase}/review-magic?connected=true`, 302);

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return Response.redirect(`https://nexoradental.com/review-magic?error=${encodeURIComponent(error.message)}`, 302);
  }
});
