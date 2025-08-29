-- Drop the existing function with its specific signature
DROP FUNCTION IF EXISTS public.get_current_month_sources() CASCADE;

-- Clean up all office-related tables and complex referral logic  
DROP TABLE IF EXISTS public.referring_offices CASCADE;
DROP TABLE IF EXISTS public.patient_load_history CASCADE; 
DROP TABLE IF EXISTS public.office_metrics_history CASCADE;
DROP TABLE IF EXISTS public.monthly_patient_data CASCADE;

-- Drop remaining office-related functions
DROP FUNCTION IF EXISTS public.log_office_metric_change() CASCADE;
DROP FUNCTION IF EXISTS public.log_patient_load_change() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_office_score(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_office_metrics(uuid, date, date) CASCADE;
DROP FUNCTION IF EXISTS public.add_office_referral(uuid, integer, date) CASCADE;
DROP FUNCTION IF EXISTS public.get_patient_load_trend(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.add_patient_with_period(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_office_period_stats(uuid, text) CASCADE;

-- Simplify patient_sources table - remove office-specific fields
ALTER TABLE public.patient_sources 
DROP COLUMN IF EXISTS latitude CASCADE,
DROP COLUMN IF EXISTS longitude CASCADE,
DROP COLUMN IF EXISTS contact_person CASCADE,  
DROP COLUMN IF EXISTS office_hours CASCADE;

-- Update source_type enum to clean it up
ALTER TYPE source_type RENAME TO source_type_old;

CREATE TYPE source_type AS ENUM (
  'Google',
  'Yelp', 
  'Website',
  'Word of Mouth',
  'Insurance',
  'Social Media',
  'Other'
);

-- Update patient_sources to use new enum, convert Office to Other
ALTER TABLE public.patient_sources 
ALTER COLUMN source_type TYPE source_type USING 
  CASE 
    WHEN source_type::text = 'Office' THEN 'Other'::source_type
    ELSE source_type::text::source_type
  END;

DROP TYPE source_type_old;

-- Create simplified function for current month data
CREATE OR REPLACE FUNCTION public.get_current_month_sources()
 RETURNS TABLE(source_id uuid, source_name text, source_type text, current_month_patients integer, month_year text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $$
DECLARE
  v_current_month TEXT;
BEGIN
  v_current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  RETURN QUERY
  SELECT 
    ps.id AS source_id,
    ps.name AS source_name,
    ps.source_type::TEXT,
    COALESCE(mp.patient_count, 0) AS current_month_patients,
    v_current_month AS month_year
  FROM public.patient_sources ps
  LEFT JOIN public.monthly_patients mp 
    ON ps.id = mp.source_id 
    AND mp.year_month = v_current_month
    AND mp.user_id = auth.uid()
  WHERE ps.is_active = true
    AND ps.created_by = auth.uid()
  ORDER BY ps.source_type, ps.name;
END;
$$;