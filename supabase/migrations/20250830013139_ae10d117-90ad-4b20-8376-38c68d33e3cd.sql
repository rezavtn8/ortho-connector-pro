-- Step 1: Create clinics table
CREATE TABLE public.clinics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Step 2: Add clinic_id to user_profiles (nullable first)
ALTER TABLE public.user_profiles ADD COLUMN clinic_id UUID;

-- Step 3: Create clinics for existing users and link them
INSERT INTO public.clinics (name, address, latitude, longitude, owner_id)
SELECT 
  COALESCE(clinic_name, 'My Clinic') as name,
  clinic_address as address,
  clinic_latitude as latitude,
  clinic_longitude as longitude,
  user_id as owner_id
FROM public.user_profiles
WHERE clinic_id IS NULL;

-- Step 4: Update user_profiles with their clinic_id
UPDATE public.user_profiles 
SET clinic_id = c.id
FROM public.clinics c
WHERE c.owner_id = public.user_profiles.user_id AND public.user_profiles.clinic_id IS NULL;

-- Step 5: Make clinic_id not null and add foreign key
ALTER TABLE public.user_profiles ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.user_profiles ADD CONSTRAINT fk_user_profiles_clinic 
FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;