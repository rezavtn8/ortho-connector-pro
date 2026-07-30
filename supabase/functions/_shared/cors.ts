/**
 * Shared CORS helper for edge functions.
 *
 * Instead of sending `Access-Control-Allow-Origin: *`, we echo the request's
 * Origin ONLY when it appears in the ALLOWED_ORIGINS edge function secret
 * (comma-separated list of exact origins, e.g.
 * "https://nexoradental.com,https://www.nexoradental.com").
 *
 * If the Origin is missing or not on the list we omit the
 * Access-Control-Allow-Origin header entirely, which makes the browser refuse
 * the response. We never echo an unknown origin, and we never fall back to "*".
 *
 * Non-browser callers (Stripe, cron, auth hooks) send no Origin header and are
 * unaffected: CORS is a browser-enforced control only.
 */

const DEFAULT_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type";

let cachedList: string[] | null = null;

function normalize(origin: string): string {
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

/** Parsed ALLOWED_ORIGINS secret. Empty when the secret is unset. */
export function getAllowedOrigins(): string[] {
  if (cachedList) return cachedList;
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  cachedList = raw
    .split(",")
    .map(normalize)
    .filter((o) => o.length > 0);
  if (cachedList.length === 0) {
    console.warn(
      "[cors] ALLOWED_ORIGINS is not set - all cross-origin browser requests will be refused",
    );
  }
  return cachedList;
}

/**
 * Lovable preview/sandbox hosts are always allowed: they are our own build
 * previews and their subdomain changes per project/branch, so they cannot be
 * pinned as exact strings in the secret.
 */
const ALLOWED_HOST_SUFFIXES = [".lovableproject.com", ".lovable.app"];

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const normalized = normalize(origin);
  if (getAllowedOrigins().includes(normalized)) return true;

  // Support wildcard entries such as "https://*.example.com" in the secret.
  for (const entry of getAllowedOrigins()) {
    if (entry.includes("*")) {
      const pattern = new RegExp(
        "^" + entry.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*") + "$",
      );
      if (pattern.test(normalized)) return true;
    }
  }

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") return false;
    return ALLOWED_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

/**
 * Build CORS response headers for a request.
 * `extra` lets a function keep its own Allow-Headers / Allow-Methods values.
 */
export function getCorsHeaders(
  req: Request,
  extra: Record<string, string> = {},
): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": DEFAULT_ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...extra,
  };

  if (isOriginAllowed(origin)) {
    // origin is non-null here because isOriginAllowed rejects null
    headers["Access-Control-Allow-Origin"] = origin as string;
  }

  return headers;
}

/**
 * Standard preflight response: 204 for an allowed origin, 403 for anything else.
 */
export function handleCorsPreflight(
  req: Request,
  corsHeaders: Record<string, string>,
): Response {
  if (!corsHeaders["Access-Control-Allow-Origin"]) {
    return new Response(null, { status: 403, headers: corsHeaders });
  }
  return new Response(null, { status: 204, headers: corsHeaders });
}
