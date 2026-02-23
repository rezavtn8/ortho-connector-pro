
# Email System — COMPLETED

All steps implemented except pg_cron scheduling (requires manual SQL execution).

## What Was Done

1. ✅ **Welcome email fixed** — "Get Started" button now links to `https://nexoradental.lovable.app`
2. ✅ **email_preferences column** added to `user_profiles` (jsonb, defaults all to true)
3. ✅ **Settings Notifications tab** — now DB-backed with Switch components, includes Biweekly Digest toggle
4. ✅ **Biweekly Digest edge function** — `send-biweekly-digest` deployed, fetches practice data per user and sends via Resend
5. ✅ **Unsubscribe endpoint** — `email-unsubscribe` deployed with HMAC-signed token verification
6. ✅ **config.toml** updated with new function entries
7. ✅ **pg_cron + pg_net extensions** enabled

## Remaining: Schedule the Cron Job

Run this SQL in the Supabase SQL Editor (cannot be done via read-only query tool):

```sql
SELECT cron.schedule(
  'send-biweekly-digest',
  '0 9 1,15 * *',
  $$
  SELECT net.http_post(
    url := 'https://vqkzqwibbcvmdwgqladn.supabase.co/functions/v1/send-biweekly-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxa3pxd2liYmN2bWR3Z3FsYWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDAyMDQsImV4cCI6MjA2OTE3NjIwNH0.S6qvIFA1itxemVUTzfz4dDr2J9jz2z69NEv-fgb4gK4"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
```
