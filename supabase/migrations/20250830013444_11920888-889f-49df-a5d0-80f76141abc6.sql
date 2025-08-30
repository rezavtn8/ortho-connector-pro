-- Create user invitations table first
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

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_user_invitations_email_clinic ON public.user_invitations (email, clinic_id) 
WHERE status = 'pending';

-- Add clinic_id columns (nullable initially)
ALTER TABLE public.patient_sources ADD COLUMN clinic_id UUID;
ALTER TABLE public.marketing_visits ADD COLUMN clinic_id UUID;
ALTER TABLE public.monthly_patients ADD COLUMN clinic_id UUID;
ALTER TABLE public.patient_changes_log ADD COLUMN clinic_id UUID;
ALTER TABLE public.source_tags ADD COLUMN clinic_id UUID;

-- Update records that have corresponding user profiles
UPDATE public.patient_sources SET clinic_id = (
  SELECT up.clinic_id FROM public.user_profiles up WHERE up.user_id = patient_sources.created_by
) WHERE EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.user_id = patient_sources.created_by
);

UPDATE public.marketing_visits SET clinic_id = (
  SELECT up.clinic_id FROM public.user_profiles up WHERE up.user_id = marketing_visits.user_id
) WHERE EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.user_id = marketing_visits.user_id
);

UPDATE public.monthly_patients SET clinic_id = (
  SELECT up.clinic_id FROM public.user_profiles up WHERE up.user_id = monthly_patients.user_id
) WHERE EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.user_id = monthly_patients.user_id
);

UPDATE public.patient_changes_log SET clinic_id = (
  SELECT up.clinic_id FROM public.user_profiles up WHERE up.user_id = patient_changes_log.user_id
) WHERE EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.user_id = patient_changes_log.user_id
);

UPDATE public.source_tags SET clinic_id = (
  SELECT up.clinic_id FROM public.user_profiles up WHERE up.user_id = source_tags.user_id
) WHERE EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.user_id = source_tags.user_id
);

-- Delete orphaned records that can't be linked to any clinic
DELETE FROM public.patient_sources WHERE clinic_id IS NULL;
DELETE FROM public.marketing_visits WHERE clinic_id IS NULL;
DELETE FROM public.monthly_patients WHERE clinic_id IS NULL;
DELETE FROM public.patient_changes_log WHERE clinic_id IS NULL;
DELETE FROM public.source_tags WHERE clinic_id IS NULL;

-- Now make clinic_id not null and add constraints
ALTER TABLE public.patient_sources ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.marketing_visits ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.monthly_patients ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.patient_changes_log ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.source_tags ALTER COLUMN clinic_id SET NOT NULL;

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