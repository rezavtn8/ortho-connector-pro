-- Phase 5: Fix the last remaining function with search_path issue

-- Fix get_current_month_patients function  
CREATE OR REPLACE FUNCTION public.get_current_month_patients()
 RETURNS TABLE(source_id uuid, source_name text, source_type text, is_office boolean, current_month_patients integer, month_year date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_month_year DATE;
BEGIN
  -- Get first day of current month
  v_month_year := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  RETURN QUERY
  SELECT 
    ps.id AS source_id,
    ps.name AS source_name,
    ps.source_type,
    ps.is_office,
    COALESCE(mpd.patient_count, 0) AS current_month_patients,
    v_month_year AS month_year
  FROM public.patient_sources ps
  LEFT JOIN public.monthly_patient_data mpd
    ON ps.id = mpd.source_id
    AND mpd.month_year = v_month_year
  WHERE ps.created_by = auth.uid()
  ORDER BY ps.source_type, ps.name;
END;
$function$;