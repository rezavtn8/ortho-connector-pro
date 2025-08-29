-- Phase 2: Fix database function security by setting search_path

-- Fix all existing functions to have secure search_path
CREATE OR REPLACE FUNCTION public.log_office_metric_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Only log if patient_load actually changed
  IF OLD.patient_load IS DISTINCT FROM NEW.patient_load THEN
    INSERT INTO public.office_metrics_history (
      office_id,
      patient_count,
      metric_value,
      metric_type,
      previous_count,
      timestamp,
      month_year,
      changed_by_user_id
    ) VALUES (
      NEW.id,
      NEW.patient_load,
      NEW.patient_load,
      'patient_count',
      OLD.patient_load,
      now(),
      DATE_TRUNC('month', now()),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_month_sources()
 RETURNS TABLE(source_id uuid, source_name character varying, source_type character varying, current_month_patients integer, month_year character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_current_month VARCHAR;
BEGIN
  v_current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  RETURN QUERY
  SELECT 
    ps.id,
    ps.name,
    ps.source_type::VARCHAR,
    COALESCE(mp.patient_count, 0) as current_month_patients,
    v_current_month as month_year
  FROM public.patient_sources ps
  LEFT JOIN public.monthly_patients mp 
    ON ps.id = mp.source_id 
    AND mp.year_month = v_current_month
  WHERE ps.is_active = true
    AND ps.created_by = auth.uid()
  ORDER BY ps.source_type, ps.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_source_patient_count(p_source_id uuid, p_new_count integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_current_month VARCHAR;
  v_old_count INTEGER;
BEGIN
  v_current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Get current count
  SELECT patient_count INTO v_old_count
  FROM public.monthly_patients
  WHERE source_id = p_source_id AND year_month = v_current_month AND user_id = auth.uid();
  
  -- Insert or update
  INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id, updated_at)
  VALUES (p_source_id, v_current_month, p_new_count, auth.uid(), NOW())
  ON CONFLICT (source_id, year_month)
  DO UPDATE SET 
    patient_count = EXCLUDED.patient_count,
    updated_at = NOW()
  WHERE public.monthly_patients.user_id = auth.uid();
  
  RETURN json_build_object(
    'success', true,
    'source_id', p_source_id,
    'month_year', v_current_month,
    'old_count', COALESCE(v_old_count, 0),
    'new_count', p_new_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_office_metrics(office_id_param uuid, start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date)
 RETURNS TABLE(metric_date date, patient_count integer, referral_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('month', timestamp)::DATE as metric_date,
    MAX(CASE WHEN metric_type = 'patient_count' THEN metric_value ELSE 0 END)::INTEGER as patient_count,
    SUM(CASE WHEN metric_type = 'referral' THEN metric_value ELSE 0 END)::INTEGER as referral_count
  FROM public.office_metrics_history
  WHERE office_id = office_id_param
    AND (start_date IS NULL OR timestamp >= start_date)
    AND (end_date IS NULL OR timestamp <= end_date)
    AND changed_by_user_id = auth.uid()
  GROUP BY DATE_TRUNC('month', timestamp)
  ORDER BY metric_date DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_office_referral(office_id_param uuid, referral_count_param integer DEFAULT 1, referral_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.office_metrics_history (
    office_id,
    metric_type,
    metric_value,
    referral_count,
    timestamp,
    month_year,
    changed_by_user_id
  ) VALUES (
    office_id_param,
    'referral',
    referral_count_param,
    referral_count_param,
    referral_date,
    DATE_TRUNC('month', referral_date),
    auth.uid()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_patient_count(p_source_id uuid, p_year_month character varying, p_delta integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
    v_old_count INTEGER;
    v_new_count INTEGER;
BEGIN
    -- Get current count (only for the authenticated user)
    SELECT patient_count INTO v_old_count
    FROM public.monthly_patients
    WHERE source_id = p_source_id AND year_month = p_year_month AND user_id = auth.uid();
    
    IF v_old_count IS NULL THEN
        v_old_count := 0;
    END IF;
    
    -- Calculate new count
    v_new_count := GREATEST(0, v_old_count + p_delta);
    
    -- Upsert
    INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id)
    VALUES (p_source_id, p_year_month, v_new_count, auth.uid())
    ON CONFLICT (source_id, year_month)
    DO UPDATE SET 
        patient_count = v_new_count,
        updated_at = NOW()
    WHERE public.monthly_patients.user_id = auth.uid();
    
    -- Log change
    INSERT INTO public.patient_changes_log (
        source_id, year_month, old_count, new_count, change_type, user_id
    ) VALUES (
        p_source_id, p_year_month, v_old_count, v_new_count,
        CASE WHEN p_delta > 0 THEN 'increment' ELSE 'decrement' END,
        auth.uid()
    );
    
    RETURN v_new_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_patient_count(p_source_id uuid, p_year_month character varying, p_count integer, p_reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
    v_old_count INTEGER;
BEGIN
    -- Get current count (only for the authenticated user)
    SELECT patient_count INTO v_old_count
    FROM public.monthly_patients
    WHERE source_id = p_source_id AND year_month = p_year_month AND user_id = auth.uid();
    
    IF v_old_count IS NULL THEN
        v_old_count := 0;
    END IF;
    
    -- Set new count
    INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id)
    VALUES (p_source_id, p_year_month, p_count, auth.uid())
    ON CONFLICT (source_id, year_month)
    DO UPDATE SET 
        patient_count = p_count,
        updated_at = NOW()
    WHERE public.monthly_patients.user_id = auth.uid();
    
    -- Log change
    INSERT INTO public.patient_changes_log (
        source_id, year_month, old_count, new_count, change_type, reason, user_id
    ) VALUES (
        p_source_id, p_year_month, v_old_count, p_count, 'manual_edit', p_reason, auth.uid()
    );
    
    RETURN p_count;
END;
$function$;