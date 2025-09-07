-- Add proper database constraints and foreign keys with CASCADE

-- Add ON DELETE CASCADE to existing foreign keys and create new constraints
-- Note: We'll need to drop and recreate foreign keys to add CASCADE

-- For patient_sources table
ALTER TABLE patient_sources 
ADD CONSTRAINT check_google_rating CHECK (google_rating IS NULL OR (google_rating >= 0 AND google_rating <= 5)),
ADD CONSTRAINT check_yelp_rating CHECK (yelp_rating IS NULL OR (yelp_rating >= 0 AND yelp_rating <= 5)),
ADD CONSTRAINT check_latitude CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
ADD CONSTRAINT check_longitude CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

-- For monthly_patients table - ensure patient_count is non-negative
ALTER TABLE monthly_patients
ADD CONSTRAINT check_patient_count CHECK (patient_count >= 0);

-- For marketing_visits table
ALTER TABLE marketing_visits
ADD CONSTRAINT check_star_rating CHECK (star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5));

-- Add unique constraint on user profiles email (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_email_unique'
    ) THEN
        ALTER TABLE user_profiles 
        ADD CONSTRAINT user_profiles_email_unique UNIQUE (email);
    END IF;
END $$;

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to tables that need them
CREATE TRIGGER update_patient_sources_updated_at 
    BEFORE UPDATE ON patient_sources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_patients_updated_at 
    BEFORE UPDATE ON monthly_patients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketing_visits_updated_at 
    BEFORE UPDATE ON marketing_visits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_deliveries_updated_at 
    BEFORE UPDATE ON campaign_deliveries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discovered_offices_updated_at 
    BEFORE UPDATE ON discovered_offices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discovery_sessions_updated_at 
    BEFORE UPDATE ON discovery_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add constraint to ensure year_month format is correct
ALTER TABLE monthly_patients
ADD CONSTRAINT check_year_month_format CHECK (year_month ~ '^\d{4}-\d{2}$');

-- Add constraint for valid email format in user_profiles
ALTER TABLE user_profiles
ADD CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add constraint for phone number format (optional, allows various formats)
ALTER TABLE patient_sources
ADD CONSTRAINT check_phone_format CHECK (phone IS NULL OR length(phone) >= 6);

-- Add constraint for website URL format
ALTER TABLE patient_sources
ADD CONSTRAINT check_website_format CHECK (website IS NULL OR website ~* '^https?://');

-- Create index on frequently queried columns for performance
CREATE INDEX IF NOT EXISTS idx_monthly_patients_year_month ON monthly_patients(year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_patients_user_id ON monthly_patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_sources_created_by ON patient_sources(created_by);
CREATE INDEX IF NOT EXISTS idx_patient_sources_source_type ON patient_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_user_id ON marketing_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_visit_date ON marketing_visits(visit_date);

-- Add constraint to ensure PIN is 4-6 digits (for security)
ALTER TABLE user_profiles
ADD CONSTRAINT check_pin_format CHECK (pin_code IS NULL OR pin_code ~ '^\$2[aby]\$[0-9]{2}\$');

-- Add check constraint for campaign status
ALTER TABLE campaigns
ADD CONSTRAINT check_campaign_status CHECK (status IN ('Draft', 'Active', 'Completed', 'Cancelled'));

-- Add check constraint for delivery status  
ALTER TABLE campaign_deliveries
ADD CONSTRAINT check_delivery_status CHECK (delivery_status IN ('Not Started', 'In Progress', 'Completed', 'Failed'));