import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";


import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

type Action = "check" | "failure" | "success";

/** Never store raw emails in the rate limit log — key on a salted hash. */
async function hashIdentifier(email: string): Promise<string> {
  const salt = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const data = new TextEncoder().encode(`${salt}:${email.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" });

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req, corsHeaders);
  }

  try {
    let payload: { email?: unknown; action?: unknown };
    try {
      payload = await req.json();
    } catch {
      return json({ allowed: false, error: "Invalid JSON body" }, 400);
    }

    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const action = (typeof payload.action === "string" ? payload.action : "check") as Action;

    if (!email || email.length > 255 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ allowed: false, error: "A valid email is required" }, 400);
    }
    if (!["check", "failure", "success"].includes(action)) {
      return json({ allowed: false, error: "Unknown action" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const key = await hashIdentifier(email);

    if (action === "success") {
      const { error } = await supabase.rpc("reset_login_rate_limit", { p_key: key });
      if (error) throw error;
      return json({ allowed: true, attempts: 0, remaining: MAX_ATTEMPTS, retry_after_seconds: 0 });
    }

    const { data, error } = await supabase.rpc("check_login_rate_limit", {
      p_key: key,
      p_record_failure: action === "failure",
      p_max_attempts: MAX_ATTEMPTS,
      p_window_minutes: WINDOW_MINUTES,
    });
    if (error) throw error;

    const result = data as {
      allowed: boolean;
      attempts: number;
      remaining: number;
      retry_after_seconds: number;
    };

    if (!result.allowed) {
      console.warn(`Login rate limit hit for key ${key.slice(0, 12)}… (${result.attempts} attempts)`);
      return json(
        {
          allowed: false,
          attempts: result.attempts,
          remaining: 0,
          retry_after_seconds: result.retry_after_seconds,
          error: "Too many failed sign-in attempts. Please try again later.",
        },
        429,
      );
    }

    return json(result);
  } catch (err) {
    console.error("auth-rate-limit error:", err);
    // Fail closed: if the limiter cannot be evaluated, do not hand out attempts.
    return json({ allowed: false, error: "Rate limit check unavailable" }, 503);
  }
});
