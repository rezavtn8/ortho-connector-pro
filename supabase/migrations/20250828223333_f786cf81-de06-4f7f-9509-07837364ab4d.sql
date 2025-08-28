-- Clear existing data and set up source-based tracking
DELETE FROM monthly_patients;
DELETE FROM source_tags;
DELETE FROM patient_sources;

-- Insert predefined source types using existing schema
INSERT INTO patient_sources (name, source_type, is_active) VALUES
('Google', 'Online', true),
('Yelp', 'Online', true), 
('Website', 'Online', true),
('Word of Mouth', 'Referral', true),
('Office Referrals', 'Office', true);

-- Update monthly_patients table structure
ALTER TABLE monthly_patients ADD COLUMN IF NOT EXISTS month_display VARCHAR(7) GENERATED ALWAYS AS (year_month) STORED;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_monthly_patients_month ON monthly_patients(year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_patients_source ON monthly_patients(source_id);

-- Function to get monthly data for a source
CREATE OR REPLACE FUNCTION public.get_source_monthly_data(p_source_id uuid, p_months_back integer DEFAULT 12)
RETURNS TABLE(month_year VARCHAR, patient_count INTEGER, month_display VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    mp.year_month,
    mp.patient_count,
    mp.year_month as month_display
  FROM monthly_patients mp
  WHERE mp.source_id = p_source_id
    AND mp.year_month >= TO_CHAR(CURRENT_DATE - (p_months_back || ' months')::INTERVAL, 'YYYY-MM')
  ORDER BY mp.year_month DESC;
END;
$function$;

-- Function to get current month data for all sources
CREATE OR REPLACE FUNCTION public.get_current_month_sources()
RETURNS TABLE(source_id uuid, source_name VARCHAR, source_type VARCHAR, current_month_patients INTEGER, month_year VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
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
  FROM patient_sources ps
  LEFT JOIN monthly_patients mp 
    ON ps.id = mp.source_id 
    AND mp.year_month = v_current_month
  WHERE ps.is_active = true
  ORDER BY ps.source_type, ps.name;
END;
$function$;

-- Function to update patient count for current month
CREATE OR REPLACE FUNCTION public.update_source_patient_count(p_source_id uuid, p_new_count integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_current_month VARCHAR;
  v_old_count INTEGER;
BEGIN
  v_current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Get current count
  SELECT patient_count INTO v_old_count
  FROM monthly_patients
  WHERE source_id = p_source_id AND year_month = v_current_month;
  
  -- Insert or update
  INSERT INTO monthly_patients (source_id, year_month, patient_count, updated_at)
  VALUES (p_source_id, v_current_month, p_new_count, NOW())
  ON CONFLICT (source_id, year_month)
  DO UPDATE SET 
    patient_count = EXCLUDED.patient_count,
    updated_at = NOW();
  
  RETURN json_build_object(
    'success', true,
    'source_id', p_source_id,
    'month_year', v_current_month,
    'old_count', COALESCE(v_old_count, 0),
    'new_count', p_new_count
  );
END;
$function$;