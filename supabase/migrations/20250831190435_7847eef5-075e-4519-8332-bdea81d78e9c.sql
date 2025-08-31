-- Add coordinates fields to patient_sources table for map functionality
ALTER TABLE public.patient_sources 
ADD COLUMN latitude NUMERIC,
ADD COLUMN longitude NUMERIC;

-- Add an index for better performance on location queries
CREATE INDEX idx_patient_sources_coordinates ON public.patient_sources USING btree (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add a comment to explain the new columns
COMMENT ON COLUMN public.patient_sources.latitude IS 'Latitude coordinate for mapping office locations';
COMMENT ON COLUMN public.patient_sources.longitude IS 'Longitude coordinate for mapping office locations';