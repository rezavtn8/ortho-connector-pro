

# Comprehensive Security Analysis

## Executive Summary

The application has a solid security foundation — Zod validation, DOMPurify sanitization, RLS policies, rate limiting, and session timeout management are all in place. However, there are several medium-to-critical issues that should be addressed.

---

## CRITICAL Issues

### 1. Stripe Webhook Has No Signature Verification
**File:** `supabase/functions/stripe-webhook/index.ts`

The webhook handler accepts any POST request without verifying the Stripe signature. An attacker can forge webhook payloads to grant themselves subscriptions or manipulate billing state. The code even has a comment saying "Placeholder" — this must be completed before going live with payments.

**Fix:** Implement `stripe.webhooks.constructEvent(payload, sig, webhookSecret)` to verify the `stripe-signature` header.

---

### 2. `correct-office-addresses` Decodes JWT Without Verifying Signature
**File:** `supabase/functions/correct-office-addresses/index.ts` (lines 78-90)

The code manually decodes the JWT payload with `atob()` and trusts the `sub` claim **without cryptographic verification**. An attacker can craft a fake JWT with any `user_id` and the function will accept it. It then uses a `SUPABASE_SERVICE_ROLE_KEY` client to perform operations, so RLS is bypassed entirely.

**Fix:** Replace manual JWT decoding with `supabase.auth.getClaims(token)` or `supabase.auth.getUser(token)`.

---

### 3. `discover-nearby-offices` Also Decodes JWT Without Verification
**File:** `supabase/functions/discover-nearby-offices/index.ts` (lines 38-50)

Same vulnerability as above — manually decodes JWT base64 payload, trusts `sub` without verification, then uses a service-role client. Any crafted token grants full access.

**Fix:** Same as above — use `getClaims()`.

---

### 4. `sync-google-business-reviews` Has No Authentication At All
**File:** `supabase/functions/sync-google-business-reviews/index.ts`

This function uses `SUPABASE_SERVICE_ROLE_KEY` and accepts a `clinic_id` from the request body with zero authentication. Anyone who knows the function URL can trigger a sync for any clinic, and the function reads/writes Google Business tokens (including access tokens and refresh tokens) for arbitrary users.

**Fix:** Add JWT verification to ensure only the token owner can trigger their own sync.

---

### 5. `send-welcome-email` Webhook Secret is Optional
**File:** `supabase/functions/send-welcome-email/index.ts` (line 35)

The webhook verification is wrapped in `if (hookSecret)` — if `SEND_EMAIL_HOOK_SECRET` is not set, any caller can trigger welcome emails to arbitrary addresses. This could be used for email spam/abuse.

**Fix:** Make webhook verification mandatory, or add an alternative auth check.

---

## HIGH Issues

### 6. Client-Side Rate Limiting is Trivially Bypassable
**File:** `src/hooks/useAuth.ts` (lines 40-97)

Login rate limiting is stored in `localStorage`. An attacker can simply clear localStorage (or use a private window) to reset the counter and brute-force passwords indefinitely. The server-side `check_rate_limit` DB function exists but is never called during authentication.

**Fix:** Implement server-side rate limiting for auth attempts (Supabase has built-in rate limiting on auth endpoints, but custom enforcement via the `check_rate_limit` function should be wired up).

---

### 7. Inconsistent Auth Patterns Across Edge Functions
Some functions use `getClaims()` (secure — `get-mapbox-token`, `ai-forecast`, `refresh-google-business-token`), while others use `getUser()` (works but slower), and two functions manually decode JWTs without verification. This inconsistency creates confusion and risk.

**Functions using insecure manual JWT decoding:**
- `correct-office-addresses`
- `discover-nearby-offices`

**Functions using no auth at all:**
- `sync-google-business-reviews`
- `stripe-webhook`

---

### 8. CORS is `Access-Control-Allow-Origin: *` on All Functions
Every edge function sets `'Access-Control-Allow-Origin': '*'`. This means any website can make authenticated requests to your edge functions if it has the user's token. For functions that handle sensitive data (Google Business tokens, AI analysis, address corrections), this should be restricted to your domain.

**Fix:** Replace `'*'` with `'https://nexoradental.lovable.app'` (or use an environment variable for the allowed origin).

---

## MEDIUM Issues

### 9. `dashboard_summary` View/Table Has No RLS Policies
The `dashboard_summary` table has RLS enabled but zero policies defined. This means **no user can read from it via the client** (which may cause silent failures), OR if RLS is accidentally disabled, all users' summaries are exposed.

**Fix:** Add a SELECT policy: `USING (user_id = auth.uid())`.

---

### 10. Several Foreign Key References Are Missing
Multiple tables (`campaign_deliveries`, `campaigns`, `marketing_visits`, etc.) show empty `<foreign-keys>` sections. Without FK constraints, orphaned records can accumulate and referential integrity is not enforced at the database level.

---

### 11. `SafeText` Uses `dangerouslySetInnerHTML` After Escaping
**File:** `src/components/SafeText.tsx`

The `escapeHTML` function correctly escapes content, but then `SafeText` renders it via `dangerouslySetInnerHTML`. While currently safe because `escapeHTML` is applied first, this pattern is fragile — a future refactor could accidentally pass unsanitized content. Simply using `{safeContent}` as a text child would be safer and simpler.

---

### 12. `handle_new_user` Trigger Embeds the Anon Key in Plain Text
**File:** DB function `handle_new_user()`

The Supabase anon key is hardcoded in the trigger function body. While the anon key is technically public, embedding it in a database function means it cannot be rotated without a migration. The trigger also calls the edge function via `net.http_post` with this key — if the key is rotated, signup breaks silently.

---

### 13. No Password Reset Flow
There is no `/reset-password` page or forgot-password component. Users who forget their password have no way to recover their accounts.

---

## LOW Issues

### 14. `user_profiles.role` is Stored Directly on the Profile Table
Per security best practices (and the system instructions), roles should be in a separate `user_roles` table to prevent privilege escalation. Currently, `user_profiles` has a `role` column, and while the `validate_user_profile_update` trigger prevents self-promotion to "Owner", a more robust approach would use a separate table with a `SECURITY DEFINER` function.

---

### 15. No CSRF Protection
The Supabase auth flow relies on bearer tokens (not cookies), so traditional CSRF is not a major risk. However, the Google OAuth callback and other state-changing GET endpoints could benefit from anti-CSRF state parameters.

---

### 16. Edge Function Dependency Versions Are Pinned to Old Versions
Multiple functions use `@supabase/supabase-js@2.7.1` (from 2023). The client library has had security patches since then. Consider updating to a consistent, recent version across all functions.

---

## Prioritized Action Items

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | Fix Stripe webhook — add signature verification | Small |
| P0 | Fix `correct-office-addresses` — replace manual JWT decode with `getClaims()` | Small |
| P0 | Fix `discover-nearby-offices` — replace manual JWT decode with `getClaims()` | Small |
| P0 | Fix `sync-google-business-reviews` — add authentication | Small |
| P1 | Make `send-welcome-email` webhook secret mandatory | Small |
| P1 | Restrict CORS to your domain on sensitive functions | Medium |
| P1 | Add server-side auth rate limiting | Medium |
| P1 | Add RLS policy to `dashboard_summary` | Small |
| P2 | Standardize all edge functions to use `getClaims()` | Medium |
| P2 | Remove `dangerouslySetInnerHTML` from SafeText | Small |
| P2 | Implement password reset flow | Medium |
| P3 | Move roles to separate table | Large |
| P3 | Update edge function dependency versions | Small |

