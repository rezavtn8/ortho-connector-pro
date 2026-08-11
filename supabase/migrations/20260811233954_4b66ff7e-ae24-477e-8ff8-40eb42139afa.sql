ALTER TABLE public.discovered_offices
  DROP CONSTRAINT IF EXISTS discovered_offices_google_place_id_key;

DELETE FROM public.discovered_offices a
USING public.discovered_offices b
WHERE a.discovered_by = b.discovered_by
  AND a.google_place_id = b.google_place_id
  AND (a.fetched_at, a.id) < (b.fetched_at, b.id);

ALTER TABLE public.discovered_offices
  ADD CONSTRAINT discovered_offices_user_place_id_key
  UNIQUE (discovered_by, google_place_id);

CREATE INDEX IF NOT EXISTS idx_discovered_offices_owner_cache
  ON public.discovered_offices (discovered_by, clinic_id, cache_expires_at);