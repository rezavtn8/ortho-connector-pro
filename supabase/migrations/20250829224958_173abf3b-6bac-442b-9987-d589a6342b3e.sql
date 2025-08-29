-- Phase 3: Fix remaining database functions and add user profile trigger

-- Fix remaining functions to have secure search_path
CREATE OR REPLACE FUNCTION public.get_patient_load_trend(office_id_param uuid, days_back integer DEFAULT 30)
 RETURNS TABLE(current_count integer, previous_count integer, trend_direction text, last_updated timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  current_val integer;
  comparison_val integer;
  last_update timestamp with time zone;
BEGIN
  -- Get current patient load
  SELECT patient_load INTO current_val
  FROM public.referring_offices
  WHERE id = office_id_param;
  
  -- Get the most recent update timestamp
  SELECT MAX(timestamp) INTO last_update
  FROM public.patient_load_history
  WHERE office_id = office_id_param;
  
  -- Get patient load from specified days ago for comparison
  SELECT patient_count INTO comparison_val
  FROM public.patient_load_history
  WHERE office_id = office_id_param
    AND timestamp <= (now() - (days_back || ' days')::interval)
  ORDER BY timestamp DESC
  LIMIT 1;
  
  -- If no historical data, use current value
  IF comparison_val IS NULL THEN
    comparison_val := current_val;
  END IF;
  
  -- Determine trend direction
  RETURN QUERY SELECT 
    current_val,
    comparison_val,
    CASE 
      WHEN current_val > comparison_val THEN 'up'
      WHEN current_val < comparison_val THEN 'down'
      ELSE 'stable'
    END,
    last_update;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_office_score(office_id_param uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  RETURN public.calculate_source_score(office_id_param);
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_patient_with_period(p_office_id uuid, p_period_type text, p_increment integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_period_start date;
  v_period_end date;
  v_current_total integer;
  v_period_count integer;
  v_previous_period_count integer;
BEGIN
  -- Calculate period boundaries based on current date
  IF p_period_type = 'weekly' THEN
    -- Monday of current week
    v_period_start := date_trunc('week', CURRENT_DATE)::date;
    v_period_end := v_period_start + 6;
  ELSE -- monthly
    -- First day of current month
    v_period_start := date_trunc('month', CURRENT_DATE)::date;
    v_period_end := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
  END IF;

  -- Update the main patient_load counter
  UPDATE public.referring_offices 
  SET 
    patient_load = GREATEST(0, COALESCE(patient_load, 0) + p_increment),
    updated_at = now()
  WHERE id = p_office_id
  RETURNING patient_load INTO v_current_total;

  -- If no row was updated, the office doesn't exist
  IF v_current_total IS NULL THEN
    RAISE EXCEPTION 'Office not found: %', p_office_id;
  END IF;

  -- Record in history with period info
  INSERT INTO public.patient_load_history (
    office_id,
    patient_count,
    previous_count,
    period_type,
    period_start,
    period_end,
    timestamp,
    changed_by_user_id
  ) VALUES (
    p_office_id,
    v_current_total,
    v_current_total - p_increment,
    p_period_type,
    v_period_start,
    v_period_end,
    now(),
    auth.uid()
  );

  -- Count entries in current period
  SELECT COUNT(*) INTO v_period_count
  FROM public.patient_load_history
  WHERE office_id = p_office_id
    AND period_type = p_period_type
    AND period_start = v_period_start;

  -- Get previous period count for comparison
  IF p_period_type = 'weekly' THEN
    SELECT COUNT(*) INTO v_previous_period_count
    FROM public.patient_load_history
    WHERE office_id = p_office_id
      AND period_type = p_period_type
      AND period_start = (v_period_start - interval '7 days')::date;
  ELSE -- monthly
    SELECT COUNT(*) INTO v_previous_period_count
    FROM public.patient_load_history
    WHERE office_id = p_office_id
      AND period_type = p_period_type
      AND period_start = (date_trunc('month', v_period_start - interval '1 month'))::date;
  END IF;

  -- Return comprehensive result
  RETURN json_build_object(
    'new_total', v_current_total,
    'period_count', v_period_count,
    'previous_period_count', COALESCE(v_previous_period_count, 0),
    'period_start', v_period_start,
    'period_end', v_period_end,
    'trend', CASE 
      WHEN v_previous_period_count IS NULL OR v_previous_period_count = 0 THEN 'new'
      WHEN v_period_count > v_previous_period_count THEN 'up'
      WHEN v_period_count < v_previous_period_count THEN 'down'
      ELSE 'stable'
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_office_period_stats(p_office_id uuid, p_period_type text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_period_start date;
  v_period_end date;
  v_current_count integer;
  v_previous_count integer;
  v_total_load integer;
BEGIN
  -- Calculate current period boundaries
  IF p_period_type = 'weekly' THEN
    v_period_start := date_trunc('week', CURRENT_DATE)::date;
    v_period_end := v_period_start + 6;
  ELSE -- monthly
    v_period_start := date_trunc('month', CURRENT_DATE)::date;
    v_period_end := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
  END IF;

  -- Get total patient load
  SELECT patient_load INTO v_total_load
  FROM public.referring_offices
  WHERE id = p_office_id;

  -- Count entries in current period
  SELECT COUNT(*) INTO v_current_count
  FROM public.patient_load_history
  WHERE office_id = p_office_id
    AND period_type = p_period_type
    AND period_start = v_period_start;

  -- If no entries for current period, default to 0
  v_current_count := COALESCE(v_current_count, 0);

  -- Count entries in previous period
  IF p_period_type = 'weekly' THEN
    SELECT COUNT(*) INTO v_previous_count
    FROM public.patient_load_history
    WHERE office_id = p_office_id
      AND period_type = p_period_type
      AND period_start = (v_period_start - interval '7 days')::date;
  ELSE -- monthly
    SELECT COUNT(*) INTO v_previous_count
    FROM public.patient_load_history
    WHERE office_id = p_office_id
      AND period_type = p_period_type
      AND period_start = (date_trunc('month', v_period_start - interval '1 month'))::date;
  END IF;

  v_previous_count := COALESCE(v_previous_count, 0);

  -- Return stats
  RETURN json_build_object(
    'current', v_current_count,
    'previous', v_previous_count,
    'change', v_current_count - v_previous_count,
    'total', COALESCE(v_total_load, 0),
    'period_start', v_period_start,
    'period_end', v_period_end,
    'trend', CASE 
      WHEN v_previous_count = 0 AND v_current_count = 0 THEN 'new'
      WHEN v_previous_count = 0 AND v_current_count > 0 THEN 'up'
      WHEN v_current_count > v_previous_count THEN 'up'
      WHEN v_current_count < v_previous_count THEN 'down'
      ELSE 'stable'
    END
  );
END;
$function$;

-- Create user profile auto-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, role)
  VALUES (NEW.id, NEW.email, 'Front Desk');
  RETURN NEW;
END;
$$;

-- Create trigger for automatic user profile creation on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();