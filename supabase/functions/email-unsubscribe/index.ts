import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(htmlPage("Invalid Request", "No token provided."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Decode and verify token
    let tokenData: { payload: string; signature: string };
    try {
      tokenData = JSON.parse(atob(token));
    } catch {
      return new Response(htmlPage("Invalid Token", "The unsubscribe link is invalid."), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Verify HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(serviceRoleKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = new Uint8Array(
      tokenData.signature.match(/.{2}/g)!.map((b: string) => parseInt(b, 16))
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(tokenData.payload)
    );

    if (!valid) {
      return new Response(htmlPage("Invalid Token", "The unsubscribe link is invalid or expired."), {
        status: 403,
        headers: { "Content-Type": "text/html" },
      });
    }

    const { user_id } = JSON.parse(tokenData.payload);

    // Update user preferences
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get current preferences
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("email_preferences")
      .eq("user_id", user_id)
      .single();

    const currentPrefs = (profile?.email_preferences as Record<string, any>) || {};
    const updatedPrefs = { ...currentPrefs, biweekly_digest: false };

    const { error } = await supabase
      .from("user_profiles")
      .update({ email_preferences: updatedPrefs })
      .eq("user_id", user_id);

    if (error) throw error;

    return new Response(
      htmlPage(
        "Unsubscribed Successfully",
        "You've been unsubscribed from the Biweekly Practice Digest. You can re-enable it anytime in your <a href='https://nexoradental.com/settings' style='color: #6BB7AD;'>Settings</a>."
      ),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (error: any) {
    console.error("Unsubscribe error:", error);
    return new Response(
      htmlPage("Something Went Wrong", "We couldn't process your unsubscribe request. Please try again or manage your preferences in Settings."),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
});

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Nexora Dental</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f6f9fc; }
    .card { background: white; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    h1 { color: #333; font-size: 24px; margin-bottom: 12px; }
    p { color: #666; font-size: 16px; line-height: 1.6; }
    .logo { color: #6BB7AD; font-size: 20px; font-weight: bold; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Nexora Dental</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
