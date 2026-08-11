-- discovered_offices.google_place_id was globally unique, which is wrong for a
-- per-user discovery pool: two clinics in the same city inevitably discover the
-- same office, and the second one to run a search took ownership of the first
-- one's row (the upsert rewrote discovered_by). The office then vanished from
-- the first user's list, taking its `imported` state and any group membership
-- with it.
--
-- The place id is only unique *within* a user's own discoveries.

ALTER TABLE public.discovered_offices
  DROP CONSTRAINT IF EXISTS discovered_offices_google_place_id_key;

-- Collapse any rows the old constraint would have prevented, keeping the most
-- recently fetched copy for each (user, place).
DELETE FROM public.discovered_offices a
USING public.discovered_offices b
WHERE a.discovered_by = b.discovered_by
  AND a.google_place_id = b.google_place_id
  AND (a.fetched_at, a.id) < (b.fetched_at, b.id);

ALTER TABLE public.discovered_offices
  ADD CONSTRAINT discovered_offices_user_place_id_key
  UNIQUE (discovered_by, google_place_id);

-- Discovery reads the pool by owner and by search area on every request.
CREATE INDEX IF NOT EXISTS idx_discovered_offices_owner_cache
  ON public.discovered_offices (discovered_by, clinic_id, cache_expires_at);
