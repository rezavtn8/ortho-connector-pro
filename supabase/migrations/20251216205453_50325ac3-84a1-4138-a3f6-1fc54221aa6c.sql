-- Remove overly strict phone and website format constraints
-- These are causing updates to fail because Google's data doesn't always match
ALTER TABLE patient_sources DROP CONSTRAINT IF EXISTS patient_sources_phone_format_check;
ALTER TABLE patient_sources DROP CONSTRAINT IF EXISTS patient_sources_website_format_check;

-- Unify discovered_offices columns to match patient_sources structure
-- Rename place_id → google_place_id
ALTER TABLE discovered_offices RENAME COLUMN place_id TO google_place_id;

-- Rename lat → latitude
ALTER TABLE discovered_offices RENAME COLUMN lat TO latitude;

-- Rename lng → longitude
ALTER TABLE discovered_offices RENAME COLUMN lng TO longitude;

-- Rename rating → google_rating
ALTER TABLE discovered_offices RENAME COLUMN rating TO google_rating;

-- Add missing columns that patient_sources has
ALTER TABLE discovered_offices 
ADD COLUMN IF NOT EXISTS email varchar(255),
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS yelp_rating numeric,
ADD COLUMN IF NOT EXISTS opening_hours text,
ADD COLUMN IF NOT EXISTS distance_miles numeric,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Update unique constraint on google_place_id (was place_id)
ALTER TABLE discovered_offices DROP CONSTRAINT IF EXISTS discovered_offices_place_id_key;
ALTER TABLE discovered_offices ADD CONSTRAINT discovered_offices_google_place_id_key UNIQUE (google_place_id);