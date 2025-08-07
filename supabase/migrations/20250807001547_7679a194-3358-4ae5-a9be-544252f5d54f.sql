-- Drop trigger first, then function, then recreate both with proper search path
DROP TRIGGER IF EXISTS patient_load_change_trigger ON public.referring_offices;
DROP FUNCTION IF EXISTS public.log_patient_load_change();
DROP FUNCTION IF EXISTS public.get_patient_load_trend(uuid, integer);

-- Recreate functions with proper search path
CREATE OR REPLACE FUNCTION public.log_patient_load_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only log if patient_load actually changed
  IF OLD.patient_load IS DISTINCT FROM NEW.patient_load THEN
    INSERT INTO public.patient_load_history (
      office_id,
      patient_count,
      previous_count,
      timestamp,
      changed_by_user_id
    ) VALUES (
      NEW.id,
      NEW.patient_load,
      OLD.patient_load,
      now(),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER patient_load_change_trigger
  AFTER UPDATE OF patient_load ON public.referring_offices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_patient_load_change();

-- Recreate trend function with proper search path
CREATE OR REPLACE FUNCTION public.get_patient_load_trend(office_id_param uuid, days_back integer DEFAULT 30)
RETURNS TABLE (
  current_count integer,
  previous_count integer,
  trend_direction text,
  last_updated timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;