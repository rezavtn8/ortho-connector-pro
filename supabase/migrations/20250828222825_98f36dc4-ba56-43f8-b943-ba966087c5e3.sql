-- Drop office-specific tables and data since we're moving to source-based tracking
DROP TABLE IF EXISTS patient_changes_log CASCADE;

-- Update patient_sources to be simpler source types instead of individual offices
DELETE FROM patient_sources;

-- Insert predefined source types
INSERT INTO patient_sources (name, source_type, is_office, is_active) VALUES
('Google', 'Online', false, true),
('Yelp', 'Online', false, true),
('Website', 'Online', false, true),
('Word of Mouth', 'Referral', false, true),
('Office Referrals', 'Office', true, true);

-- Update monthly_patients table to work with source-based tracking
ALTER TABLE monthly_patients DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE monthly_patients ADD COLUMN IF NOT EXISTS month_display VARCHAR(7) GENERATED ALWAYS AS (year_month) STORED;

-- Create index for better performance on month queries
CREATE INDEX IF NOT EXISTS idx_monthly_patients_month ON monthly_patients(year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_patients_source ON monthly_patients(source_id);

-- Update the patient count function to work with sources instead of offices
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