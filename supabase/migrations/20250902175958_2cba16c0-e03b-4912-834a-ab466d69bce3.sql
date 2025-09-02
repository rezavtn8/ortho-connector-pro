-- Add Google Place ID to clinics table
ALTER TABLE public.clinics 
ADD COLUMN google_place_id TEXT;