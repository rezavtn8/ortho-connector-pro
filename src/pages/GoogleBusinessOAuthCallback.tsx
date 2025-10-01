import React, { useEffect } from 'react';

// This page receives Google's code/state on nexoradental.com and forwards to our Supabase Edge callback
// SEO: minimal, fast redirect
const SUPABASE_URL = "https://vqkzqwibbcvmdwgqladn.supabase.co";

const GoogleBusinessOAuthCallback: React.FC = () => {
  useEffect(() => {
    document.title = 'Google Business OAuth Callback | Nexora Reviews Magic';

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      // Bubble error back to app UI
      window.location.replace(`/review-magic?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      window.location.replace(`/review-magic?error=${encodeURIComponent('Missing code or state')}`);
      return;
    }

    // Forward to the secure Supabase Edge callback which performs the token exchange server-side
    const target = `${SUPABASE_URL}/functions/v1/google-business-oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    window.location.replace(target);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <section className="text-center">
        <h1 className="text-xl font-semibold">Connecting Google Business…</h1>
        <p className="mt-2 text-muted-foreground">Please wait while we complete the secure sign-in.</p>
      </section>
    </main>
  );
};

export default GoogleBusinessOAuthCallback;
