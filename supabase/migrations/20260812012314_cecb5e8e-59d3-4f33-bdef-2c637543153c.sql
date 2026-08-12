CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_user_date
  ON public.competitor_snapshots USING btree (user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_user_watchlist
  ON public.competitor_snapshots USING btree (user_id, watchlist_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_competitor_watchlist_user_active
  ON public.competitor_watchlist USING btree (user_id)
  WHERE (is_active = true);