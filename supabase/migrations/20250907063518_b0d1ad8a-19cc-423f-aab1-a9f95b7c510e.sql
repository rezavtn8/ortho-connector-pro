-- Create view for office metrics with calculated fields
CREATE OR REPLACE VIEW office_metrics AS
WITH current_stats AS (
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
    -- Calculate L12 (last 12 months)
    COALESCE(SUM(CASE 
      WHEN mp.year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '12 months', 'YYYY-MM')
      THEN mp.patient_count 
      ELSE 0 
    END), 0) AS l12,
    -- Calculate R3 (recent 3 months)
    COALESCE(SUM(CASE 
      WHEN mp.year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYY-MM')
      THEN mp.patient_count 
      ELSE 0 
    END), 0) AS r3,
    -- Calculate months since last referral
    CASE 
      WHEN MAX(CASE WHEN mp.patient_count > 0 THEN mp.year_month END) IS NULL THEN 999
      ELSE EXTRACT(YEAR FROM AGE(CURRENT_DATE, TO_DATE(MAX(CASE WHEN mp.patient_count > 0 THEN mp.year_month END), 'YYYY-MM'))) * 12 +
           EXTRACT(MONTH FROM AGE(CURRENT_DATE, TO_DATE(MAX(CASE WHEN mp.patient_count > 0 THEN mp.year_month END), 'YYYY-MM')))
    END AS mslr,
    -- Total all-time patients
    COALESCE(SUM(mp.patient_count), 0) AS total_patients
  FROM patient_sources ps
  LEFT JOIN monthly_patients mp ON ps.id = mp.source_id AND mp.user_id = ps.created_by
  WHERE ps.source_type = 'Office' AND ps.is_active = true
  GROUP BY ps.id, ps.name, ps.address, ps.phone, ps.email, ps.website, ps.notes, 
           ps.latitude, ps.longitude, ps.google_rating, ps.google_place_id, 
           ps.opening_hours, ps.yelp_rating, ps.distance_miles, ps.last_updated_from_google,
           ps.is_active, ps.created_at, ps.updated_at, ps.created_by
),
tier_calculations AS (
  SELECT 
    *,
    -- Calculate tier based on performance
    CASE 
      WHEN l12 = 0 THEN 'Dormant'
      WHEN l12 >= (
        SELECT PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY l12) 
        FROM current_stats 
        WHERE created_by = current_stats.created_by AND l12 > 0
      ) THEN 'VIP'
      WHEN l12 >= 4 OR r3 >= 1 THEN 'Warm'
      ELSE 'Cold'
    END AS tier
  FROM current_stats
)
SELECT * FROM tier_calculations;

-- Create view for dashboard summary statistics
CREATE OR REPLACE VIEW dashboard_summary AS
WITH source_groups AS (
  SELECT 
    ps.created_by,
    ps.source_type,
    COUNT(*) as source_count,
    COUNT(CASE WHEN ps.is_active THEN 1 END) as active_count,
    COALESCE(SUM(mp.patient_count), 0) as total_patients,
    COALESCE(SUM(CASE 
      WHEN mp.year_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM') 
      THEN mp.patient_count 
      ELSE 0 
    END), 0) as current_month_patients
  FROM patient_sources ps
  LEFT JOIN monthly_patients mp ON ps.id = mp.source_id AND mp.user_id = ps.created_by
  GROUP BY ps.created_by, ps.source_type
),
monthly_trends AS (
  SELECT 
    mp.user_id,
    mp.year_month,
    SUM(mp.patient_count) as month_total
  FROM monthly_patients mp
  WHERE mp.year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM')
  GROUP BY mp.user_id, mp.year_month
)
SELECT 
  sg.created_by as user_id,
  json_agg(
    json_build_object(
      'source_type', sg.source_type,
      'source_count', sg.source_count,
      'active_count', sg.active_count,
      'total_patients', sg.total_patients,
      'current_month_patients', sg.current_month_patients
    )
  ) as source_groups,
  (
    SELECT json_agg(
      json_build_object(
        'year_month', mt.year_month,
        'month_total', mt.month_total
      ) ORDER BY mt.year_month
    )
    FROM monthly_trends mt 
    WHERE mt.user_id = sg.created_by
  ) as monthly_trends
FROM source_groups sg
GROUP BY sg.created_by;

-- Create function to get office data with tags and monthly data
CREATE OR REPLACE FUNCTION get_office_data_with_relations()
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  phone text,
  email text,
  website text,
  notes text,
  latitude numeric,
  longitude numeric,
  google_rating numeric,
  google_place_id text,
  opening_hours text,
  yelp_rating numeric,
  distance_miles numeric,
  last_updated_from_google timestamp with time zone,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  created_by uuid,
  l12 bigint,
  r3 bigint,
  mslr numeric,
  total_patients bigint,
  tier text,
  tags json,
  monthly_data json
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    om.*,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', st.id,
          'tag_name', st.tag_name,
          'created_at', st.created_at
        )
      ) FROM source_tags st WHERE st.source_id = om.id),
      '[]'::json
    ) as tags,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', mp.id,
          'year_month', mp.year_month,
          'patient_count', mp.patient_count,
          'created_at', mp.created_at,
          'updated_at', mp.updated_at
        )
      ) FROM monthly_patients mp WHERE mp.source_id = om.id AND mp.user_id = auth.uid()),
      '[]'::json
    ) as monthly_data
  FROM office_metrics om
  WHERE om.created_by = auth.uid()
  ORDER BY om.name;
END;
$$;

-- Create function to get dashboard data efficiently
CREATE OR REPLACE FUNCTION get_dashboard_data()
RETURNS TABLE (
  summary json,
  recent_activity json
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT row_to_json(ds) FROM dashboard_summary ds WHERE ds.user_id = auth.uid()) as summary,
    (
      SELECT json_agg(
        json_build_object(
          'source_name', ps.name,
          'source_type', ps.source_type,
          'patient_count', mp.patient_count,
          'year_month', mp.year_month,
          'updated_at', mp.updated_at
        ) ORDER BY mp.updated_at DESC
      )
      FROM monthly_patients mp
      JOIN patient_sources ps ON mp.source_id = ps.id
      WHERE mp.user_id = auth.uid() 
      AND mp.updated_at >= CURRENT_DATE - INTERVAL '30 days'
      LIMIT 10
    ) as recent_activity;
END;
$$;

-- Add RLS policies for the views (they inherit from base tables but we make it explicit)
ALTER VIEW office_metrics OWNER TO postgres;
ALTER VIEW dashboard_summary OWNER TO postgres;

-- Grant access to authenticated users
GRANT SELECT ON office_metrics TO authenticated;
GRANT SELECT ON dashboard_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_office_data_with_relations() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_data() TO authenticated;