import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

/**
 * Login throttle.
 *
 * Threat model, learned the hard way — the first version of this function blocked on the
 * email address alone and let any unauthenticated caller assert both failures and
 * successes. That was exploitable in both directions:
 *
 *   - Lockout: POST {email, action:"failure"} five times and the owner of that address is
 *     locked out for 15 minutes. Repeat forever for a permanent denial of service against
 *     any address you can guess.
 *   - Bypass: POST {email, action:"success"} to clear the counter between guesses, so the
 *     limit never actually bit and brute force was unimpeded.
 *
 * Two rules follow, and both matter:
 *
 *   1. NEVER block on the email alone. Blocking decisions are keyed on the caller's IP,
 *      and on the (IP, email) pair. An attacker can then only throttle themselves — they
 *      cannot reach across the internet and lock out a stranger. The email-only counter is
 *      still recorded, but purely for observability.
 *   2. NEVER take the client's word that a login succeeded. A reset requires a real access
 *      token, verified against the auth server, whose email matches the one being reset.
 *      Someone who can produce that token has the password already and has nothing to gain.
 */

const MAX_PER_IP_EMAIL = 5; // guesses at one account from one address
const MAX_PER_IP = 20; // guesses at any account from one address
const WINDOW_MINUTES = 15;

type Action = "check" | "failure" | "success";

/** Never store raw emails or IPs in the log — key on a salted hash. */
async function hashIdentifier(value: string): Promise<string> {
  const salt = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const data = new TextEncoder().encode(`${salt}:${value.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Caller IP. Supabase sits behind Cloudflare, so the left-most x-forwarded-for entry is
 * the client. It is spoofable in principle, but spoofing it only lets an attacker pick
 * which bucket to fill — they still cannot target a specific victim's account, because
 * nothing blocks on the email by itself.
 */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

function makeJson(corsHeaders: Record<string, string>) {
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  });
  const json = makeJson(corsHeaders);

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req, corsHeaders);
  }

  if (req.method !== "POST") {
    return json({ allowed: false, error: "Method not allowed" }, 405);
  }

  try {
    let payload: { email?: unknown; action?: unknown; accessToken?: unknown };
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

    const ip = clientIp(req);
    const ipKey = await hashIdentifier(`ip:${ip}`);
    const pairKey = await hashIdentifier(`ip:${ip}|email:${email}`);

    // A reset must be earned. Verify the access token really belongs to this email
    // before clearing anything — otherwise "success" is a free bypass of the limiter.
    if (action === "success") {
      const accessToken = typeof payload.accessToken === "string" ? payload.accessToken : "";
      if (!accessToken) {
        return json({ allowed: false, error: "A verified session is required to reset" }, 401);
      }

      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
      const verifiedEmail = userData?.user?.email?.trim().toLowerCase();
      if (userError || !verifiedEmail || verifiedEmail !== email) {
        console.warn("Rejected rate-limit reset: token did not match the supplied email");
        return json({ allowed: false, error: "A verified session is required to reset" }, 401);
      }

      for (const key of [ipKey, pairKey]) {
        const { error } = await supabase.rpc("reset_login_rate_limit", { p_key: key });
        if (error) throw error;
      }
      return json({ allowed: true, attempts: 0, remaining: MAX_PER_IP_EMAIL, retry_after_seconds: 0 });
    }

    const record = action === "failure";

    // Both buckets advance together on a failure, and the stricter verdict wins.
    const [pairRes, ipRes] = await Promise.all([
      supabase.rpc("check_login_rate_limit", {
        p_key: pairKey,
        p_record_failure: record,
        p_max_attempts: MAX_PER_IP_EMAIL,
        p_window_minutes: WINDOW_MINUTES,
      }),
      supabase.rpc("check_login_rate_limit", {
        p_key: ipKey,
        p_record_failure: record,
        p_max_attempts: MAX_PER_IP,
        p_window_minutes: WINDOW_MINUTES,
      }),
    ]);
    if (pairRes.error) throw pairRes.error;
    if (ipRes.error) throw ipRes.error;

    type Verdict = {
      allowed: boolean;
      attempts: number;
      remaining: number;
      retry_after_seconds: number;
    };
    const pair = pairRes.data as Verdict;
    const perIp = ipRes.data as Verdict;

    // Observability only. Recorded so a distributed attack on one account is visible in
    // the log, but deliberately never consulted for the block decision.
    if (record) {
      const emailKey = await hashIdentifier(`email:${email}`);
      await supabase.rpc("check_login_rate_limit", {
        p_key: emailKey,
        p_record_failure: true,
        p_max_attempts: 2147483647,
        p_window_minutes: WINDOW_MINUTES,
      });
    }

    const allowed = pair.allowed && perIp.allowed;
    if (!allowed) {
      const retryAfter = Math.max(pair.retry_after_seconds, perIp.retry_after_seconds);
      console.warn(
        `Login throttled for ip hash ${ipKey.slice(0, 12)}… (pair ${pair.attempts}, ip ${perIp.attempts})`,
      );
      return json(
        {
          allowed: false,
          attempts: Math.max(pair.attempts, perIp.attempts),
          remaining: 0,
          retry_after_seconds: retryAfter,
          error: "Too many failed sign-in attempts from this device. Please try again later.",
        },
        429,
      );
    }

    return json({
      allowed: true,
      attempts: pair.attempts,
      remaining: Math.min(pair.remaining, perIp.remaining),
      retry_after_seconds: 0,
    });
  } catch (err) {
    console.error("auth-rate-limit error:", err);
    // Fail closed: if the limiter cannot be evaluated, do not hand out attempts.
    return json({ allowed: false, error: "Rate limit check unavailable" }, 503);
  }
});
