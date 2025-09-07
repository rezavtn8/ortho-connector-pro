-- Add comprehensive database constraints and triggers (fixed version)

-- 1. Drop existing constraints if they exist to avoid conflicts
DO $$ 
BEGIN
  -- Drop CHECK constraints that might already exist
  ALTER TABLE public.patient_sources 
    DROP CONSTRAINT IF EXISTS patient_sources_google_rating_check,
    DROP CONSTRAINT IF EXISTS patient_sources_yelp_rating_check,
    DROP CONSTRAINT IF EXISTS patient_sources_distance_check,
    DROP CONSTRAINT IF EXISTS patient_sources_phone_format_check,
    DROP CONSTRAINT IF EXISTS patient_sources_website_format_check,
    DROP CONSTRAINT IF EXISTS patient_sources_latitude_check,
    DROP CONSTRAINT IF EXISTS patient_sources_longitude_check;

  ALTER TABLE public.discovered_offices
    DROP CONSTRAINT IF EXISTS discovered_offices_rating_check,
    DROP CONSTRAINT IF EXISTS discovered_offices_search_distance_check,
    DROP CONSTRAINT IF EXISTS discovered_offices_lat_check,
    DROP CONSTRAINT IF EXISTS discovered_offices_lng_check;

  ALTER TABLE public.monthly_patients
    DROP CONSTRAINT IF EXISTS monthly_patients_count_check,
    DROP CONSTRAINT IF EXISTS monthly_patients_year_month_format_check;

  ALTER TABLE public.marketing_visits
    DROP CONSTRAINT IF EXISTS marketing_visits_star_rating_check,
    DROP CONSTRAINT IF EXISTS marketing_visits_visit_date_check;

  ALTER TABLE public.discovery_sessions
    DROP CONSTRAINT IF EXISTS discovery_sessions_distance_check,
    DROP CONSTRAINT IF EXISTS discovery_sessions_results_check;

  ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_email_format_check,
    DROP CONSTRAINT IF EXISTS user_profiles_email_unique;

  ALTER TABLE public.user_invitations
    DROP CONSTRAINT IF EXISTS user_invitations_email_format_check,
    DROP CONSTRAINT IF EXISTS user_invitations_email_clinic_unique,
    DROP CONSTRAINT IF EXISTS user_invitations_status_check,
    DROP CONSTRAINT IF EXISTS user_invitations_expires_at_check;

  ALTER TABLE public.campaigns
    DROP CONSTRAINT IF EXISTS campaigns_status_check;

  ALTER TABLE public.campaign_deliveries
    DROP CONSTRAINT IF EXISTS campaign_deliveries_status_check;

  ALTER TABLE public.clinics
    DROP CONSTRAINT IF EXISTS clinics_latitude_check,
    DROP CONSTRAINT IF EXISTS clinics_longitude_check;

  ALTER TABLE public.patient_changes_log
    DROP CONSTRAINT IF EXISTS patient_changes_log_year_month_format_check;

EXCEPTION 
  WHEN OTHERS THEN 
    NULL; -- Ignore errors if constraints don't exist
END $$;

-- 2. Drop and recreate foreign keys with ON DELETE CASCADE
DO $$ 
BEGIN
  -- Drop existing foreign keys if they exist
  ALTER TABLE public.campaign_deliveries 
    DROP CONSTRAINT IF EXISTS campaign_deliveries_campaign_id_fkey,
    DROP CONSTRAINT IF EXISTS campaign_deliveries_office_id_fkey;
    
  ALTER TABLE public.campaigns
    DROP CONSTRAINT IF EXISTS campaigns_clinic_id_fkey;
    
  ALTER TABLE public.discovered_offices
    DROP CONSTRAINT IF EXISTS discovered_offices_clinic_id_fkey;
    
  ALTER TABLE public.marketing_visits
    DROP CONSTRAINT IF EXISTS marketing_visits_office_id_fkey,
    DROP CONSTRAINT IF EXISTS marketing_visits_clinic_id_fkey;
    
  ALTER TABLE public.monthly_patients
    DROP CONSTRAINT IF EXISTS monthly_patients_source_id_fkey,
    DROP CONSTRAINT IF EXISTS monthly_patients_clinic_id_fkey;
    
  ALTER TABLE public.patient_sources
    DROP CONSTRAINT IF EXISTS patient_sources_clinic_id_fkey;
    
  ALTER TABLE public.source_tags
    DROP CONSTRAINT IF EXISTS source_tags_source_id_fkey,
    DROP CONSTRAINT IF EXISTS source_tags_clinic_id_fkey;
    
  ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_clinic_id_fkey;
    
  ALTER TABLE public.user_invitations
    DROP CONSTRAINT IF EXISTS user_invitations_clinic_id_fkey;
    
  ALTER TABLE public.review_status
    DROP CONSTRAINT IF EXISTS review_status_clinic_id_fkey;
    
  ALTER TABLE public.patient_changes_log
    DROP CONSTRAINT IF EXISTS patient_changes_log_source_id_fkey,
    DROP CONSTRAINT IF EXISTS patient_changes_log_clinic_id_fkey;

EXCEPTION 
  WHEN OTHERS THEN 
    NULL; -- Ignore errors
END $$;

-- 3. Add foreign key constraints with ON DELETE CASCADE
ALTER TABLE public.campaign_deliveries 
  ADD CONSTRAINT campaign_deliveries_campaign_id_fkey 
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ADD CONSTRAINT campaign_deliveries_office_id_fkey 
    FOREIGN KEY (office_id) REFERENCES public.patient_sources(id) ON DELETE CASCADE;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.discovered_offices
  ADD CONSTRAINT discovered_offices_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.marketing_visits
  ADD CONSTRAINT marketing_visits_office_id_fkey 
    FOREIGN KEY (office_id) REFERENCES public.patient_sources(id) ON DELETE CASCADE,
  ADD CONSTRAINT marketing_visits_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.monthly_patients
  ADD CONSTRAINT monthly_patients_source_id_fkey 
    FOREIGN KEY (source_id) REFERENCES public.patient_sources(id) ON DELETE CASCADE,
  ADD CONSTRAINT monthly_patients_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.patient_sources
  ADD CONSTRAINT patient_sources_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.source_tags
  ADD CONSTRAINT source_tags_source_id_fkey 
    FOREIGN KEY (source_id) REFERENCES public.patient_sources(id) ON DELETE CASCADE,
  ADD CONSTRAINT source_tags_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;

ALTER TABLE public.user_invitations
  ADD CONSTRAINT user_invitations_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.review_status
  ADD CONSTRAINT review_status_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.patient_changes_log
  ADD CONSTRAINT patient_changes_log_source_id_fkey 
    FOREIGN KEY (source_id) REFERENCES public.patient_sources(id) ON DELETE CASCADE,
  ADD CONSTRAINT patient_changes_log_clinic_id_fkey 
    FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

-- 4. Add unique constraints on email fields
ALTER TABLE public.user_profiles 
  ADD CONSTRAINT user_profiles_email_unique UNIQUE (email);

ALTER TABLE public.user_invitations 
  ADD CONSTRAINT user_invitations_email_clinic_unique UNIQUE (email, clinic_id);

-- 5. Add CHECK constraints for valid ranges
ALTER TABLE public.patient_sources
  ADD CONSTRAINT patient_sources_google_rating_check 
    CHECK (google_rating IS NULL OR (google_rating >= 0 AND google_rating <= 5)),
  ADD CONSTRAINT patient_sources_yelp_rating_check 
    CHECK (yelp_rating IS NULL OR (yelp_rating >= 0 AND yelp_rating <= 5)),
  ADD CONSTRAINT patient_sources_distance_check 
    CHECK (distance_miles IS NULL OR distance_miles >= 0),
  ADD CONSTRAINT patient_sources_phone_format_check 
    CHECK (phone IS NULL OR phone ~ '^[\+]?[1-9][\d\s\-\(\)\.]{7,15}$'),
  ADD CONSTRAINT patient_sources_website_format_check 
    CHECK (website IS NULL OR website ~* '^https?://.*'),
  ADD CONSTRAINT patient_sources_latitude_check 
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT patient_sources_longitude_check 
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.discovered_offices
  ADD CONSTRAINT discovered_offices_rating_check 
    CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  ADD CONSTRAINT discovered_offices_search_distance_check 
    CHECK (search_distance IS NULL OR search_distance > 0),
  ADD CONSTRAINT discovered_offices_lat_check 
    CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  ADD CONSTRAINT discovered_offices_lng_check 
    CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));

ALTER TABLE public.monthly_patients
  ADD CONSTRAINT monthly_patients_count_check 
    CHECK (patient_count >= 0),
  ADD CONSTRAINT monthly_patients_year_month_format_check 
    CHECK (year_month ~ '^\d{4}-\d{2}$');

ALTER TABLE public.marketing_visits
  ADD CONSTRAINT marketing_visits_star_rating_check 
    CHECK (star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5)),
  ADD CONSTRAINT marketing_visits_visit_date_check 
    CHECK (visit_date <= CURRENT_DATE);

ALTER TABLE public.discovery_sessions
  ADD CONSTRAINT discovery_sessions_distance_check 
    CHECK (search_distance > 0),
  ADD CONSTRAINT discovery_sessions_results_check 
    CHECK (results_count >= 0);

ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_latitude_check 
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT clinics_longitude_check 
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.patient_changes_log
  ADD CONSTRAINT patient_changes_log_year_month_format_check 
    CHECK (year_month ~ '^\d{4}-\d{2}$');

-- 6. Add CHECK constraints for email format validation
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_email_format_check 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE public.user_invitations
  ADD CONSTRAINT user_invitations_email_format_check 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 7. Add CHECK constraints for status fields
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check 
    CHECK (status IN ('Draft', 'Active', 'Completed', 'Cancelled'));

ALTER TABLE public.campaign_deliveries
  ADD CONSTRAINT campaign_deliveries_status_check 
    CHECK (delivery_status IN ('Not Started', 'In Progress', 'Completed', 'Failed'));

ALTER TABLE public.user_invitations
  ADD CONSTRAINT user_invitations_status_check 
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  ADD CONSTRAINT user_invitations_expires_at_check 
    CHECK (expires_at > created_at);

-- 8. Create or replace function for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Create triggers for automatic timestamp updates
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
DROP TRIGGER IF EXISTS update_campaign_deliveries_updated_at ON public.campaign_deliveries;
DROP TRIGGER IF EXISTS update_clinics_updated_at ON public.clinics;
DROP TRIGGER IF EXISTS update_discovered_offices_updated_at ON public.discovered_offices;
DROP TRIGGER IF EXISTS update_marketing_visits_updated_at ON public.marketing_visits;
DROP TRIGGER IF EXISTS update_monthly_patients_updated_at ON public.monthly_patients;
DROP TRIGGER IF EXISTS update_patient_sources_updated_at ON public.patient_sources;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS update_discovery_sessions_updated_at ON public.discovery_sessions;
DROP TRIGGER IF EXISTS update_review_status_updated_at ON public.review_status;

-- Create new triggers for automatic timestamp updates
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_deliveries_updated_at
  BEFORE UPDATE ON public.campaign_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discovered_offices_updated_at
  BEFORE UPDATE ON public.discovered_offices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketing_visits_updated_at
  BEFORE UPDATE ON public.marketing_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_patients_updated_at
  BEFORE UPDATE ON public.monthly_patients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_sources_updated_at
  BEFORE UPDATE ON public.patient_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discovery_sessions_updated_at
  BEFORE UPDATE ON public.discovery_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_review_status_updated_at
  BEFORE UPDATE ON public.review_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();