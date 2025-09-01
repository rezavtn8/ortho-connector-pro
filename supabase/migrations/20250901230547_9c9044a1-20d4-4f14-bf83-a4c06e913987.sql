-- Add Google-related fields to patient_sources table
ALTER TABLE public.patient_sources 
ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1) CHECK (google_rating >= 0 AND google_rating <= 5),
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS opening_hours TEXT,
ADD COLUMN IF NOT EXISTS yelp_rating NUMERIC(2,1) CHECK (yelp_rating >= 0 AND yelp_rating <= 5),
ADD COLUMN IF NOT EXISTS distance_miles NUMERIC(4,1),
ADD COLUMN IF NOT EXISTS last_updated_from_google TIMESTAMP WITH TIME ZONE;