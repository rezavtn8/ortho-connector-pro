-- Fix security issues identified by the linter

-- 1. Fix function search path issues by setting search_path for existing functions
-- Update all functions that don't have search_path set to use 'public'

-- Fix the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Check if there are any SECURITY DEFINER views and convert them to regular views if safe
-- First, let's identify any security definer views by looking at the views
DO $$
DECLARE
    view_record RECORD;
BEGIN
    -- Look for views that might be security definer
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        -- Log the view for inspection
        RAISE NOTICE 'Found view: %.%', view_record.schemaname, view_record.viewname;
    END LOOP;
END
$$;

-- 3. Update other functions to ensure they have proper search_path
-- We'll update the existing functions to ensure they have search_path set

-- Update encrypt_pin_code function
CREATE OR REPLACE FUNCTION public.encrypt_pin_code(pin_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pin_text IS NULL OR pin_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN crypt(pin_text, gen_salt('bf'));
END;
$$;

-- Update verify_pin_code function
CREATE OR REPLACE FUNCTION public.verify_pin_code(pin_text text, encrypted_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pin_text IS NULL OR encrypted_pin IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN (crypt(pin_text, encrypted_pin) = encrypted_pin);
END;
$$;

-- Update update_user_pin_code function
CREATE OR REPLACE FUNCTION public.update_user_pin_code(new_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_pin TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Validate PIN format (4-6 digits)
  IF new_pin IS NOT NULL AND (new_pin !~ '^[0-9]{4,6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be 4-6 digits');
  END IF;
  
  -- Encrypt the PIN
  IF new_pin IS NOT NULL THEN
    v_encrypted_pin := encrypt_pin_code(new_pin);
  ELSE
    v_encrypted_pin := NULL;
  END IF;
  
  -- Update the user's PIN
  UPDATE public.user_profiles 
  SET pin_code = v_encrypted_pin, updated_at = NOW()
  WHERE user_id = v_user_id;
  
  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$$;

-- Update other key functions with proper search_path
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM public.user_profiles WHERE user_id = auth.uid();
$$;

-- Update user_has_clinic_admin_access function
CREATE OR REPLACE FUNCTION public.user_has_clinic_admin_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.clinics c ON up.clinic_id = c.id
    WHERE up.user_id = auth.uid() 
    AND (up.role = 'Owner' OR c.owner_id = up.user_id)
  );
$$;

-- 4. Drop and recreate dashboard_summary view as a regular view instead of security definer
-- First check if it exists and what type it is
DROP VIEW IF EXISTS public.dashboard_summary CASCADE;

-- Create a regular view for dashboard_summary
CREATE VIEW public.dashboard_summary AS
SELECT 
  up.user_id,
  (
    SELECT json_build_object(
      'total_sources', COUNT(*),
      'active_sources', COUNT(*) FILTER (WHERE ps.is_active = true),
      'total_patients_this_month', COALESCE(SUM(mp.patient_count), 0),
      'total_patients_last_month', COALESCE(SUM(mp_last.patient_count), 0)
    )
    FROM public.patient_sources ps
    LEFT JOIN public.monthly_patients mp ON ps.id = mp.source_id 
      AND mp.year_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
      AND mp.user_id = up.user_id
    LEFT JOIN public.monthly_patients mp_last ON ps.id = mp_last.source_id 
      AND mp_last.year_month = TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM')
      AND mp_last.user_id = up.user_id
    WHERE ps.created_by = up.user_id
  ) AS summary_data,
  (
    SELECT json_agg(
      json_build_object(
        'month', month_data.month,
        'total_patients', month_data.total_patients
      ) ORDER BY month_data.month
    )
    FROM (
      SELECT 
        mp.year_month AS month,
        SUM(mp.patient_count) AS total_patients
      FROM public.monthly_patients mp
      JOIN public.patient_sources ps ON mp.source_id = ps.id
      WHERE ps.created_by = up.user_id
        AND mp.user_id = up.user_id
        AND mp.year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '11 months', 'YYYY-MM')
      GROUP BY mp.year_month
    ) month_data
  ) AS monthly_trends,
  (
    SELECT json_agg(
      json_build_object(
        'source_type', source_data.source_type,
        'count', source_data.count,
        'total_patients', source_data.total_patients
      )
    )
    FROM (
      SELECT 
        ps.source_type::text,
        COUNT(*) as count,
        COALESCE(SUM(mp.patient_count), 0) as total_patients
      FROM public.patient_sources ps
      LEFT JOIN public.monthly_patients mp ON ps.id = mp.source_id 
        AND mp.year_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        AND mp.user_id = up.user_id
      WHERE ps.created_by = up.user_id
      GROUP BY ps.source_type
    ) source_data
  ) AS source_groups
FROM public.user_profiles up
WHERE up.user_id = auth.uid();

-- 5. Drop and recreate office_metrics view as a regular view
DROP VIEW IF EXISTS public.office_metrics CASCADE;

-- Create office_metrics as a regular view
CREATE VIEW public.office_metrics AS
SELECT 
  ps.id,
  ps.name,
  ps.address,
  ps.phone,
  ps.email,
  ps.website,
  ps.notes,
  ps.latitude,
  ps.longitude,
  ps.google_rating,
  ps.google_place_id,
  ps.opening_hours,
  ps.yelp_rating,
  ps.distance_miles,
  ps.last_updated_from_google,
  ps.is_active,
  ps.created_at,
  ps.updated_at,
  ps.created_by,
  -- Calculate L12 (Last 12 months)
  COALESCE((
    SELECT SUM(mp.patient_count)
    FROM public.monthly_patients mp
    WHERE mp.source_id = ps.id
      AND mp.user_id = ps.created_by
      AND mp.year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '11 months', 'YYYY-MM')
  ), 0) AS l12,
  -- Calculate R3 (Recent 3 months)
  COALESCE((
    SELECT SUM(mp.patient_count)
    FROM public.monthly_patients mp
    WHERE mp.source_id = ps.id
      AND mp.user_id = ps.created_by
      AND mp.year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '2 months', 'YYYY-MM')
  ), 0) AS r3,
  -- Calculate MSLR (Months Since Last Referral)
  COALESCE((
    SELECT DATE_PART('month', AGE(CURRENT_DATE, TO_DATE(MAX(mp.year_month), 'YYYY-MM')))
    FROM public.monthly_patients mp
    WHERE mp.source_id = ps.id
      AND mp.user_id = ps.created_by
      AND mp.patient_count > 0
  ), 999) AS mslr,
  -- Total patients all time
  COALESCE((
    SELECT SUM(mp.patient_count)
    FROM public.monthly_patients mp
    WHERE mp.source_id = ps.id
      AND mp.user_id = ps.created_by
  ), 0) AS total_patients,
  -- Calculate tier based on R3 and MSLR
  CASE 
    WHEN COALESCE((
      SELECT SUM(mp.patient_count)
      FROM public.monthly_patients mp
      WHERE mp.source_id = ps.id
        AND mp.user_id = ps.created_by
        AND mp.year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '2 months', 'YYYY-MM')
    ), 0) >= 5 AND COALESCE((
      SELECT DATE_PART('month', AGE(CURRENT_DATE, TO_DATE(MAX(mp.year_month), 'YYYY-MM')))
      FROM public.monthly_patients mp
      WHERE mp.source_id = ps.id
        AND mp.user_id = ps.created_by
        AND mp.patient_count > 0
    ), 999) <= 2 THEN 'Strong'
    WHEN COALESCE((
      SELECT SUM(mp.patient_count)
      FROM public.monthly_patients mp
      WHERE mp.source_id = ps.id
        AND mp.user_id = ps.created_by
        AND mp.year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '2 months', 'YYYY-MM')
    ), 0) >= 2 AND COALESCE((
      SELECT DATE_PART('month', AGE(CURRENT_DATE, TO_DATE(MAX(mp.year_month), 'YYYY-MM')))
      FROM public.monthly_patients mp
      WHERE mp.source_id = ps.id
        AND mp.user_id = ps.created_by
        AND mp.patient_count > 0
    ), 999) <= 3 THEN 'Moderate'
    WHEN COALESCE((
      SELECT SUM(mp.patient_count)
      FROM public.monthly_patients mp
      WHERE mp.source_id = ps.id
        AND mp.user_id = ps.created_by
    ), 0) > 0 AND COALESCE((
      SELECT DATE_PART('month', AGE(CURRENT_DATE, TO_DATE(MAX(mp.year_month), 'YYYY-MM')))
      FROM public.monthly_patients mp
      WHERE mp.source_id = ps.id
        AND mp.user_id = ps.created_by
        AND mp.patient_count > 0
    ), 999) <= 6 THEN 'Sporadic'
    ELSE 'Cold'
  END AS tier
FROM public.patient_sources ps
WHERE ps.created_by = auth.uid();