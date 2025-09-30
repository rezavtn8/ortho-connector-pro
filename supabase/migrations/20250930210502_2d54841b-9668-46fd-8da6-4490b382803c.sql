-- Add review count and improve caching for discovered_offices
ALTER TABLE discovered_offices 
ADD COLUMN IF NOT EXISTS user_ratings_total integer,
ADD COLUMN IF NOT EXISTS cache_expires_at timestamp with time zone DEFAULT (now() + interval '7 days'),
ADD COLUMN IF NOT EXISTS last_verified_at timestamp with time zone DEFAULT now();

-- Add index for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_discovered_offices_cache_lookup 
ON discovered_offices(discovered_by, clinic_id, search_distance, cache_expires_at);

-- Add index for place_id lookups (helps with deduplication)
CREATE INDEX IF NOT EXISTS idx_discovered_offices_place_id 
ON discovered_offices(place_id, discovered_by);

-- Update existing rows to have cache expiration dates
UPDATE discovered_offices 
SET cache_expires_at = fetched_at + interval '7 days',
    last_verified_at = fetched_at
WHERE cache_expires_at IS NULL;

-- Add function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_discovered_offices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM discovered_offices
  WHERE cache_expires_at < now()
    AND imported = false;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_discovered_offices() IS 'Removes expired cache entries that have not been imported';

-- Add cache metadata to discovery_sessions
ALTER TABLE discovery_sessions
ADD COLUMN IF NOT EXISTS cache_hit boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cache_age_seconds integer,
ADD COLUMN IF NOT EXISTS api_response_time_ms integer;