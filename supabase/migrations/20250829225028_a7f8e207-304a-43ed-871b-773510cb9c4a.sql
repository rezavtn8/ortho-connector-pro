-- Phase 4: Fix remaining database functions with search_path issues

-- Fix calculate_source_score function
CREATE OR REPLACE FUNCTION public.calculate_source_score(source_id_param uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  recent_patients INTEGER;
  last_patient_date DATE;
  days_since_patient INTEGER;
  total_patients INTEGER;
BEGIN
  -- Get patient count for past 3 months (only for the authenticated user)
  SELECT COALESCE(SUM(patient_count), 0)
  INTO recent_patients
  FROM public.monthly_patients
  WHERE source_id = source_id_param
    AND year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYY-MM')
    AND user_id = auth.uid();

  -- Get total patients (only for the authenticated user)
  SELECT COALESCE(SUM(patient_count), 0)
  INTO total_patients
  FROM public.monthly_patients
  WHERE source_id = source_id_param
    AND user_id = auth.uid();

  -- Get last patient date (most recent month with patients)
  SELECT MAX(TO_DATE(year_month, 'YYYY-MM'))
  INTO last_patient_date
  FROM public.monthly_patients
  WHERE source_id = source_id_param 
    AND patient_count > 0 
    AND user_id = auth.uid();

  -- Calculate days since last patient
  IF last_patient_date IS NOT NULL THEN
    days_since_patient := CURRENT_DATE - last_patient_date;
  ELSE
    days_since_patient := 9999;
  END IF;

  -- Determine score based on criteria
  IF recent_patients >= 5 AND days_since_patient <= 60 THEN
    RETURN 'Strong';
  ELSIF recent_patients >= 2 AND days_since_patient <= 90 THEN
    RETURN 'Moderate';
  ELSIF total_patients > 0 AND days_since_patient <= 180 THEN
    RETURN 'Sporadic';
  ELSE
    RETURN 'Cold';
  END IF;
END;
$function$;

-- Fix update_patient_count function
CREATE OR REPLACE FUNCTION public.update_patient_count(p_source_id uuid, p_count integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_month_year VARCHAR;
  v_result JSON;
BEGIN
  -- Get current month in YYYY-MM format
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Insert or update the patient count (with user ownership)
  INSERT INTO public.monthly_patients (
    source_id,
    year_month,
    patient_count,
    user_id,
    updated_at
  )
  VALUES (
    p_source_id,
    v_month_year,
    p_count,
    auth.uid(),
    NOW()
  )
  ON CONFLICT (source_id, year_month)
  DO UPDATE SET
    patient_count = EXCLUDED.patient_count,
    updated_at = NOW()
  WHERE public.monthly_patients.user_id = auth.uid();
  
  -- Return the updated data
  SELECT json_build_object(
    'success', true,
    'source_id', p_source_id,
    'month_year', v_month_year,
    'patient_count', p_count
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- Make user_id columns NOT NULL for security
ALTER TABLE public.monthly_patients ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.patient_changes_log ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.source_tags ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.patient_sources ALTER COLUMN created_by SET NOT NULL;