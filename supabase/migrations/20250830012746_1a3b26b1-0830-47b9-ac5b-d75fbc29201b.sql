-- Phase 1: Add Manager role to existing enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Manager';

-- Phase 2: Create clinics table for centralized clinic information
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

-- Phase 3: Add clinic_id to user_profiles and migrate existing data
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

-- Phase 4: Create user invitations table
CREATE TABLE public.user_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'Manager',
  invited_by UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Add unique constraint to prevent duplicate invitations
CREATE UNIQUE INDEX idx_user_invitations_email_clinic ON public.user_invitations (email, clinic_id) 
WHERE status = 'pending';

-- Phase 5: Update existing tables to be clinic-based instead of user-based
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

-- Phase 6: Create security functions
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT clinic_id FROM public.user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL  
SECURITY DEFINER
STABLE
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_has_clinic_admin_access()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE  
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.clinics c ON up.clinic_id = c.id
    WHERE up.user_id = auth.uid() 
    AND (up.role = 'Owner' OR c.owner_id = up.user_id)
  );
$$;

-- Phase 7: Update RLS policies to be clinic-based

-- Clinics policies
CREATE POLICY "Users can view their clinic" ON public.clinics
FOR SELECT USING (id = public.get_user_clinic_id());

CREATE POLICY "Owners can update their clinic" ON public.clinics  
FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create clinics" ON public.clinics
FOR INSERT WITH CHECK (owner_id = auth.uid());

-- User profiles policies (replace existing)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

CREATE POLICY "Users can view profiles in their clinic" ON public.user_profiles
FOR SELECT USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.user_profiles
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Owners can update clinic user profiles" ON public.user_profiles
FOR UPDATE USING (
  public.user_has_clinic_admin_access() 
  AND clinic_id = public.get_user_clinic_id()
);

-- Patient sources policies (replace existing)
DROP POLICY IF EXISTS "Users can do everything with sources" ON public.patient_sources;
DROP POLICY IF EXISTS "Users can view their own patient sources" ON public.patient_sources;
DROP POLICY IF EXISTS "Users can insert their own patient sources" ON public.patient_sources;
DROP POLICY IF EXISTS "Users can update their own patient sources" ON public.patient_sources;
DROP POLICY IF EXISTS "Users can delete their own patient sources" ON public.patient_sources;

CREATE POLICY "Users can view clinic patient sources" ON public.patient_sources
FOR SELECT USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can insert clinic patient sources" ON public.patient_sources  
FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id() AND created_by = auth.uid());

CREATE POLICY "Users can update clinic patient sources" ON public.patient_sources
FOR UPDATE USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can delete clinic patient sources" ON public.patient_sources
FOR DELETE USING (clinic_id = public.get_user_clinic_id());

-- Marketing visits policies (replace existing)
DROP POLICY IF EXISTS "Users can view their own marketing visits" ON public.marketing_visits;
DROP POLICY IF EXISTS "Users can insert their own marketing visits" ON public.marketing_visits;
DROP POLICY IF EXISTS "Users can update their own marketing visits" ON public.marketing_visits;  
DROP POLICY IF EXISTS "Users can delete their own marketing visits" ON public.marketing_visits;

CREATE POLICY "Users can view clinic marketing visits" ON public.marketing_visits
FOR SELECT USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can insert clinic marketing visits" ON public.marketing_visits
FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id() AND user_id = auth.uid());

CREATE POLICY "Users can update clinic marketing visits" ON public.marketing_visits
FOR UPDATE USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can delete clinic marketing visits" ON public.marketing_visits
FOR DELETE USING (clinic_id = public.get_user_clinic_id());

-- Monthly patients policies (replace existing)
DROP POLICY IF EXISTS "Users can view their own monthly patients" ON public.monthly_patients;
DROP POLICY IF EXISTS "Users can insert their own monthly patients" ON public.monthly_patients;
DROP POLICY IF EXISTS "Users can update their own monthly patients" ON public.monthly_patients;
DROP POLICY IF EXISTS "Users can delete their own monthly patients" ON public.monthly_patients;

CREATE POLICY "Users can view clinic monthly patients" ON public.monthly_patients  
FOR SELECT USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can insert clinic monthly patients" ON public.monthly_patients
FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id() AND user_id = auth.uid());

CREATE POLICY "Users can update clinic monthly patients" ON public.monthly_patients
FOR UPDATE USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can delete clinic monthly patients" ON public.monthly_patients
FOR DELETE USING (clinic_id = public.get_user_clinic_id());

-- Patient changes log policies (replace existing)
DROP POLICY IF EXISTS "Users can view their own patient changes log" ON public.patient_changes_log;
DROP POLICY IF EXISTS "Users can insert their own patient changes log" ON public.patient_changes_log;

CREATE POLICY "Users can view clinic patient changes log" ON public.patient_changes_log
FOR SELECT USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can insert clinic patient changes log" ON public.patient_changes_log
FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id() AND user_id = auth.uid());

-- Source tags policies (replace existing)
DROP POLICY IF EXISTS "Users can view their own source tags" ON public.source_tags;
DROP POLICY IF EXISTS "Users can insert their own source tags" ON public.source_tags;
DROP POLICY IF EXISTS "Users can update their own source tags" ON public.source_tags;
DROP POLICY IF EXISTS "Users can delete their own source tags" ON public.source_tags;

CREATE POLICY "Users can view clinic source tags" ON public.source_tags
FOR SELECT USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can insert clinic source tags" ON public.source_tags
FOR INSERT WITH CHECK (clinic_id = public.get_user_clinic_id() AND user_id = auth.uid());

CREATE POLICY "Users can update clinic source tags" ON public.source_tags  
FOR UPDATE USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can delete clinic source tags" ON public.source_tags
FOR DELETE USING (clinic_id = public.get_user_clinic_id());

-- User invitations policies
CREATE POLICY "Clinic admins can view invitations" ON public.user_invitations
FOR SELECT USING (
  public.user_has_clinic_admin_access() 
  AND clinic_id = public.get_user_clinic_id()
);

CREATE POLICY "Clinic admins can create invitations" ON public.user_invitations
FOR INSERT WITH CHECK (
  public.user_has_clinic_admin_access()
  AND clinic_id = public.get_user_clinic_id()
  AND invited_by = auth.uid()
);

CREATE POLICY "Clinic admins can update invitations" ON public.user_invitations
FOR UPDATE USING (
  public.user_has_clinic_admin_access()
  AND clinic_id = public.get_user_clinic_id()
);

-- Phase 8: Update database functions to be clinic-aware
CREATE OR REPLACE FUNCTION public.update_patient_count(p_source_id uuid, p_count integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_month_year VARCHAR;
  v_result JSON;
  v_clinic_id UUID;
BEGIN
  -- Get current month in YYYY-MM format
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Get user's clinic_id
  SELECT clinic_id INTO v_clinic_id FROM public.user_profiles WHERE user_id = auth.uid();
  
  -- Insert or update the patient count (with clinic ownership)
  INSERT INTO public.monthly_patients (
    source_id,
    year_month,
    patient_count,
    user_id,
    clinic_id,
    updated_at
  )
  VALUES (
    p_source_id,
    v_month_year,
    p_count,
    auth.uid(),
    v_clinic_id,
    NOW()
  )
  ON CONFLICT (source_id, year_month)
  DO UPDATE SET
    patient_count = EXCLUDED.patient_count,
    updated_at = NOW()
  WHERE public.monthly_patients.clinic_id = v_clinic_id;
  
  -- Return the updated data
  SELECT json_build_object(
    'success', true,
    'source_id', p_source_id,
    'month_year', v_month_year,
    'patient_count', p_count
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Update other functions to be clinic-aware
CREATE OR REPLACE FUNCTION public.set_patient_count(p_source_id uuid, p_year_month character varying, p_count integer, p_reason text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_old_count INTEGER;
    v_clinic_id UUID;
BEGIN
    -- Get user's clinic_id
    SELECT clinic_id INTO v_clinic_id FROM public.user_profiles WHERE user_id = auth.uid();
    
    -- Get current count (only for the authenticated user's clinic)
    SELECT patient_count INTO v_old_count
    FROM public.monthly_patients
    WHERE source_id = p_source_id AND year_month = p_year_month AND clinic_id = v_clinic_id;
    
    IF v_old_count IS NULL THEN
        v_old_count := 0;
    END IF;
    
    -- Set new count
    INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id, clinic_id)
    VALUES (p_source_id, p_year_month, p_count, auth.uid(), v_clinic_id)
    ON CONFLICT (source_id, year_month)
    DO UPDATE SET 
        patient_count = p_count,
        updated_at = NOW()
    WHERE public.monthly_patients.clinic_id = v_clinic_id;
    
    -- Log change
    INSERT INTO public.patient_changes_log (
        source_id, year_month, old_count, new_count, change_type, reason, user_id, clinic_id
    ) VALUES (
        p_source_id, p_year_month, v_old_count, p_count, 'manual_edit', p_reason, auth.uid(), v_clinic_id
    );
    
    RETURN p_count;
END;
$$;

-- Phase 9: Create user management functions
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_invitation RECORD;
    v_user_email TEXT;
BEGIN
    -- Get current user email
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
    
    -- Find valid invitation
    SELECT * INTO v_invitation
    FROM public.user_invitations
    WHERE token = p_token 
    AND email = v_user_email
    AND status = 'pending'
    AND expires_at > now();
    
    IF v_invitation IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
    END IF;
    
    -- Update user profile with clinic and role
    UPDATE public.user_profiles 
    SET clinic_id = v_invitation.clinic_id, role = v_invitation.role
    WHERE user_id = auth.uid();
    
    -- Mark invitation as accepted
    UPDATE public.user_invitations
    SET status = 'accepted'
    WHERE id = v_invitation.id;
    
    RETURN json_build_object('success', true, 'clinic_id', v_invitation.clinic_id);
END;
$$;