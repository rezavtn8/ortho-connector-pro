-- Competitor Watch: make the snapshot history cheap to read and automatic to build.
--
-- Two independent parts. Part 1 is safe everywhere and should always be applied.
-- Part 2 needs pg_cron and pg_net and a couple of settings, and is written so it
-- skips itself cleanly on a project that does not have them.

-- ---------------------------------------------------------------------------
-- Part 1: indexes
--
-- competitor_snapshots had no index other than its primary key and the
-- (watchlist_id, snapshot_date) unique constraint. Every read the page makes is
-- scoped by user_id — RLS adds `user_id = auth.uid()` to all of them — so the
-- whole table was scanned on each load, and the table grows by one row per
-- watched practice per day forever.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_user_date
  ON public.competitor_snapshots USING btree (user_id, snapshot_date DESC);

-- The refresh path asks "which of this user's practices already have a snapshot
-- today", which is this index exactly.
CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_user_watchlist
  ON public.competitor_snapshots USING btree (user_id, watchlist_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_competitor_watchlist_user_active
  ON public.competitor_watchlist USING btree (user_id)
  WHERE (is_active = true);


-- ---------------------------------------------------------------------------
-- Part 2: scheduled snapshots, every third night (optional)
--
-- Without this, history only accumulates on days somebody opens the page and
-- presses Refresh, which is exactly the wrong sampling: the weeks nobody looks
-- are the weeks a competitor's review campaign goes unrecorded. Movement
-- detection and every trend line on the page are drawn from these rows.
--
-- Sampling every third day rather than nightly cuts the Google bill to a third.
-- Nothing on the page assumes daily rows: velocity is measured over real
-- elapsed days and surge detection compares a competitor against their own
-- baseline, so wider spacing changes when a change is noticed, not whether.
--
-- Before applying, set the two settings the job reads. The secret must match the
-- COMPETITOR_CRON_SECRET edge function secret, and the endpoint is unauthorised
-- without it:
--
--   ALTER DATABASE postgres SET app.settings.project_url        = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres SET app.settings.competitor_cron_secret = '<same value as the edge secret>';
--
-- Cost note: this bills one Google Place Details call per watched practice per
-- three days, for every account that watches anything. At the 25-practice
-- watchlist cap that is at most 25 calls per account every three days, roughly
-- 250 a month. Set COMPETITOR_SNAPSHOT_INTERVAL_DAYS to change the spacing
-- without touching this schedule.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  project_url text;
  cron_secret text;
BEGIN
  IF to_regproc('cron.schedule') IS NULL OR to_regproc('net.http_post') IS NULL THEN
    RAISE NOTICE 'pg_cron and/or pg_net not installed - skipping nightly competitor snapshots. Indexes above were still created.';
    RETURN;
  END IF;

  project_url := current_setting('app.settings.project_url', true);
  cron_secret := current_setting('app.settings.competitor_cron_secret', true);

  IF project_url IS NULL OR cron_secret IS NULL THEN
    RAISE NOTICE 'app.settings.project_url or app.settings.competitor_cron_secret is unset - skipping nightly competitor snapshots.';
    RETURN;
  END IF;

  -- Re-running the migration must not stack duplicate jobs.
  PERFORM cron.unschedule('competitor-nightly-snapshot')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'competitor-nightly-snapshot');

  -- 07:10 UTC on every third day of the month: after midnight in every US
  -- timezone, so a run lands on one calendar day per local day and
  -- snapshot_date stays one row per real day.
  --
  -- '*/3' on day-of-month restarts at the 1st, so the 31st and the 1st can fall
  -- on consecutive days. That does not cost anything: the function itself skips
  -- any practice snapshotted within COMPETITOR_SNAPSHOT_INTERVAL_DAYS (3), so
  -- the spacing is guaranteed there rather than by this expression.
  PERFORM cron.schedule(
    'competitor-nightly-snapshot',
    '10 7 */3 * *',
    format(
      $job$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'x-cron-secret', %L
        ),
        body    := jsonb_build_object('action', 'refresh-all'),
        timeout_milliseconds := 300000
      );
      $job$,
      project_url || '/functions/v1/competitor-snapshot',
      cron_secret
    )
  );

  RAISE NOTICE 'Scheduled competitor-nightly-snapshot at 07:10 UTC daily.';
END
$$;
