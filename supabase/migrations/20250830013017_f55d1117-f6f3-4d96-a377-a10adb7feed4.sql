-- Phase 2: Create clinic infrastructure and update schema
-- Create clinics table for centralized clinic information
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

-- Enable RLS on clinics table
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Add clinic_id to user_profiles and migrate existing data
ALTER TABLE public.user_profiles ADD COLUMN clinic_id UUID;

-- Create a clinic for existing users and link them
DO $$
DECLARE
    profile_record RECORD;
    new_clinic_id UUID;
BEGIN
    FOR profile_record IN SELECT * FROM public.user_profiles WHERE clinic_id IS NULL LOOP
        INSERT INTO public.clinics (name, address, latitude, longitude, owner_id)
        VALUES (
            COALESCE(profile_record.clinic_name, 'My Clinic'),
            profile_record.clinic_address,
            profile_record.clinic_latitude,
            profile_record.clinic_longitude,
            profile_record.user_id
        )
        RETURNING id INTO new_clinic_id;
        
        UPDATE public.user_profiles 
        SET clinic_id = new_clinic_id 
        WHERE id = profile_record.id;
    END LOOP;
END $$;

-- Make clinic_id not null after migration
ALTER TABLE public.user_profiles ALTER COLUMN clinic_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.user_profiles ADD CONSTRAINT fk_user_profiles_clinic 
FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Create user invitations table
CREATE TABLE public.user_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'Manager',
  invited_by UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Add unique constraint to prevent duplicate invitations
CREATE UNIQUE INDEX idx_user_invitations_email_clinic ON public.user_invitations (email, clinic_id) 
WHERE status = 'pending';

-- Update existing tables to be clinic-based instead of user-based
ALTER TABLE public.patient_sources ADD COLUMN clinic_id UUID;
ALTER TABLE public.marketing_visits ADD COLUMN clinic_id UUID;
ALTER TABLE public.monthly_patients ADD COLUMN clinic_id UUID;
ALTER TABLE public.patient_changes_log ADD COLUMN clinic_id UUID;
ALTER TABLE public.source_tags ADD COLUMN clinic_id UUID;

-- Migrate existing data to use clinic_id
UPDATE public.patient_sources SET clinic_id = (
  SELECT clinic_id FROM public.user_profiles WHERE user_id = patient_sources.created_by
);

UPDATE public.marketing_visits SET clinic_id = (
  SELECT clinic_id FROM public.user_profiles WHERE user_id = marketing_visits.user_id
);

UPDATE public.monthly_patients SET clinic_id = (
  SELECT clinic_id FROM public.user_profiles WHERE user_id = monthly_patients.user_id
);

UPDATE public.patient_changes_log SET clinic_id = (
  SELECT clinic_id FROM public.user_profiles WHERE user_id = patient_changes_log.user_id
);

UPDATE public.source_tags SET clinic_id = (
  SELECT clinic_id FROM public.user_profiles WHERE user_id = source_tags.user_id
);

-- Make clinic_id not null for all tables
ALTER TABLE public.patient_sources ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.marketing_visits ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.monthly_patients ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.patient_changes_log ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.source_tags ALTER COLUMN clinic_id SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE public.patient_sources ADD CONSTRAINT fk_patient_sources_clinic 
FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.marketing_visits ADD CONSTRAINT fk_marketing_visits_clinic 
FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.monthly_patients ADD CONSTRAINT fk_monthly_patients_clinic 
FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.patient_changes_log ADD CONSTRAINT fk_patient_changes_log_clinic 
FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.source_tags ADD CONSTRAINT fk_source_tags_clinic 
FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;