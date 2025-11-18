-- Add logo_url to clinics table for brand logo
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.clinics.logo_url IS 'URL to the clinic brand logo stored in Supabase Storage';

-- Create storage bucket for clinic logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for clinic logos
CREATE POLICY "Clinic logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'clinic-logos');

CREATE POLICY "Authenticated users can upload clinic logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'clinic-logos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their clinic logos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'clinic-logos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their clinic logos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'clinic-logos' 
  AND auth.uid() IS NOT NULL
);