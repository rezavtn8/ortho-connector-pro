-- Add proper database constraints (check if they don't already exist)

-- For patient_sources table constraints
DO $$ 
BEGIN
    -- Add Google rating constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_google_rating' 
        AND table_name = 'patient_sources'
    ) THEN
        ALTER TABLE patient_sources 
        ADD CONSTRAINT check_google_rating CHECK (google_rating IS NULL OR (google_rating >= 0 AND google_rating <= 5));
    END IF;

    -- Add Yelp rating constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_yelp_rating' 
        AND table_name = 'patient_sources'
    ) THEN
        ALTER TABLE patient_sources
        ADD CONSTRAINT check_yelp_rating CHECK (yelp_rating IS NULL OR (yelp_rating >= 0 AND yelp_rating <= 5));
    END IF;

    -- Add patient count constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_patient_count' 
        AND table_name = 'monthly_patients'
    ) THEN
        ALTER TABLE monthly_patients
        ADD CONSTRAINT check_patient_count CHECK (patient_count >= 0);
    END IF;

    -- Add star rating constraint for marketing visits
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_star_rating' 
        AND table_name = 'marketing_visits'
    ) THEN
        ALTER TABLE marketing_visits
        ADD CONSTRAINT check_star_rating CHECK (star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5));
    END IF;
END $$;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_monthly_patients_year_month ON monthly_patients(year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_patients_user_id ON monthly_patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_sources_created_by ON patient_sources(created_by);
CREATE INDEX IF NOT EXISTS idx_patient_sources_source_type ON patient_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_user_id ON marketing_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_visit_date ON marketing_visits(visit_date);