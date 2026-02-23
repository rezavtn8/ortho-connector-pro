
# Email System Finalization: Welcome + Biweekly Digest

## Overview

Set up a complete email system using Resend with two emails:
1. **Welcome email** (already exists but needs fixes)
2. **Biweekly practice digest** (new -- automated via pg_cron)

Plus a database-backed unsubscribe system with a toggle in Settings.

---

## What Exists Today

- `send-welcome-email` edge function exists and is triggered by the `handle_new_user()` database trigger on signup
- Welcome email template exists at `_templates/welcome.tsx` but the "Get Started" button links to the Supabase URL instead of the app URL
- Notification preferences are stored in localStorage only (not persisted to DB)
- `RESEND_API_KEY` secret is already configured

---

## Step 1: Fix Welcome Email

**File:** `supabase/functions/send-welcome-email/_templates/welcome.tsx`

- Change the "Get Started" button link from `https://vqkzqwibbcvmdwgqladn.supabase.co` to `https://nexoradental.lovable.app`
- No other changes needed -- the template, trigger, and edge function are working

---

## Step 2: Add Email Preferences to Database

**Migration:** Add `email_preferences` column to `user_profiles`

```sql
ALTER TABLE public.user_profiles
ADD COLUMN email_preferences jsonb NOT NULL DEFAULT '{"biweekly_digest": true, "weekly_reports": true, "monthly_reports": true, "referral_alerts": true}'::jsonb;
```

This replaces the current localStorage-only approach. The `biweekly_digest` key controls the new digest email opt-in.

---

## Step 3: Update Settings Notifications Tab

**File:** `src/pages/SettingsResilient.tsx`

- Replace the localStorage-based notification preferences with database-backed `email_preferences` from `user_profiles`
- Add a new toggle: "Biweekly Practice Digest" with description "Receive a summary of your practice activity every two weeks"
- Save/load preferences via Supabase instead of localStorage
- Use the Switch component from the UI library instead of raw checkboxes

---

## Step 4: Create Biweekly Digest Edge Function

**New file:** `supabase/functions/send-biweekly-digest/index.ts`

This function:
1. Queries all users where `email_preferences->>'biweekly_digest' = 'true'`
2. For each user, fetches their practice summary data:
   - Total new patients in last 14 days (from `daily_patients`)
   - Top 5 referring offices by patient count (from `monthly_patients` + `patient_sources`)
   - New offices added (from `patient_sources` created in last 14 days)
   - Marketing visits completed (from `marketing_visits`)
   - Campaigns sent (from `campaigns`)
3. Renders a React email template with the data
4. Sends via Resend in batch

Uses service role key to query across users (since it runs as a cron job, not as a user).

**New file:** `supabase/functions/send-biweekly-digest/_templates/digest.tsx`

A React Email template showing:
- Header with Nexora logo
- "Your Practice Summary -- [Date Range]"
- Stats cards: New Patients | Visits Completed | Offices Added
- Top Referring Offices table (name, patient count)
- Campaign activity summary
- Footer with unsubscribe link pointing to `https://nexoradental.lovable.app/settings` (Notifications tab)

---

## Step 5: Create Unsubscribe Endpoint

**New file:** `supabase/functions/email-unsubscribe/index.ts`

A simple GET endpoint that:
1. Takes a signed token parameter (`?token=...`) containing the user_id
2. Updates `user_profiles.email_preferences` to set `biweekly_digest: false`
3. Returns an HTML page confirming "You have been unsubscribed"

The token is a base64-encoded `{user_id, type}` signed with HMAC using `SUPABASE_SERVICE_ROLE_KEY` to prevent tampering.

---

## Step 6: Set Up pg_cron Schedule

Run a SQL insert (not migration) to schedule the digest every 2 weeks:

```sql
SELECT cron.schedule(
  'send-biweekly-digest',
  '0 9 1,15 * *',  -- 9 AM UTC on the 1st and 15th of each month
  $$
  SELECT net.http_post(
    url := 'https://vqkzqwibbcvmdwgqladn.supabase.co/functions/v1/send-biweekly-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
```

Requires enabling `pg_cron` and `pg_net` extensions first.

---

## Step 7: Update config.toml

Add entries for the new edge functions:

```toml
[functions.send-biweekly-digest]
verify_jwt = false

[functions.email-unsubscribe]
verify_jwt = false
```

Both use code-level auth: the digest function checks for a shared secret/service key, and the unsubscribe function verifies the signed token.

---

## Files Changed/Created

| File | Action |
|------|--------|
| `supabase/functions/send-welcome-email/_templates/welcome.tsx` | Fix "Get Started" URL |
| `src/pages/SettingsResilient.tsx` | DB-backed notification prefs with biweekly toggle |
| `supabase/functions/send-biweekly-digest/index.ts` | New -- digest sender |
| `supabase/functions/send-biweekly-digest/_templates/digest.tsx` | New -- digest email template |
| `supabase/functions/email-unsubscribe/index.ts` | New -- one-click unsubscribe |
| `supabase/config.toml` | Add new function entries |
| Migration | Add `email_preferences` column to `user_profiles` |

---

## Technical Notes

- The digest function uses `SUPABASE_SERVICE_ROLE_KEY` to query all users (bypasses RLS) since it runs as a system cron, not a user request
- Unsubscribe tokens are HMAC-signed to prevent unauthorized preference changes
- The cron runs on the 1st and 15th of each month at 9 AM UTC (biweekly cadence)
- Resend batch sending is used to stay within rate limits
- Users who signed up after the welcome email fix will see the correct app URL
