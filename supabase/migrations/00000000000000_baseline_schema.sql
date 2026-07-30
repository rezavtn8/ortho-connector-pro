-- Baseline schema migration
-- Generated from the live Supabase production public schema.
-- Idempotent: safe to run against an existing database.
-- Sorts first so `supabase db reset` builds the full schema before later migrations.

-- Baseline schema dump of the production public schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============ ENUM TYPES ============
DO $$ BEGIN
  CREATE TYPE public.source_type AS ENUM ('Google', 'Yelp', 'Website', 'Word of Mouth', 'Insurance', 'Social Media', 'Other', 'Office');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('Owner', 'Front Desk', 'Marketing Rep', 'Manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  resource_name text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.ai_business_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  clinic_id uuid,
  business_persona jsonb DEFAULT '{}'::jsonb NOT NULL,
  communication_style text DEFAULT 'professional'::text,
  specialties text[] DEFAULT '{}'::text[],
  brand_voice jsonb DEFAULT '{}'::jsonb,
  practice_values text[],
  target_audience text,
  competitive_advantages text[],
  templates jsonb DEFAULT '{}'::jsonb,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_generated_content (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  content_type text NOT NULL,
  reference_id uuid,
  generated_text text NOT NULL,
  status text DEFAULT 'generated'::text,
  feedback text,
  quality_score numeric(3,2),
  used boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_response_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  template_type text NOT NULL,
  template_name text NOT NULL,
  template_text text NOT NULL,
  variables jsonb DEFAULT '{}'::jsonb,
  usage_count integer DEFAULT 0,
  effectiveness_score numeric(3,2),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_usage_tracking (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  task_type text NOT NULL,
  tokens_used integer DEFAULT 0,
  estimated_cost numeric(10,4) DEFAULT 0,
  quality_rating integer,
  execution_time_ms integer,
  model_used text DEFAULT 'gpt-4.1-2025-04-14'::text,
  request_data jsonb,
  response_data jsonb,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.campaign_deliveries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  campaign_id uuid NOT NULL,
  office_id uuid NOT NULL,
  delivery_status text DEFAULT 'Not Started'::text NOT NULL,
  delivered_at timestamp with time zone,
  delivery_notes text,
  photo_url text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  email_subject text,
  email_body text,
  email_status text DEFAULT 'pending'::text,
  gift_status text DEFAULT 'pending'::text,
  action_mode text DEFAULT 'both'::text,
  email_copied_at timestamp with time zone,
  email_sent_at timestamp with time zone,
  referral_tier text
);
CREATE TABLE IF NOT EXISTS public.campaign_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  campaign_type text NOT NULL,
  delivery_method text NOT NULL,
  target_tiers text[],
  email_subject_template text,
  email_body_template text,
  gift_bundle jsonb,
  materials_checklist text[],
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  campaign_type text NOT NULL,
  delivery_method text NOT NULL,
  assigned_rep_id uuid,
  materials_checklist text[],
  planned_delivery_date date,
  notes text,
  status text DEFAULT 'Draft'::text NOT NULL,
  created_by uuid NOT NULL,
  clinic_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  campaign_mode text DEFAULT 'traditional'::text,
  selected_gift_bundle jsonb,
  email_settings jsonb,
  roi_tracking jsonb DEFAULT '{}'::jsonb,
  estimated_cost numeric DEFAULT 0,
  actual_referrals integer DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.clinic_brand_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  logo_url text,
  logo_dark_url text,
  favicon_url text,
  primary_color text DEFAULT '262.1 83.3% 57.8%'::text,
  secondary_color text DEFAULT '252 40% 50%'::text,
  accent_color text DEFAULT '262.1 83.3% 57.8%'::text,
  background_color text DEFAULT '0 0% 100%'::text,
  foreground_color text DEFAULT '222.2 84% 4.9%'::text,
  brand_name text,
  tagline text,
  font_family text DEFAULT 'system-ui'::text,
  website_url text,
  phone text,
  email text,
  address text,
  social_links jsonb DEFAULT '{}'::jsonb,
  custom_css text,
  brand_voice text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid
);
CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  owner_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  google_place_id text,
  logo_url text,
  specialty text
);
CREATE TABLE IF NOT EXISTS public.competitor_snapshots (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  watchlist_id uuid NOT NULL,
  user_id uuid NOT NULL,
  google_rating numeric,
  review_count integer DEFAULT 0,
  review_velocity numeric DEFAULT 0,
  snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.competitor_watchlist (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  clinic_id uuid,
  google_place_id text NOT NULL,
  name text NOT NULL,
  address text,
  specialty text,
  latitude numeric,
  longitude numeric,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.daily_patients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid,
  patient_date date NOT NULL,
  patient_count integer DEFAULT 1 NOT NULL,
  notes text,
  user_id uuid NOT NULL,
  clinic_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.discovered_office_group_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  office_id uuid NOT NULL,
  added_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.discovered_office_groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.discovered_offices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  google_place_id text NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  website text,
  google_rating numeric,
  latitude numeric,
  longitude numeric,
  discovered_by uuid NOT NULL,
  clinic_id uuid,
  fetched_at timestamp with time zone DEFAULT now() NOT NULL,
  source text DEFAULT 'google'::text NOT NULL,
  imported boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  search_distance integer,
  search_location_lat numeric,
  search_location_lng numeric,
  office_type text DEFAULT 'Unknown'::text,
  discovery_session_id uuid,
  user_ratings_total integer,
  cache_expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
  last_verified_at timestamp with time zone DEFAULT now(),
  email character varying(255),
  notes text,
  yelp_rating numeric,
  opening_hours text,
  distance_miles numeric,
  is_active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.discovery_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  clinic_id uuid,
  search_distance integer NOT NULL,
  search_lat numeric NOT NULL,
  search_lng numeric NOT NULL,
  office_type_filter text,
  zip_code_override text,
  results_count integer DEFAULT 0,
  api_call_made boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  cache_hit boolean DEFAULT false,
  cache_age_seconds integer,
  api_response_time_ms integer
);
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  error_message text NOT NULL,
  error_stack text,
  component_stack text,
  url text,
  user_agent text,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  severity text DEFAULT 'error'::text NOT NULL,
  metadata jsonb,
  resolved boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.google_business_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  clinic_id uuid,
  office_id uuid,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_type text DEFAULT 'Bearer'::text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  scope text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.google_places_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  office_id uuid NOT NULL,
  google_place_id text,
  action text NOT NULL,
  field_updates jsonb,
  old_values jsonb,
  new_values jsonb,
  conflict_details jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.google_reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  google_review_id text NOT NULL,
  location_id text NOT NULL,
  office_id uuid,
  clinic_id uuid,
  user_id uuid NOT NULL,
  author_name text,
  author_profile_url text,
  rating integer NOT NULL,
  review_text text,
  review_reply text,
  review_reply_updated_at timestamp with time zone,
  posted_at timestamp with time zone NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  needs_attention boolean DEFAULT false NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.mailing_label_edits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  office_id uuid NOT NULL,
  custom_name text,
  custom_contact_name text,
  custom_address1 text,
  custom_address2 text,
  custom_city text,
  custom_state text,
  custom_zip text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.marketing_visits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  office_id uuid NOT NULL,
  visit_date date NOT NULL,
  visit_type text NOT NULL,
  group_tag text,
  contact_person text,
  visited boolean DEFAULT false NOT NULL,
  rep_name text NOT NULL,
  materials_handed_out text[],
  star_rating integer,
  follow_up_notes text,
  photo_url text,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  clinic_id uuid
);
CREATE TABLE IF NOT EXISTS public.monthly_patients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid,
  year_month character varying(7) NOT NULL,
  patient_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_modified_by uuid,
  user_id uuid NOT NULL,
  clinic_id uuid
);
CREATE TABLE IF NOT EXISTS public.office_contacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  office_id uuid NOT NULL,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  is_primary boolean DEFAULT false,
  notes text,
  birthday date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.office_emails (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  office_id uuid NOT NULL,
  contact_id uuid,
  recipient_email text,
  subject text NOT NULL,
  body text NOT NULL,
  email_type text DEFAULT 'outreach'::text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  is_ai_generated boolean DEFAULT false NOT NULL,
  ai_content_id uuid,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.office_interactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  office_id uuid NOT NULL,
  interaction_type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.office_tag_assignments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  office_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid
);
CREATE TABLE IF NOT EXISTS public.office_tags (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#3B82F6'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.patient_changes_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid,
  year_month character varying(7) NOT NULL,
  old_count integer,
  new_count integer,
  change_type character varying(20),
  reason text,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL,
  clinic_id uuid
);
CREATE TABLE IF NOT EXISTS public.patient_sources (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_type source_type NOT NULL,
  name character varying(255) NOT NULL,
  address text,
  phone character varying(50),
  email character varying(255),
  website character varying(255),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  clinic_id uuid,
  latitude numeric,
  longitude numeric,
  google_rating numeric(2,1),
  google_place_id text,
  opening_hours text,
  yelp_rating numeric(2,1),
  distance_miles numeric(4,1),
  last_updated_from_google timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  ip_address inet,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1 NOT NULL,
  window_start timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.review_replies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  review_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reply_text text NOT NULL,
  is_ai_generated boolean DEFAULT false NOT NULL,
  ai_content_id uuid,
  status text DEFAULT 'draft'::text NOT NULL,
  sent_at timestamp with time zone,
  google_reply_id text,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.review_status (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  google_review_id text NOT NULL,
  place_id text NOT NULL,
  user_id uuid NOT NULL,
  clinic_id uuid,
  status text DEFAULT 'new'::text NOT NULL,
  needs_attention boolean DEFAULT false NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.review_sync_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  location_id text NOT NULL,
  office_id uuid,
  clinic_id uuid,
  user_id uuid,
  sync_status text DEFAULT 'pending'::text NOT NULL,
  reviews_fetched integer DEFAULT 0 NOT NULL,
  reviews_new integer DEFAULT 0 NOT NULL,
  reviews_updated integer DEFAULT 0 NOT NULL,
  error_message text,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  next_sync_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  action_type text NOT NULL,
  table_name text,
  record_id uuid,
  ip_address inet,
  user_agent text,
  details jsonb,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.source_tags (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_id uuid,
  tag_name character varying(100) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  user_id uuid NOT NULL,
  clinic_id uuid
);
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plan_id text NOT NULL,
  name text NOT NULL,
  price_monthly numeric NOT NULL,
  stripe_price_id text,
  features jsonb DEFAULT '[]'::jsonb,
  max_offices integer,
  max_users integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_id text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  email text NOT NULL,
  role user_role DEFAULT 'Manager'::user_role NOT NULL,
  invited_by uuid NOT NULL,
  token uuid DEFAULT gen_random_uuid() NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  email text NOT NULL,
  role user_role DEFAULT 'Front Desk'::user_role NOT NULL,
  pin_code text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  clinic_id uuid,
  first_name text,
  last_name text,
  full_name text DEFAULT 
CASE
    WHEN ((first_name IS NOT NULL) AND (last_name IS NOT NULL)) THEN ((first_name || ' '::text) || last_name)
    WHEN (first_name IS NOT NULL) THEN first_name
    WHEN (last_name IS NOT NULL) THEN last_name
    ELSE NULL::text
END,
  phone text,
  job_title text,
  degrees text,
  onboarding_completed boolean DEFAULT false,
  onboarding_step integer DEFAULT 0,
  email_preferences jsonb DEFAULT '{"weekly_reports": true, "biweekly_digest": true, "monthly_reports": true, "referral_alerts": true}'::jsonb NOT NULL
);

-- ============ COLUMNS (for pre-existing tables) ============
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS action_type text;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS resource_type text;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS resource_id uuid;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS resource_name text;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS business_persona jsonb;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS communication_style text;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS specialties text[];
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS brand_voice jsonb;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS practice_values text[];
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS competitive_advantages text[];
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS templates jsonb;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS last_updated timestamp with time zone;
ALTER TABLE public.ai_business_profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS content_type text;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS reference_id uuid;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS generated_text text;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS quality_score numeric(3,2);
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS used boolean;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS template_type text;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS template_name text;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS template_text text;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS variables jsonb;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS usage_count integer;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS effectiveness_score numeric(3,2);
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.ai_response_templates ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS task_type text;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS tokens_used integer;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS estimated_cost numeric(10,4);
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS quality_rating integer;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS execution_time_ms integer;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS model_used text;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS request_data jsonb;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS response_data jsonb;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS success boolean;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE public.ai_usage_tracking ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS campaign_id uuid;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS delivery_status text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS delivery_notes text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_body text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_status text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS gift_status text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS action_mode text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_copied_at timestamp with time zone;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_sent_at timestamp with time zone;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS referral_tier text;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS campaign_type text;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS delivery_method text;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS target_tiers text[];
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS email_subject_template text;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS email_body_template text;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS gift_bundle jsonb;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS materials_checklist text[];
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.campaign_templates ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS campaign_type text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS delivery_method text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS assigned_rep_id uuid;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS materials_checklist text[];
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS planned_delivery_date date;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS campaign_mode text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS selected_gift_bundle jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS email_settings jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS roi_tracking jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS estimated_cost numeric;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS actual_referrals integer;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS logo_dark_url text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS favicon_url text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS primary_color text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS secondary_color text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS background_color text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS foreground_color text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS font_family text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS social_links jsonb;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS custom_css text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS brand_voice text;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.clinic_brand_settings ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS specialty text;
ALTER TABLE public.competitor_snapshots ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.competitor_snapshots ADD COLUMN IF NOT EXISTS watchlist_id uuid;
ALTER TABLE public.competitor_snapshots ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.competitor_snapshots ADD COLUMN IF NOT EXISTS google_rating numeric;
ALTER TABLE public.competitor_snapshots ADD COLUMN IF NOT EXISTS review_count integer;
ALTER TABLE public.competitor_snapshots ADD COLUMN IF NOT EXISTS review_velocity numeric;
ALTER TABLE public.competitor_snapshots ADD COLUMN IF NOT EXISTS snapshot_date date;
ALTER TABLE public.competitor_snapshots ADD COLUMN IF NOT EXISTS raw_data jsonb;
ALTER TABLE public.competitor_snapshots ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS specialty text;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.competitor_watchlist ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.daily_patients ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.daily_patients ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.daily_patients ADD COLUMN IF NOT EXISTS patient_date date;
ALTER TABLE public.daily_patients ADD COLUMN IF NOT EXISTS patient_count integer;
ALTER TABLE public.daily_patients ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.daily_patients ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.daily_patients ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.daily_patients ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.daily_patients ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.discovered_office_group_members ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.discovered_office_group_members ADD COLUMN IF NOT EXISTS group_id uuid;
ALTER TABLE public.discovered_office_group_members ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.discovered_office_group_members ADD COLUMN IF NOT EXISTS added_at timestamp with time zone;
ALTER TABLE public.discovered_office_groups ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.discovered_office_groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.discovered_office_groups ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.discovered_office_groups ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.discovered_office_groups ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS google_rating numeric;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS discovered_by uuid;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS fetched_at timestamp with time zone;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS imported boolean;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS search_distance integer;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS search_location_lat numeric;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS search_location_lng numeric;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS office_type text;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS discovery_session_id uuid;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS user_ratings_total integer;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS cache_expires_at timestamp with time zone;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS last_verified_at timestamp with time zone;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS email character varying(255);
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS yelp_rating numeric;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS opening_hours text;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS distance_miles numeric;
ALTER TABLE public.discovered_offices ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS search_distance integer;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS search_lat numeric;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS search_lng numeric;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS office_type_filter text;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS zip_code_override text;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS results_count integer;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS api_call_made boolean;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS cache_hit boolean;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS cache_age_seconds integer;
ALTER TABLE public.discovery_sessions ADD COLUMN IF NOT EXISTS api_response_time_ms integer;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS error_stack text;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS component_stack text;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS "timestamp" timestamp with time zone;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS severity text;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS resolved boolean;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS access_token text;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS refresh_token text;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS token_type text;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.google_business_tokens ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS field_updates jsonb;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS old_values jsonb;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS new_values jsonb;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS conflict_details jsonb;
ALTER TABLE public.google_places_audit_log ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS google_review_id text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS location_id text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS author_profile_url text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS rating integer;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS review_text text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS review_reply text;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS review_reply_updated_at timestamp with time zone;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS is_read boolean;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS needs_attention boolean;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS synced_at timestamp with time zone;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.google_reviews ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS custom_name text;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS custom_contact_name text;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS custom_address1 text;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS custom_address2 text;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS custom_city text;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS custom_state text;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS custom_zip text;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.mailing_label_edits ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS visit_date date;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS visit_type text;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS group_tag text;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS visited boolean;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS rep_name text;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS materials_handed_out text[];
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS star_rating integer;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS follow_up_notes text;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.marketing_visits ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS year_month character varying(7);
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS patient_count integer;
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS last_modified_by uuid;
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS is_primary boolean;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS contact_id uuid;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS email_type text;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS is_ai_generated boolean;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS ai_content_id uuid;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.office_emails ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.office_interactions ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.office_interactions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.office_interactions ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.office_interactions ADD COLUMN IF NOT EXISTS interaction_type text;
ALTER TABLE public.office_interactions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.office_interactions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.office_interactions ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.office_interactions ADD COLUMN IF NOT EXISTS occurred_at timestamp with time zone;
ALTER TABLE public.office_interactions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.office_tag_assignments ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.office_tag_assignments ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.office_tag_assignments ADD COLUMN IF NOT EXISTS tag_id uuid;
ALTER TABLE public.office_tag_assignments ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;
ALTER TABLE public.office_tag_assignments ADD COLUMN IF NOT EXISTS assigned_by uuid;
ALTER TABLE public.office_tags ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.office_tags ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.office_tags ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.office_tags ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.office_tags ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.office_tags ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS year_month character varying(7);
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS old_count integer;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS new_count integer;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS change_type character varying(20);
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS changed_by uuid;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS changed_at timestamp with time zone;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS source_type source_type;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS name character varying(255);
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS phone character varying(50);
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS email character varying(255);
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS website character varying(255);
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS google_rating numeric(2,1);
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS opening_hours text;
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS yelp_rating numeric(2,1);
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS distance_miles numeric(4,1);
ALTER TABLE public.patient_sources ADD COLUMN IF NOT EXISTS last_updated_from_google timestamp with time zone;
ALTER TABLE public.rate_limit_log ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.rate_limit_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.rate_limit_log ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE public.rate_limit_log ADD COLUMN IF NOT EXISTS endpoint text;
ALTER TABLE public.rate_limit_log ADD COLUMN IF NOT EXISTS request_count integer;
ALTER TABLE public.rate_limit_log ADD COLUMN IF NOT EXISTS window_start timestamp with time zone;
ALTER TABLE public.rate_limit_log ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS review_id uuid;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS reply_text text;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS is_ai_generated boolean;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS ai_content_id uuid;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS google_reply_id text;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.review_replies ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS google_review_id text;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS place_id text;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS needs_attention boolean;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.review_status ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS location_id text;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS office_id uuid;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS sync_status text;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS reviews_fetched integer;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS reviews_new integer;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS reviews_updated integer;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
ALTER TABLE public.review_sync_log ADD COLUMN IF NOT EXISTS next_sync_at timestamp with time zone;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS action_type text;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS table_name text;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS record_id uuid;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS "timestamp" timestamp with time zone;
ALTER TABLE public.source_tags ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.source_tags ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.source_tags ADD COLUMN IF NOT EXISTS tag_name character varying(100);
ALTER TABLE public.source_tags ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.source_tags ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.source_tags ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.source_tags ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS plan_id text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_monthly numeric;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS features jsonb;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_offices integer;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_users integer;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start timestamp with time zone;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS role user_role;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS invited_by uuid;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS token uuid;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS role user_role;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS pin_code text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS degrees text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_step integer;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email_preferences jsonb;

-- ============ CONSTRAINTS ============
DO $$ BEGIN
  ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.ai_business_profiles ADD CONSTRAINT ai_business_profiles_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.ai_generated_content ADD CONSTRAINT ai_generated_content_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.ai_response_templates ADD CONSTRAINT ai_response_templates_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.ai_usage_tracking ADD CONSTRAINT ai_usage_tracking_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaign_templates ADD CONSTRAINT campaign_templates_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clinic_brand_settings ADD CONSTRAINT clinic_brand_settings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clinics ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.competitor_snapshots ADD CONSTRAINT competitor_snapshots_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.competitor_watchlist ADD CONSTRAINT competitor_watchlist_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.daily_patients ADD CONSTRAINT daily_patients_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_office_group_members ADD CONSTRAINT discovered_office_group_members_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_office_groups ADD CONSTRAINT discovered_office_groups_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_offices ADD CONSTRAINT discovered_offices_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovery_sessions ADD CONSTRAINT discovery_sessions_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.error_logs ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_business_tokens ADD CONSTRAINT google_business_tokens_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_places_audit_log ADD CONSTRAINT google_places_audit_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_reviews ADD CONSTRAINT google_reviews_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.mailing_label_edits ADD CONSTRAINT mailing_label_edits_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.marketing_visits ADD CONSTRAINT marketing_visits_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT monthly_patients_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_contacts ADD CONSTRAINT office_contacts_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_emails ADD CONSTRAINT office_emails_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_interactions ADD CONSTRAINT office_interactions_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_tag_assignments ADD CONSTRAINT office_tag_assignments_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_tags ADD CONSTRAINT office_tags_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_changes_log ADD CONSTRAINT patient_changes_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT referral_sources_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.rate_limit_log ADD CONSTRAINT rate_limit_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_replies ADD CONSTRAINT review_replies_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_status ADD CONSTRAINT review_status_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_sync_log ADD CONSTRAINT review_sync_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.security_audit_log ADD CONSTRAINT security_audit_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.source_tags ADD CONSTRAINT source_tags_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.ai_business_profiles ADD CONSTRAINT ai_business_profiles_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_campaign_id_office_id_key UNIQUE (campaign_id, office_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clinic_brand_settings ADD CONSTRAINT clinic_brand_settings_clinic_id_key UNIQUE (clinic_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.competitor_snapshots ADD CONSTRAINT competitor_snapshots_watchlist_id_snapshot_date_key UNIQUE (watchlist_id, snapshot_date);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.competitor_watchlist ADD CONSTRAINT competitor_watchlist_user_id_google_place_id_key UNIQUE (user_id, google_place_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.daily_patients ADD CONSTRAINT daily_patients_source_id_patient_date_user_id_key UNIQUE (source_id, patient_date, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_office_group_members ADD CONSTRAINT discovered_office_group_members_group_id_office_id_key UNIQUE (group_id, office_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_offices ADD CONSTRAINT discovered_offices_google_place_id_key UNIQUE (google_place_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_business_tokens ADD CONSTRAINT unique_clinic_token UNIQUE (clinic_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_business_tokens ADD CONSTRAINT unique_office_token UNIQUE (office_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_reviews ADD CONSTRAINT unique_google_review UNIQUE (google_review_id, location_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.mailing_label_edits ADD CONSTRAINT mailing_label_edits_user_id_office_id_key UNIQUE (user_id, office_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT monthly_patients_source_id_year_month_key UNIQUE (source_id, year_month);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_tag_assignments ADD CONSTRAINT office_tag_assignments_office_id_tag_id_key UNIQUE (office_id, tag_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_tags ADD CONSTRAINT office_tags_user_id_name_key UNIQUE (user_id, name);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_status ADD CONSTRAINT review_status_google_review_id_user_id_key UNIQUE (google_review_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.source_tags ADD CONSTRAINT source_tags_source_id_tag_name_key UNIQUE (source_id, tag_name);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_plan_id_key UNIQUE (plan_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_email_clinic_unique UNIQUE (email, clinic_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_email_unique UNIQUE (email);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['Not Started'::text, 'Delivered'::text, 'Failed'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_status_check CHECK ((delivery_status = ANY (ARRAY['Not Started'::text, 'In Progress'::text, 'Completed'::text, 'Failed'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_campaign_type_check CHECK ((campaign_type = ANY (ARRAY['Intro Package'::text, 'Mug Drop'::text, 'Lunch Drop'::text, 'CE Invite Pack'::text, 'Monthly Promo Pack'::text, 'Holiday Card Drop'::text, 'Educational Material Drop'::text, 'referral_outreach'::text, 'new_office'::text, 're_engagement'::text, 'important_date'::text, 'referral_appreciation'::text, 'holiday_seasonal'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_delivery_method_check CHECK ((delivery_method = ANY (ARRAY['In-Person'::text, 'USPS'::text, 'Courier'::text, 'email'::text, 'physical'::text, 'letter'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Active'::text, 'Completed'::text, 'Cancelled'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clinics ADD CONSTRAINT clinics_latitude_check CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clinics ADD CONSTRAINT clinics_longitude_check CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_offices ADD CONSTRAINT discovered_offices_lat_check CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_offices ADD CONSTRAINT discovered_offices_lng_check CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_offices ADD CONSTRAINT discovered_offices_rating_check CHECK (((google_rating IS NULL) OR ((google_rating >= (0)::numeric) AND (google_rating <= (5)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_offices ADD CONSTRAINT discovered_offices_search_distance_check CHECK (((search_distance IS NULL) OR (search_distance > 0)));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovery_sessions ADD CONSTRAINT discovery_sessions_distance_check CHECK ((search_distance > 0));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovery_sessions ADD CONSTRAINT discovery_sessions_results_check CHECK ((results_count >= 0));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_reviews ADD CONSTRAINT google_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.marketing_visits ADD CONSTRAINT check_star_rating CHECK (((star_rating IS NULL) OR ((star_rating >= 1) AND (star_rating <= 5))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.marketing_visits ADD CONSTRAINT marketing_visits_star_rating_check CHECK (((star_rating IS NULL) OR ((star_rating >= 1) AND (star_rating <= 5))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.marketing_visits ADD CONSTRAINT marketing_visits_visit_date_check CHECK ((visit_date <= CURRENT_DATE));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.marketing_visits ADD CONSTRAINT marketing_visits_visit_type_check CHECK ((visit_type = ANY (ARRAY['New Target'::text, 'Routine'::text, 'Reconnect'::text, 'Follow-up'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT check_patient_count CHECK ((patient_count >= 0));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT monthly_patients_count_check CHECK ((patient_count >= 0));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT monthly_patients_year_month_format_check CHECK (((year_month)::text ~ '^\d{4}-\d{2}$'::text));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_emails ADD CONSTRAINT office_emails_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'replied'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_emails ADD CONSTRAINT office_emails_type_check CHECK ((email_type = ANY (ARRAY['outreach'::text, 'follow_up'::text, 'thank_you'::text, 're_engagement'::text, 'holiday'::text, 'custom'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_changes_log ADD CONSTRAINT patient_changes_log_change_type_check CHECK (((change_type)::text = ANY ((ARRAY['increment'::character varying, 'decrement'::character varying, 'manual_edit'::character varying, 'import'::character varying])::text[])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_changes_log ADD CONSTRAINT patient_changes_log_year_month_format_check CHECK (((year_month)::text ~ '^\d{4}-\d{2}$'::text));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT check_google_rating CHECK (((google_rating IS NULL) OR ((google_rating >= (0)::numeric) AND (google_rating <= (5)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT check_yelp_rating CHECK (((yelp_rating IS NULL) OR ((yelp_rating >= (0)::numeric) AND (yelp_rating <= (5)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT patient_sources_distance_check CHECK (((distance_miles IS NULL) OR (distance_miles >= (0)::numeric)));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT patient_sources_google_rating_check CHECK (((google_rating IS NULL) OR ((google_rating >= (0)::numeric) AND (google_rating <= (5)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT patient_sources_latitude_check CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT patient_sources_longitude_check CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT patient_sources_yelp_rating_check CHECK (((yelp_rating IS NULL) OR ((yelp_rating >= (0)::numeric) AND (yelp_rating <= (5)::numeric))));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_replies ADD CONSTRAINT review_replies_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'sent'::text, 'failed'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_status ADD CONSTRAINT review_status_status_check CHECK ((status = ANY (ARRAY['new'::text, 'handled'::text, 'follow-up'::text, 'unreplied'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_sync_log ADD CONSTRAINT review_sync_log_sync_status_check CHECK ((sync_status = ANY (ARRAY['pending'::text, 'success'::text, 'partial'::text, 'failed'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_email_format_check CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_expires_at_check CHECK ((expires_at > created_at));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_email_format_check CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaign_deliveries ADD CONSTRAINT campaign_deliveries_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_assigned_rep_id_fkey FOREIGN KEY (assigned_rep_id) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clinic_brand_settings ADD CONSTRAINT clinic_brand_settings_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clinic_brand_settings ADD CONSTRAINT clinic_brand_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.competitor_snapshots ADD CONSTRAINT competitor_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.competitor_snapshots ADD CONSTRAINT competitor_snapshots_watchlist_id_fkey FOREIGN KEY (watchlist_id) REFERENCES competitor_watchlist(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.competitor_watchlist ADD CONSTRAINT competitor_watchlist_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.competitor_watchlist ADD CONSTRAINT competitor_watchlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.daily_patients ADD CONSTRAINT daily_patients_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.daily_patients ADD CONSTRAINT daily_patients_source_id_fkey FOREIGN KEY (source_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_office_group_members ADD CONSTRAINT discovered_office_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES discovered_office_groups(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_office_group_members ADD CONSTRAINT discovered_office_group_members_office_id_fkey FOREIGN KEY (office_id) REFERENCES discovered_offices(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_offices ADD CONSTRAINT discovered_offices_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.discovered_offices ADD CONSTRAINT fk_discovered_offices_discovery_session_id FOREIGN KEY (discovery_session_id) REFERENCES discovery_sessions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.error_logs ADD CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_business_tokens ADD CONSTRAINT google_business_tokens_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_business_tokens ADD CONSTRAINT google_business_tokens_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_business_tokens ADD CONSTRAINT google_business_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_reviews ADD CONSTRAINT google_reviews_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_reviews ADD CONSTRAINT google_reviews_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.google_reviews ADD CONSTRAINT google_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.mailing_label_edits ADD CONSTRAINT mailing_label_edits_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.marketing_visits ADD CONSTRAINT fk_marketing_visits_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.marketing_visits ADD CONSTRAINT fk_marketing_visits_office FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.marketing_visits ADD CONSTRAINT marketing_visits_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.marketing_visits ADD CONSTRAINT marketing_visits_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT fk_monthly_patients_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT monthly_patients_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT monthly_patients_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT monthly_patients_source_id_fkey FOREIGN KEY (source_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_patients ADD CONSTRAINT monthly_patients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_contacts ADD CONSTRAINT office_contacts_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_emails ADD CONSTRAINT office_emails_ai_content_id_fkey FOREIGN KEY (ai_content_id) REFERENCES ai_generated_content(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_emails ADD CONSTRAINT office_emails_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES office_contacts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_emails ADD CONSTRAINT office_emails_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_interactions ADD CONSTRAINT office_interactions_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_tag_assignments ADD CONSTRAINT office_tag_assignments_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.office_tag_assignments ADD CONSTRAINT office_tag_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES office_tags(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_changes_log ADD CONSTRAINT fk_patient_changes_log_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_changes_log ADD CONSTRAINT patient_changes_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_changes_log ADD CONSTRAINT patient_changes_log_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_changes_log ADD CONSTRAINT patient_changes_log_source_id_fkey FOREIGN KEY (source_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_changes_log ADD CONSTRAINT patient_changes_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT fk_patient_sources_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT patient_sources_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.patient_sources ADD CONSTRAINT referral_sources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_replies ADD CONSTRAINT review_replies_ai_content_id_fkey FOREIGN KEY (ai_content_id) REFERENCES ai_generated_content(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_replies ADD CONSTRAINT review_replies_review_id_fkey FOREIGN KEY (review_id) REFERENCES google_reviews(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_replies ADD CONSTRAINT review_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_status ADD CONSTRAINT review_status_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_sync_log ADD CONSTRAINT review_sync_log_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_sync_log ADD CONSTRAINT review_sync_log_office_id_fkey FOREIGN KEY (office_id) REFERENCES patient_sources(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.review_sync_log ADD CONSTRAINT review_sync_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.source_tags ADD CONSTRAINT fk_source_tags_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.source_tags ADD CONSTRAINT source_tags_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.source_tags ADD CONSTRAINT source_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.source_tags ADD CONSTRAINT source_tags_source_id_fkey FOREIGN KEY (source_id) REFERENCES patient_sources(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.source_tags ADD CONSTRAINT source_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(plan_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT fk_user_profiles_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_activity_log_user_created ON public.activity_log USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_business_profiles_user_id ON public.ai_business_profiles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_content_type ON public.ai_generated_content USING btree (content_type);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_user_id ON public.ai_generated_content USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_response_templates_template_type ON public.ai_response_templates USING btree (template_type);
CREATE INDEX IF NOT EXISTS idx_ai_response_templates_user_id ON public.ai_response_templates USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_created_at ON public.ai_usage_tracking USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_task_type ON public.ai_usage_tracking USING btree (task_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_user_id ON public.ai_usage_tracking USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_changes_log_source ON public.patient_changes_log USING btree (source_id);
CREATE INDEX IF NOT EXISTS idx_clinic_brand_settings_clinic_id ON public.clinic_brand_settings USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_discovered_offices_cache_lookup ON public.discovered_offices USING btree (discovered_by, clinic_id, search_distance, cache_expires_at);
CREATE INDEX IF NOT EXISTS idx_discovered_offices_clinic_id ON public.discovered_offices USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_discovered_offices_fetched_at ON public.discovered_offices USING btree (clinic_id, fetched_at);
CREATE INDEX IF NOT EXISTS idx_discovered_offices_place_id ON public.discovered_offices USING btree (google_place_id);
CREATE INDEX IF NOT EXISTS idx_discovered_offices_session ON public.discovered_offices USING btree (discovery_session_id);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_user_clinic_date ON public.discovery_sessions USING btree (user_id, clinic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs USING btree (severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON public.error_logs USING btree ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_google_places_audit_log_created_at ON public.google_places_audit_log USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_google_places_audit_log_office_id ON public.google_places_audit_log USING btree (office_id);
CREATE INDEX IF NOT EXISTS idx_google_places_audit_log_user_id ON public.google_places_audit_log USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_google_reviews_clinic_id ON public.google_reviews USING btree (clinic_id);
CREATE INDEX IF NOT EXISTS idx_google_reviews_is_read ON public.google_reviews USING btree (is_read);
CREATE INDEX IF NOT EXISTS idx_google_reviews_location_id ON public.google_reviews USING btree (location_id);
CREATE INDEX IF NOT EXISTS idx_google_reviews_needs_attention ON public.google_reviews USING btree (needs_attention);
CREATE INDEX IF NOT EXISTS idx_google_reviews_office_id ON public.google_reviews USING btree (office_id);
CREATE INDEX IF NOT EXISTS idx_google_reviews_posted_at ON public.google_reviews USING btree (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_reviews_user_id ON public.google_reviews USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_office_id ON public.marketing_visits USING btree (office_id);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_rep_name ON public.marketing_visits USING btree (rep_name);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_user_id ON public.marketing_visits USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_visits_visit_date ON public.marketing_visits USING btree (visit_date);
CREATE INDEX IF NOT EXISTS idx_monthly_patients_month ON public.monthly_patients USING btree (year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_patients_source ON public.monthly_patients USING btree (source_id);
CREATE INDEX IF NOT EXISTS idx_monthly_patients_user_id ON public.monthly_patients USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_patients_year_month ON public.monthly_patients USING btree (year_month);
CREATE INDEX IF NOT EXISTS idx_office_emails_created_at ON public.office_emails USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_emails_office_id ON public.office_emails USING btree (office_id);
CREATE INDEX IF NOT EXISTS idx_office_emails_status ON public.office_emails USING btree (status);
CREATE INDEX IF NOT EXISTS idx_office_emails_user_id ON public.office_emails USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_patient_sources_coordinates ON public.patient_sources USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_patient_sources_created_by ON public.patient_sources USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_patient_sources_source_type ON public.patient_sources USING btree (source_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_user_endpoint_time ON public.rate_limit_log USING btree (user_id, endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON public.review_replies USING btree (review_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_status ON public.review_replies USING btree (status);
CREATE INDEX IF NOT EXISTS idx_review_sync_log_location_id ON public.review_sync_log USING btree (location_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action_timestamp ON public.security_audit_log USING btree (action_type, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_timestamp ON public.security_audit_log USING btree (user_id, "timestamp" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_google_place_id ON public.patient_sources USING btree (google_place_id, created_by) WHERE (google_place_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invitations_email_clinic ON public.user_invitations USING btree (email, clinic_id) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles USING btree (email);

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_invitation RECORD;
    v_user_email TEXT;
BEGIN
    -- Get current user email
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
    
    -- Find valid invitation
    SELECT * INTO v_invitation
    FROM public.user_invitations
    WHERE token = p_token 
    AND email = v_user_email
    AND status = 'pending'
    AND expires_at > now();
    
    IF v_invitation IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
    END IF;
    
    -- Update user profile with clinic and role
    UPDATE public.user_profiles 
    SET clinic_id = v_invitation.clinic_id, role = v_invitation.role
    WHERE user_id = auth.uid();
    
    -- Mark invitation as accepted
    UPDATE public.user_invitations
    SET status = 'accepted'
    WHERE id = v_invitation.id;
    
    RETURN json_build_object('success', true, 'clinic_id', v_invitation.clinic_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.add_daily_patients(p_source_id uuid, p_date date, p_count integer, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry_id UUID;
  v_year_month VARCHAR;
  v_monthly_total INTEGER;
BEGIN
  -- Insert or update daily entry
  INSERT INTO public.daily_patients (source_id, patient_date, patient_count, notes, user_id)
  VALUES (p_source_id, p_date, p_count, p_notes, auth.uid())
  ON CONFLICT (source_id, patient_date, user_id)
  DO UPDATE SET
    patient_count = EXCLUDED.patient_count,
    notes = COALESCE(EXCLUDED.notes, daily_patients.notes),
    updated_at = now()
  RETURNING id INTO v_entry_id;
  
  -- Calculate year_month for the date
  v_year_month := TO_CHAR(p_date, 'YYYY-MM');
  
  -- Sync to monthly_patients
  SELECT COALESCE(SUM(patient_count), 0) INTO v_monthly_total
  FROM public.daily_patients
  WHERE source_id = p_source_id
    AND TO_CHAR(patient_date, 'YYYY-MM') = v_year_month
    AND user_id = auth.uid();
  
  -- Update monthly_patients
  INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id)
  VALUES (p_source_id, v_year_month, v_monthly_total, auth.uid())
  ON CONFLICT (source_id, year_month)
  DO UPDATE SET
    patient_count = v_monthly_total,
    updated_at = now()
  WHERE monthly_patients.user_id = auth.uid();
  
  RETURN json_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'date', p_date,
    'count', p_count,
    'monthly_total', v_monthly_total
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.adjust_patient_count(p_source_id uuid, p_year_month character varying, p_delta integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_old_count INTEGER;
    v_new_count INTEGER;
    v_source_name TEXT;
BEGIN
    -- Get current count and source name
    SELECT patient_count INTO v_old_count
    FROM public.monthly_patients
    WHERE source_id = p_source_id AND year_month = p_year_month AND user_id = auth.uid();
    
    IF v_old_count IS NULL THEN
        v_old_count := 0;
    END IF;
    
    -- Get source name
    SELECT name INTO v_source_name
    FROM public.patient_sources
    WHERE id = p_source_id AND created_by = auth.uid();
    
    -- Calculate new count
    v_new_count := GREATEST(0, v_old_count + p_delta);
    
    -- Upsert monthly patients
    INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id)
    VALUES (p_source_id, p_year_month, v_new_count, auth.uid())
    ON CONFLICT (source_id, year_month)
    DO UPDATE SET 
        patient_count = v_new_count,
        updated_at = NOW()
    WHERE public.monthly_patients.user_id = auth.uid();
    
    -- Log change in patient_changes_log
    INSERT INTO public.patient_changes_log (
        source_id, year_month, old_count, new_count, change_type, user_id
    ) VALUES (
        p_source_id, p_year_month, v_old_count, v_new_count,
        CASE WHEN p_delta > 0 THEN 'increment' ELSE 'decrement' END,
        auth.uid()
    );
    
    -- Log in activity_log
    PERFORM public.log_activity(
        CASE WHEN p_delta > 0 THEN 'patient_count_increased' ELSE 'patient_count_decreased' END,
        'patient_count',
        p_source_id,
        v_source_name,
        jsonb_build_object(
            'old_count', v_old_count,
            'new_count', v_new_count,
            'change', p_delta,
            'year_month', p_year_month
        )
    );
    
    RETURN v_new_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.audit_data_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Log data modifications on sensitive tables
  IF TG_TABLE_NAME IN ('user_profiles', 'patient_sources', 'discovered_offices', 'user_invitations') THEN
    PERFORM public.log_security_event(
      auth.uid(),
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'old_values', CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        'new_values', CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_source_score(source_id_param uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  recent_patients INTEGER;
  last_patient_date DATE;
  days_since_patient INTEGER;
  total_patients INTEGER;
BEGIN
  -- Get patient count for past 3 months (only for the authenticated user)
  SELECT COALESCE(SUM(patient_count), 0)
  INTO recent_patients
  FROM public.monthly_patients
  WHERE source_id = source_id_param
    AND year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYY-MM')
    AND user_id = auth.uid();

  -- Get total patients (only for the authenticated user)
  SELECT COALESCE(SUM(patient_count), 0)
  INTO total_patients
  FROM public.monthly_patients
  WHERE source_id = source_id_param
    AND user_id = auth.uid();

  -- Get last patient date (most recent month with patients)
  SELECT MAX(TO_DATE(year_month, 'YYYY-MM'))
  INTO last_patient_date
  FROM public.monthly_patients
  WHERE source_id = source_id_param 
    AND patient_count > 0 
    AND user_id = auth.uid();

  -- Calculate days since last patient
  IF last_patient_date IS NOT NULL THEN
    days_since_patient := CURRENT_DATE - last_patient_date;
  ELSE
    days_since_patient := 9999;
  END IF;

  -- Determine score based on criteria
  IF recent_patients >= 5 AND days_since_patient <= 60 THEN
    RETURN 'Strong';
  ELSIF recent_patients >= 2 AND days_since_patient <= 90 THEN
    RETURN 'Moderate';
  ELSIF total_patients > 0 AND days_since_patient <= 180 THEN
    RETURN 'Sporadic';
  ELSE
    RETURN 'Cold';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_endpoint text, p_max_requests integer DEFAULT 100, p_window_minutes integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate window start time
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Get current request count in window
  SELECT COALESCE(SUM(request_count), 0)
  INTO v_current_count
  FROM public.rate_limit_log
  WHERE user_id = v_user_id
    AND endpoint = p_endpoint
    AND created_at > v_window_start;
  
  -- If under limit, log the request
  IF v_current_count < p_max_requests THEN
    INSERT INTO public.rate_limit_log (user_id, endpoint, request_count)
    VALUES (v_user_id, p_endpoint, 1)
    ON CONFLICT (user_id, endpoint, date_trunc('hour', created_at))
    DO UPDATE SET request_count = rate_limit_log.request_count + 1;
    
    RETURN TRUE;
  END IF;
  
  -- Log rate limit violation
  PERFORM public.log_security_event(
    v_user_id,
    'RATE_LIMIT_EXCEEDED',
    'rate_limit_log',
    NULL,
    jsonb_build_object(
      'endpoint', p_endpoint,
      'limit', p_max_requests,
      'window_minutes', p_window_minutes,
      'current_count', v_current_count
    )
  );
  
  RETURN FALSE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_discovered_offices()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM discovered_offices
  WHERE cache_expires_at < now()
    AND imported = false;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete audit logs older than 1 year
  DELETE FROM public.security_audit_log
  WHERE timestamp < now() - INTERVAL '1 year';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Delete rate limit logs older than 7 days
  DELETE FROM public.rate_limit_log
  WHERE created_at < now() - INTERVAL '7 days';
  
  RETURN v_deleted_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_clinic_for_user(p_name text, p_address text DEFAULT NULL::text, p_latitude numeric DEFAULT NULL::numeric, p_longitude numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();
  
  -- Validate user is authenticated
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if user already has a clinic
  IF EXISTS (SELECT 1 FROM public.clinics WHERE owner_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User already owns a clinic');
  END IF;
  
  -- Create the clinic
  INSERT INTO public.clinics (name, address, latitude, longitude, owner_id)
  VALUES (p_name, p_address, p_latitude, p_longitude, v_user_id)
  RETURNING id INTO v_clinic_id;
  
  -- Update user profile with only clinic_id (removed clinic_name, clinic_address, clinic_latitude, clinic_longitude)
  UPDATE public.user_profiles 
  SET clinic_id = v_clinic_id,
      updated_at = NOW()
  WHERE user_id = v_user_id;
  
  RETURN json_build_object(
    'success', true, 
    'clinic_id', v_clinic_id,
    'message', 'Clinic created successfully'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_daily_patients(p_entry_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source_id UUID;
  v_patient_date DATE;
  v_year_month VARCHAR;
  v_monthly_total INTEGER;
BEGIN
  -- Get the entry details before deletion
  SELECT source_id, patient_date INTO v_source_id, v_patient_date
  FROM public.daily_patients
  WHERE id = p_entry_id AND user_id = auth.uid();
  
  IF v_source_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Entry not found');
  END IF;
  
  -- Delete the entry
  DELETE FROM public.daily_patients WHERE id = p_entry_id AND user_id = auth.uid();
  
  -- Recalculate monthly total
  v_year_month := TO_CHAR(v_patient_date, 'YYYY-MM');
  
  SELECT COALESCE(SUM(patient_count), 0) INTO v_monthly_total
  FROM public.daily_patients
  WHERE source_id = v_source_id
    AND TO_CHAR(patient_date, 'YYYY-MM') = v_year_month
    AND user_id = auth.uid();
  
  -- Update monthly_patients
  UPDATE public.monthly_patients
  SET patient_count = v_monthly_total, updated_at = now()
  WHERE source_id = v_source_id
    AND year_month = v_year_month
    AND user_id = auth.uid();
  
  RETURN json_build_object(
    'success', true,
    'deleted_id', p_entry_id,
    'monthly_total', v_monthly_total
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.encrypt_pin_code(pin_text text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF pin_text IS NULL OR pin_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN crypt(pin_text, gen_salt('bf'));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_month_patients()
 RETURNS TABLE(source_id uuid, source_name text, source_type text, is_office boolean, current_month_patients integer, month_year date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_month_sources()
 RETURNS TABLE(source_id uuid, source_name text, source_type text, current_month_patients integer, month_year text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_daily_patients_for_month(p_year_month character varying)
 RETURNS TABLE(id uuid, source_id uuid, source_name text, source_type text, patient_date date, patient_count integer, notes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    dp.id,
    dp.source_id,
    ps.name::TEXT as source_name,
    ps.source_type::TEXT,
    dp.patient_date,
    dp.patient_count,
    dp.notes
  FROM public.daily_patients dp
  JOIN public.patient_sources ps ON dp.source_id = ps.id
  WHERE TO_CHAR(dp.patient_date, 'YYYY-MM') = p_year_month
    AND dp.user_id = auth.uid()
  ORDER BY dp.patient_date DESC, ps.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_data()
 RETURNS TABLE(summary json, recent_activity json)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_office_data_with_relations()
 RETURNS TABLE(id uuid, name text, address text, phone text, email text, website text, notes text, latitude numeric, longitude numeric, google_rating numeric, google_place_id text, opening_hours text, yelp_rating numeric, distance_miles numeric, last_updated_from_google timestamp with time zone, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, created_by uuid, l12 bigint, r3 bigint, mslr numeric, total_patients bigint, tier text, tags json, monthly_data json)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT clinic_id FROM public.user_profiles WHERE user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role::TEXT FROM public.user_profiles WHERE user_id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert user profile
  INSERT INTO public.user_profiles (
    user_id, 
    email, 
    first_name, 
    last_name, 
    phone,
    job_title,
    degrees,
    role, 
    clinic_id
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'job_title',
    NEW.raw_user_meta_data ->> 'degrees',
    'Front Desk', 
    NULL
  );
  
  -- Send welcome email via edge function (truly async, non-blocking)
  PERFORM net.http_post(
    url := 'https://vqkzqwibbcvmdwgqladn.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxa3pxd2liYmN2bWR3Z3FsYWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDAyMDQsImV4cCI6MjA2OTE3NjIwNH0.S6qvIFA1itxemVUTzfz4dDr2J9jz2z69NEv-fgb4gK4'
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'email', NEW.email,
        'raw_user_meta_data', NEW.raw_user_meta_data
      )
    )
  );
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_activity(p_action_type text, p_resource_type text, p_resource_id uuid DEFAULT NULL::uuid, p_resource_name text DEFAULT NULL::text, p_details jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_log (
    user_id,
    action_type,
    resource_type,
    resource_id,
    resource_name,
    details
  )
  VALUES (
    auth.uid(),
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_application_error(p_error_message text, p_error_stack text DEFAULT NULL::text, p_component_stack text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_severity text DEFAULT 'error'::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  error_id uuid;
BEGIN
  INSERT INTO public.error_logs (
    error_message,
    error_stack,
    component_stack,
    url,
    user_agent,
    severity,
    user_id,
    metadata
  ) VALUES (
    p_error_message,
    p_error_stack,
    p_component_stack,
    p_url,
    p_user_agent,
    p_severity,
    auth.uid(),
    p_metadata
  ) RETURNING id INTO error_id;
  
  RETURN error_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_google_places_update(p_office_id uuid, p_google_place_id text, p_action text, p_field_updates jsonb DEFAULT NULL::jsonb, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_conflict_details jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.google_places_audit_log (
    user_id,
    office_id,
    google_place_id,
    action,
    field_updates,
    old_values,
    new_values,
    conflict_details
  )
  VALUES (
    auth.uid(),
    p_office_id,
    p_google_place_id,
    p_action,
    p_field_updates,
    p_old_values,
    p_new_values,
    p_conflict_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_security_event(p_user_id uuid DEFAULT auth.uid(), p_action_type text DEFAULT 'unknown'::text, p_table_name text DEFAULT NULL::text, p_record_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.security_audit_log (
    user_id,
    action_type,
    table_name,
    record_id,
    details
  )
  VALUES (
    p_user_id,
    p_action_type,
    p_table_name,
    p_record_id,
    p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_patient_count(p_source_id uuid, p_year_month character varying, p_count integer, p_reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_old_count INTEGER;
    v_source_name TEXT;
BEGIN
    -- Get current count and source name
    SELECT patient_count INTO v_old_count
    FROM public.monthly_patients
    WHERE source_id = p_source_id AND year_month = p_year_month AND user_id = auth.uid();
    
    IF v_old_count IS NULL THEN
        v_old_count := 0;
    END IF;
    
    -- Get source name
    SELECT name INTO v_source_name
    FROM public.patient_sources
    WHERE id = p_source_id AND created_by = auth.uid();
    
    -- Set new count
    INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id)
    VALUES (p_source_id, p_year_month, p_count, auth.uid())
    ON CONFLICT (source_id, year_month)
    DO UPDATE SET 
        patient_count = p_count,
        updated_at = NOW()
    WHERE public.monthly_patients.user_id = auth.uid();
    
    -- Log change in patient_changes_log
    INSERT INTO public.patient_changes_log (
        source_id, year_month, old_count, new_count, change_type, reason, user_id
    ) VALUES (
        p_source_id, p_year_month, v_old_count, p_count, 'manual_edit', p_reason, auth.uid()
    );
    
    -- Log in activity_log
    PERFORM public.log_activity(
        'patient_count_updated',
        'patient_count',
        p_source_id,
        v_source_name,
        jsonb_build_object(
            'old_count', v_old_count,
            'new_count', p_count,
            'change', p_count - v_old_count,
            'year_month', p_year_month,
            'reason', p_reason
        )
    );
    
    RETURN p_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_patient_count(p_source_id uuid, p_count integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_month_year VARCHAR;
  v_result JSON;
BEGIN
  -- Get current month in YYYY-MM format
  v_month_year := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Insert or update the patient count (with user ownership)
  INSERT INTO public.monthly_patients (
    source_id,
    year_month,
    patient_count,
    user_id,
    updated_at
  )
  VALUES (
    p_source_id,
    v_month_year,
    p_count,
    auth.uid(),
    NOW()
  )
  ON CONFLICT (source_id, year_month)
  DO UPDATE SET
    patient_count = EXCLUDED.patient_count,
    updated_at = NOW()
  WHERE public.monthly_patients.user_id = auth.uid();
  
  -- Return the updated data
  SELECT json_build_object(
    'success', true,
    'source_id', p_source_id,
    'month_year', v_month_year,
    'patient_count', p_count
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_review_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_source_patient_count(p_source_id uuid, p_new_count integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current_month VARCHAR;
  v_old_count INTEGER;
BEGIN
  v_current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Get current count
  SELECT patient_count INTO v_old_count
  FROM public.monthly_patients
  WHERE source_id = p_source_id AND year_month = v_current_month AND user_id = auth.uid();
  
  -- Insert or update
  INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id, updated_at)
  VALUES (p_source_id, v_current_month, p_new_count, auth.uid(), NOW())
  ON CONFLICT (source_id, year_month)
  DO UPDATE SET 
    patient_count = EXCLUDED.patient_count,
    updated_at = NOW()
  WHERE public.monthly_patients.user_id = auth.uid();
  
  RETURN json_build_object(
    'success', true,
    'source_id', p_source_id,
    'month_year', v_current_month,
    'old_count', COALESCE(v_old_count, 0),
    'new_count', p_new_count
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_pin_code(new_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_encrypted_pin TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Validate PIN format (4-6 digits)
  IF new_pin IS NOT NULL AND (new_pin !~ '^[0-9]{4,6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be 4-6 digits');
  END IF;
  
  -- Encrypt the PIN
  IF new_pin IS NOT NULL THEN
    v_encrypted_pin := encrypt_pin_code(new_pin);
  ELSE
    v_encrypted_pin := NULL;
  END IF;
  
  -- Update the user's PIN
  UPDATE public.user_profiles 
  SET pin_code = v_encrypted_pin, updated_at = NOW()
  WHERE user_id = v_user_id;
  
  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_clinic_admin_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.clinics c ON up.clinic_id = c.id
    WHERE up.user_id = auth.uid() 
    AND (up.role = 'Owner' OR c.owner_id = up.user_id)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.user_owns_discovered_group(p_group_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.discovered_office_groups
    WHERE id = p_group_id AND user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.validate_auth_context()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  RETURN json_build_object(
    'authenticated', v_user_id IS NOT NULL,
    'user_id', v_user_id,
    'timestamp', NOW()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_user_profile_security()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Prevent NULL user_id (additional safety check)
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL for security reasons';
  END IF;
  
  -- Prevent users from changing their user_id during updates
  IF TG_OP = 'UPDATE' AND OLD.user_id != NEW.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id for security reasons';
  END IF;
  
  -- Validate email format (enhanced security)
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Sanitize phone numbers (remove potential injection)
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '[^0-9+\-\(\)\s]', '', 'g');
  END IF;
  
  -- Log sensitive profile changes for audit
  IF TG_OP = 'UPDATE' AND (
    OLD.email != NEW.email OR 
    OLD.phone != NEW.phone OR 
    OLD.role != NEW.role
  ) THEN
    PERFORM public.log_security_event(
      NEW.user_id,
      'PROFILE_SENSITIVE_UPDATE',
      'user_profiles',
      NEW.id,
      jsonb_build_object(
        'changed_fields', jsonb_build_object(
          'email', CASE WHEN OLD.email != NEW.email THEN 'changed' ELSE 'unchanged' END,
          'phone', CASE WHEN OLD.phone != NEW.phone THEN 'changed' ELSE 'unchanged' END,
          'role', CASE WHEN OLD.role != NEW.role THEN 'changed' ELSE 'unchanged' END
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_user_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Prevent users from changing their user_id
  IF OLD.user_id != NEW.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id';
  END IF;
  
  -- Validate email format (basic check)
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Prevent role elevation (if role system is implemented)
  -- Users cannot promote themselves to Owner role
  IF OLD.role != 'Owner' AND NEW.role = 'Owner' THEN
    RAISE EXCEPTION 'Cannot self-promote to Owner role';
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_pin_code(pin_text text, encrypted_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF pin_text IS NULL OR encrypted_pin IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN (crypt(pin_text, encrypted_pin) = encrypted_pin);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_user_pin_code(input_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_stored_pin TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get the stored encrypted PIN
  SELECT pin_code INTO v_stored_pin
  FROM public.user_profiles 
  WHERE user_id = v_user_id;
  
  -- If no PIN is set
  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No PIN set for this user');
  END IF;
  
  -- Verify the PIN
  IF verify_pin_code(input_pin, v_stored_pin) THEN
    RETURN json_build_object('success', true, 'verified', true);
  ELSE
    RETURN json_build_object('success', true, 'verified', false);
  END IF;
END;
$function$
;


-- ============ VIEWS ============
CREATE OR REPLACE VIEW public.dashboard_summary AS
 SELECT user_id,
    ( SELECT json_build_object('total_sources', count(*), 'active_sources', count(*) FILTER (WHERE ps.is_active = true), 'total_patients_this_month', COALESCE(sum(mp.patient_count), 0::bigint), 'total_patients_last_month', COALESCE(sum(mp_last.patient_count), 0::bigint)) AS json_build_object
           FROM patient_sources ps
             LEFT JOIN monthly_patients mp ON ps.id = mp.source_id AND mp.year_month::text = to_char(CURRENT_DATE::timestamp with time zone, 'YYYY-MM'::text) AND mp.user_id = up.user_id
             LEFT JOIN monthly_patients mp_last ON ps.id = mp_last.source_id AND mp_last.year_month::text = to_char(CURRENT_DATE - '1 mon'::interval, 'YYYY-MM'::text) AND mp_last.user_id = up.user_id
          WHERE ps.created_by = up.user_id) AS summary_data,
    ( SELECT json_agg(json_build_object('month', month_data.month, 'total_patients', month_data.total_patients) ORDER BY month_data.month) AS json_agg
           FROM ( SELECT mp.year_month AS month,
                    sum(mp.patient_count) AS total_patients
                   FROM monthly_patients mp
                     JOIN patient_sources ps ON mp.source_id = ps.id
                  WHERE ps.created_by = up.user_id AND mp.user_id = up.user_id AND mp.year_month::text >= to_char(CURRENT_DATE - '11 mons'::interval, 'YYYY-MM'::text)
                  GROUP BY mp.year_month) month_data) AS monthly_trends,
    ( SELECT json_agg(json_build_object('source_type', source_data.source_type, 'count', source_data.count, 'total_patients', source_data.total_patients)) AS json_agg
           FROM ( SELECT ps.source_type::text AS source_type,
                    count(*) AS count,
                    COALESCE(sum(mp.patient_count), 0::bigint) AS total_patients
                   FROM patient_sources ps
                     LEFT JOIN monthly_patients mp ON ps.id = mp.source_id AND mp.year_month::text = to_char(CURRENT_DATE::timestamp with time zone, 'YYYY-MM'::text) AND mp.user_id = up.user_id
                  WHERE ps.created_by = up.user_id
                  GROUP BY ps.source_type) source_data) AS source_groups
   FROM user_profiles up
  WHERE user_id = auth.uid();

CREATE OR REPLACE VIEW public.office_metrics AS
 SELECT id,
    name,
    address,
    phone,
    email,
    website,
    notes,
    latitude,
    longitude,
    google_rating,
    google_place_id,
    opening_hours,
    yelp_rating,
    distance_miles,
    last_updated_from_google,
    is_active,
    created_at,
    updated_at,
    created_by,
    COALESCE(( SELECT sum(mp.patient_count) AS sum
           FROM monthly_patients mp
          WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by AND mp.year_month::text >= to_char(CURRENT_DATE - '11 mons'::interval, 'YYYY-MM'::text)), 0::bigint) AS l12,
    COALESCE(( SELECT sum(mp.patient_count) AS sum
           FROM monthly_patients mp
          WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by AND mp.year_month::text >= to_char(CURRENT_DATE - '2 mons'::interval, 'YYYY-MM'::text)), 0::bigint) AS r3,
    COALESCE(( SELECT date_part('month'::text, age(CURRENT_DATE::timestamp with time zone, to_date(max(mp.year_month::text), 'YYYY-MM'::text)::timestamp with time zone)) AS date_part
           FROM monthly_patients mp
          WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by AND mp.patient_count > 0), 999::double precision) AS mslr,
    COALESCE(( SELECT sum(mp.patient_count) AS sum
           FROM monthly_patients mp
          WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by), 0::bigint) AS total_patients,
        CASE
            WHEN COALESCE(( SELECT sum(mp.patient_count) AS sum
               FROM monthly_patients mp
              WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by AND mp.year_month::text >= to_char(CURRENT_DATE - '2 mons'::interval, 'YYYY-MM'::text)), 0::bigint) >= 5 AND COALESCE(( SELECT date_part('month'::text, age(CURRENT_DATE::timestamp with time zone, to_date(max(mp.year_month::text), 'YYYY-MM'::text)::timestamp with time zone)) AS date_part
               FROM monthly_patients mp
              WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by AND mp.patient_count > 0), 999::double precision) <= 2::double precision THEN 'Strong'::text
            WHEN COALESCE(( SELECT sum(mp.patient_count) AS sum
               FROM monthly_patients mp
              WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by AND mp.year_month::text >= to_char(CURRENT_DATE - '2 mons'::interval, 'YYYY-MM'::text)), 0::bigint) >= 2 AND COALESCE(( SELECT date_part('month'::text, age(CURRENT_DATE::timestamp with time zone, to_date(max(mp.year_month::text), 'YYYY-MM'::text)::timestamp with time zone)) AS date_part
               FROM monthly_patients mp
              WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by AND mp.patient_count > 0), 999::double precision) <= 3::double precision THEN 'Moderate'::text
            WHEN COALESCE(( SELECT sum(mp.patient_count) AS sum
               FROM monthly_patients mp
              WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by), 0::bigint) > 0 AND COALESCE(( SELECT date_part('month'::text, age(CURRENT_DATE::timestamp with time zone, to_date(max(mp.year_month::text), 'YYYY-MM'::text)::timestamp with time zone)) AS date_part
               FROM monthly_patients mp
              WHERE mp.source_id = ps.id AND mp.user_id = ps.created_by AND mp.patient_count > 0), 999::double precision) <= 6::double precision THEN 'Sporadic'::text
            ELSE 'Cold'::text
        END AS tier
   FROM patient_sources ps
  WHERE created_by = auth.uid();


-- ============ TRIGGERS ============
DROP TRIGGER IF EXISTS update_ai_generated_content_updated_at ON public.ai_generated_content;
CREATE TRIGGER update_ai_generated_content_updated_at BEFORE UPDATE ON public.ai_generated_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_ai_response_templates_updated_at ON public.ai_response_templates;
CREATE TRIGGER update_ai_response_templates_updated_at BEFORE UPDATE ON public.ai_response_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_campaign_deliveries_updated_at ON public.campaign_deliveries;
CREATE TRIGGER update_campaign_deliveries_updated_at BEFORE UPDATE ON public.campaign_deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_campaign_templates_updated_at ON public.campaign_templates;
CREATE TRIGGER update_campaign_templates_updated_at BEFORE UPDATE ON public.campaign_templates FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_clinic_brand_settings_updated_at ON public.clinic_brand_settings;
CREATE TRIGGER update_clinic_brand_settings_updated_at BEFORE UPDATE ON public.clinic_brand_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_clinics_updated_at ON public.clinics;
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_competitor_watchlist_updated_at ON public.competitor_watchlist;
CREATE TRIGGER update_competitor_watchlist_updated_at BEFORE UPDATE ON public.competitor_watchlist FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS update_daily_patients_updated_at ON public.daily_patients;
CREATE TRIGGER update_daily_patients_updated_at BEFORE UPDATE ON public.daily_patients FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS update_discovered_office_groups_updated_at ON public.discovered_office_groups;
CREATE TRIGGER update_discovered_office_groups_updated_at BEFORE UPDATE ON public.discovered_office_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS audit_discovered_offices ON public.discovered_offices;
CREATE TRIGGER audit_discovered_offices AFTER INSERT OR DELETE OR UPDATE ON public.discovered_offices FOR EACH ROW EXECUTE FUNCTION audit_data_access();
DROP TRIGGER IF EXISTS update_discovered_offices_updated_at ON public.discovered_offices;
CREATE TRIGGER update_discovered_offices_updated_at BEFORE UPDATE ON public.discovered_offices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_discovery_sessions_updated_at ON public.discovery_sessions;
CREATE TRIGGER update_discovery_sessions_updated_at BEFORE UPDATE ON public.discovery_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_google_business_tokens_updated_at ON public.google_business_tokens;
CREATE TRIGGER update_google_business_tokens_updated_at BEFORE UPDATE ON public.google_business_tokens FOR EACH ROW EXECUTE FUNCTION update_review_updated_at();
DROP TRIGGER IF EXISTS update_google_reviews_updated_at ON public.google_reviews;
CREATE TRIGGER update_google_reviews_updated_at BEFORE UPDATE ON public.google_reviews FOR EACH ROW EXECUTE FUNCTION update_review_updated_at();
DROP TRIGGER IF EXISTS update_mailing_label_edits_updated_at ON public.mailing_label_edits;
CREATE TRIGGER update_mailing_label_edits_updated_at BEFORE UPDATE ON public.mailing_label_edits FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS update_marketing_visits_updated_at ON public.marketing_visits;
CREATE TRIGGER update_marketing_visits_updated_at BEFORE UPDATE ON public.marketing_visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_monthly_patients_updated_at ON public.monthly_patients;
CREATE TRIGGER update_monthly_patients_updated_at BEFORE UPDATE ON public.monthly_patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_office_contacts_updated_at ON public.office_contacts;
CREATE TRIGGER update_office_contacts_updated_at BEFORE UPDATE ON public.office_contacts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS update_office_emails_updated_at ON public.office_emails;
CREATE TRIGGER update_office_emails_updated_at BEFORE UPDATE ON public.office_emails FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_office_tags_updated_at ON public.office_tags;
CREATE TRIGGER update_office_tags_updated_at BEFORE UPDATE ON public.office_tags FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS audit_patient_sources ON public.patient_sources;
CREATE TRIGGER audit_patient_sources AFTER INSERT OR DELETE OR UPDATE ON public.patient_sources FOR EACH ROW EXECUTE FUNCTION audit_data_access();
DROP TRIGGER IF EXISTS update_patient_sources_updated_at ON public.patient_sources;
CREATE TRIGGER update_patient_sources_updated_at BEFORE UPDATE ON public.patient_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_review_replies_updated_at ON public.review_replies;
CREATE TRIGGER update_review_replies_updated_at BEFORE UPDATE ON public.review_replies FOR EACH ROW EXECUTE FUNCTION update_review_updated_at();
DROP TRIGGER IF EXISTS update_review_status_updated_at ON public.review_status;
CREATE TRIGGER update_review_status_updated_at BEFORE UPDATE ON public.review_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_updated_at_subscription_plans ON public.subscription_plans;
CREATE TRIGGER set_updated_at_subscription_plans BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_subscriptions ON public.subscriptions;
CREATE TRIGGER set_updated_at_subscriptions BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS audit_user_invitations ON public.user_invitations;
CREATE TRIGGER audit_user_invitations AFTER INSERT OR DELETE OR UPDATE ON public.user_invitations FOR EACH ROW EXECUTE FUNCTION audit_data_access();
DROP TRIGGER IF EXISTS audit_user_profiles ON public.user_profiles;
CREATE TRIGGER audit_user_profiles AFTER INSERT OR DELETE OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION audit_data_access();
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS validate_user_profile_changes ON public.user_profiles;
CREATE TRIGGER validate_user_profile_changes BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION validate_user_profile_update();
DROP TRIGGER IF EXISTS validate_user_profile_security ON public.user_profiles;
CREATE TRIGGER validate_user_profile_security BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION validate_user_profile_security();

-- ============ GRANTS ============
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.activity_log TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.activity_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.activity_log TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_business_profiles TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_business_profiles TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_business_profiles TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_generated_content TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_generated_content TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_generated_content TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_response_templates TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_response_templates TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_response_templates TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_usage_tracking TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_usage_tracking TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.ai_usage_tracking TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campaign_deliveries TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campaign_deliveries TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campaign_deliveries TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campaign_templates TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campaign_templates TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campaign_templates TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campaigns TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campaigns TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.campaigns TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.clinic_brand_settings TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.clinic_brand_settings TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.clinic_brand_settings TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.clinics TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.clinics TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.clinics TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.competitor_snapshots TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.competitor_snapshots TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.competitor_snapshots TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.competitor_watchlist TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.competitor_watchlist TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.competitor_watchlist TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.daily_patients TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.daily_patients TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.daily_patients TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.dashboard_summary TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.dashboard_summary TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.dashboard_summary TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovered_office_group_members TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovered_office_group_members TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovered_office_group_members TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovered_office_groups TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovered_office_groups TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovered_office_groups TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovered_offices TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovered_offices TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovered_offices TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovery_sessions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovery_sessions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.discovery_sessions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.error_logs TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.error_logs TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.error_logs TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.google_business_tokens TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.google_business_tokens TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.google_business_tokens TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.google_places_audit_log TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.google_places_audit_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.google_places_audit_log TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.google_reviews TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.google_reviews TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.google_reviews TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.mailing_label_edits TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.mailing_label_edits TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.mailing_label_edits TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.marketing_visits TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.marketing_visits TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.marketing_visits TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.monthly_patients TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.monthly_patients TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.monthly_patients TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_contacts TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_contacts TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_contacts TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_emails TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_emails TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_emails TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_interactions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_interactions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_interactions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_metrics TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_metrics TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_metrics TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_tag_assignments TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_tag_assignments TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_tag_assignments TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_tags TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_tags TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.office_tags TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.patient_changes_log TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.patient_changes_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.patient_changes_log TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.patient_sources TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.patient_sources TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.patient_sources TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.rate_limit_log TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.rate_limit_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.rate_limit_log TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_replies TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_replies TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_replies TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_status TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_status TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_status TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_sync_log TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_sync_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_sync_log TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.security_audit_log TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.security_audit_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.security_audit_log TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.source_tags TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.source_tags TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.source_tags TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subscription_plans TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subscription_plans TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subscription_plans TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subscriptions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subscriptions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.subscriptions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_invitations TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_invitations TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_invitations TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_profiles TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_profiles TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_profiles TO service_role;

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_office_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_office_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_business_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_places_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mailing_label_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_changes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
DROP POLICY IF EXISTS "Users can insert their own activity log" ON public.activity_log;
CREATE POLICY "Users can insert their own activity log" ON public.activity_log AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own activity log" ON public.activity_log;
CREATE POLICY "Users can view their own activity log" ON public.activity_log AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage their own AI business profile" ON public.ai_business_profiles;
CREATE POLICY "Users can manage their own AI business profile" ON public.ai_business_profiles AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage their own AI generated content" ON public.ai_generated_content;
CREATE POLICY "Users can manage their own AI generated content" ON public.ai_generated_content AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage their own AI templates" ON public.ai_response_templates;
CREATE POLICY "Users can manage their own AI templates" ON public.ai_response_templates AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "System can insert AI usage tracking" ON public.ai_usage_tracking;
CREATE POLICY "System can insert AI usage tracking" ON public.ai_usage_tracking AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own AI usage ratings" ON public.ai_usage_tracking;
CREATE POLICY "Users can update their own AI usage ratings" ON public.ai_usage_tracking AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own AI usage" ON public.ai_usage_tracking;
CREATE POLICY "Users can view their own AI usage" ON public.ai_usage_tracking AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create their own campaign deliveries" ON public.campaign_deliveries;
CREATE POLICY "Users can create their own campaign deliveries" ON public.campaign_deliveries AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own campaign deliveries" ON public.campaign_deliveries;
CREATE POLICY "Users can delete their own campaign deliveries" ON public.campaign_deliveries AS PERMISSIVE FOR DELETE TO public
  USING ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own campaign deliveries" ON public.campaign_deliveries;
CREATE POLICY "Users can update their own campaign deliveries" ON public.campaign_deliveries AS PERMISSIVE FOR UPDATE TO public
  USING ((created_by = auth.uid()))
  WITH CHECK ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own campaign deliveries" ON public.campaign_deliveries;
CREATE POLICY "Users can view their own campaign deliveries" ON public.campaign_deliveries AS PERMISSIVE FOR SELECT TO public
  USING ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.campaign_templates;
CREATE POLICY "Users can delete their own templates" ON public.campaign_templates AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own templates" ON public.campaign_templates;
CREATE POLICY "Users can insert their own templates" ON public.campaign_templates AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own templates" ON public.campaign_templates;
CREATE POLICY "Users can update their own templates" ON public.campaign_templates AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own templates" ON public.campaign_templates;
CREATE POLICY "Users can view their own templates" ON public.campaign_templates AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create their own campaigns" ON public.campaigns;
CREATE POLICY "Users can create their own campaigns" ON public.campaigns AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;
CREATE POLICY "Users can delete their own campaigns" ON public.campaigns AS PERMISSIVE FOR DELETE TO public
  USING ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
CREATE POLICY "Users can update their own campaigns" ON public.campaigns AS PERMISSIVE FOR UPDATE TO public
  USING ((created_by = auth.uid()))
  WITH CHECK ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
CREATE POLICY "Users can view their own campaigns" ON public.campaigns AS PERMISSIVE FOR SELECT TO public
  USING ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Clinic owners can insert brand settings" ON public.clinic_brand_settings;
CREATE POLICY "Clinic owners can insert brand settings" ON public.clinic_brand_settings AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((clinic_id = get_user_clinic_id()) AND user_has_clinic_admin_access()));
DROP POLICY IF EXISTS "Clinic owners can update brand settings" ON public.clinic_brand_settings;
CREATE POLICY "Clinic owners can update brand settings" ON public.clinic_brand_settings AS PERMISSIVE FOR UPDATE TO public
  USING (((clinic_id = get_user_clinic_id()) AND user_has_clinic_admin_access()));
DROP POLICY IF EXISTS "Users can view their clinic brand settings" ON public.clinic_brand_settings;
CREATE POLICY "Users can view their clinic brand settings" ON public.clinic_brand_settings AS PERMISSIVE FOR SELECT TO public
  USING ((clinic_id = get_user_clinic_id()));
DROP POLICY IF EXISTS "Authenticated users can create clinics" ON public.clinics;
CREATE POLICY "Authenticated users can create clinics" ON public.clinics AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((owner_id = auth.uid()));
DROP POLICY IF EXISTS "Owners can update their clinic" ON public.clinics;
CREATE POLICY "Owners can update their clinic" ON public.clinics AS PERMISSIVE FOR UPDATE TO public
  USING ((owner_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their clinic" ON public.clinics;
CREATE POLICY "Users can view their clinic" ON public.clinics AS PERMISSIVE FOR SELECT TO public
  USING ((id = get_user_clinic_id()));
DROP POLICY IF EXISTS "Users can delete their own snapshots" ON public.competitor_snapshots;
CREATE POLICY "Users can delete their own snapshots" ON public.competitor_snapshots AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own snapshots" ON public.competitor_snapshots;
CREATE POLICY "Users can insert their own snapshots" ON public.competitor_snapshots AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own snapshots" ON public.competitor_snapshots;
CREATE POLICY "Users can update their own snapshots" ON public.competitor_snapshots AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own snapshots" ON public.competitor_snapshots;
CREATE POLICY "Users can view their own snapshots" ON public.competitor_snapshots AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage their own watchlist" ON public.competitor_watchlist;
CREATE POLICY "Users can manage their own watchlist" ON public.competitor_watchlist AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own daily patients" ON public.daily_patients;
CREATE POLICY "Users can delete their own daily patients" ON public.daily_patients AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own daily patients" ON public.daily_patients;
CREATE POLICY "Users can insert their own daily patients" ON public.daily_patients AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own daily patients" ON public.daily_patients;
CREATE POLICY "Users can update their own daily patients" ON public.daily_patients AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own daily patients" ON public.daily_patients;
CREATE POLICY "Users can view their own daily patients" ON public.daily_patients AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can add to their groups" ON public.discovered_office_group_members;
CREATE POLICY "Users can add to their groups" ON public.discovered_office_group_members AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (user_owns_discovered_group(group_id));
DROP POLICY IF EXISTS "Users can remove from their groups" ON public.discovered_office_group_members;
CREATE POLICY "Users can remove from their groups" ON public.discovered_office_group_members AS PERMISSIVE FOR DELETE TO public
  USING (user_owns_discovered_group(group_id));
DROP POLICY IF EXISTS "Users can view their group members" ON public.discovered_office_group_members;
CREATE POLICY "Users can view their group members" ON public.discovered_office_group_members AS PERMISSIVE FOR SELECT TO public
  USING (user_owns_discovered_group(group_id));
DROP POLICY IF EXISTS "Users can create their own groups" ON public.discovered_office_groups;
CREATE POLICY "Users can create their own groups" ON public.discovered_office_groups AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own groups" ON public.discovered_office_groups;
CREATE POLICY "Users can delete their own groups" ON public.discovered_office_groups AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own groups" ON public.discovered_office_groups;
CREATE POLICY "Users can update their own groups" ON public.discovered_office_groups AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own groups" ON public.discovered_office_groups;
CREATE POLICY "Users can view their own groups" ON public.discovered_office_groups AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their discovered offices" ON public.discovered_offices;
CREATE POLICY "Users can delete their discovered offices" ON public.discovered_offices AS PERMISSIVE FOR DELETE TO public
  USING ((discovered_by = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their discovered offices" ON public.discovered_offices;
CREATE POLICY "Users can insert their discovered offices" ON public.discovered_offices AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((discovered_by = auth.uid()));
DROP POLICY IF EXISTS "Users can update their discovered offices" ON public.discovered_offices;
CREATE POLICY "Users can update their discovered offices" ON public.discovered_offices AS PERMISSIVE FOR UPDATE TO public
  USING ((discovered_by = auth.uid()))
  WITH CHECK ((discovered_by = auth.uid()));
DROP POLICY IF EXISTS "Users can view their discovered offices" ON public.discovered_offices;
CREATE POLICY "Users can view their discovered offices" ON public.discovered_offices AS PERMISSIVE FOR SELECT TO public
  USING ((discovered_by = auth.uid()));
DROP POLICY IF EXISTS "Users can create their own discovery sessions" ON public.discovery_sessions;
CREATE POLICY "Users can create their own discovery sessions" ON public.discovery_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own discovery sessions" ON public.discovery_sessions;
CREATE POLICY "Users can delete their own discovery sessions" ON public.discovery_sessions AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own discovery sessions" ON public.discovery_sessions;
CREATE POLICY "Users can update their own discovery sessions" ON public.discovery_sessions AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own discovery sessions" ON public.discovery_sessions;
CREATE POLICY "Users can view their own discovery sessions" ON public.discovery_sessions AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "System can update error logs" ON public.error_logs;
CREATE POLICY "System can update error logs" ON public.error_logs AS PERMISSIVE FOR UPDATE TO public
  USING (true);
DROP POLICY IF EXISTS "Users can insert their own error logs" ON public.error_logs;
CREATE POLICY "Users can insert their own error logs" ON public.error_logs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));
DROP POLICY IF EXISTS "Users can view their own error logs" ON public.error_logs;
CREATE POLICY "Users can view their own error logs" ON public.error_logs AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id) OR (user_id IS NULL)));
DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.google_business_tokens;
CREATE POLICY "Users can manage their own tokens" ON public.google_business_tokens AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.google_places_audit_log;
CREATE POLICY "Users can insert their own audit logs" ON public.google_places_audit_log AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.google_places_audit_log;
CREATE POLICY "Users can view their own audit logs" ON public.google_places_audit_log AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "System can insert reviews" ON public.google_reviews;
CREATE POLICY "System can insert reviews" ON public.google_reviews AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.google_reviews;
CREATE POLICY "Users can update their own reviews" ON public.google_reviews AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.google_reviews;
CREATE POLICY "Users can view their own reviews" ON public.google_reviews AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own label edits" ON public.mailing_label_edits;
CREATE POLICY "Users can delete their own label edits" ON public.mailing_label_edits AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own label edits" ON public.mailing_label_edits;
CREATE POLICY "Users can insert their own label edits" ON public.mailing_label_edits AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own label edits" ON public.mailing_label_edits;
CREATE POLICY "Users can update their own label edits" ON public.mailing_label_edits AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own label edits" ON public.mailing_label_edits;
CREATE POLICY "Users can view their own label edits" ON public.mailing_label_edits AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own marketing visits" ON public.marketing_visits;
CREATE POLICY "Users can delete their own marketing visits" ON public.marketing_visits AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own marketing visits" ON public.marketing_visits;
CREATE POLICY "Users can insert their own marketing visits" ON public.marketing_visits AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own marketing visits" ON public.marketing_visits;
CREATE POLICY "Users can update their own marketing visits" ON public.marketing_visits AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own marketing visits" ON public.marketing_visits;
CREATE POLICY "Users can view their own marketing visits" ON public.marketing_visits AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own monthly patients" ON public.monthly_patients;
CREATE POLICY "Users can delete their own monthly patients" ON public.monthly_patients AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own monthly patients" ON public.monthly_patients;
CREATE POLICY "Users can insert their own monthly patients" ON public.monthly_patients AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own monthly patients" ON public.monthly_patients;
CREATE POLICY "Users can update their own monthly patients" ON public.monthly_patients AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own monthly patients" ON public.monthly_patients;
CREATE POLICY "Users can view their own monthly patients" ON public.monthly_patients AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.office_contacts;
CREATE POLICY "Users can delete their own contacts" ON public.office_contacts AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.office_contacts;
CREATE POLICY "Users can insert their own contacts" ON public.office_contacts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.office_contacts;
CREATE POLICY "Users can update their own contacts" ON public.office_contacts AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.office_contacts;
CREATE POLICY "Users can view their own contacts" ON public.office_contacts AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create their own office emails" ON public.office_emails;
CREATE POLICY "Users can create their own office emails" ON public.office_emails AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete their own office emails" ON public.office_emails;
CREATE POLICY "Users can delete their own office emails" ON public.office_emails AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own office emails" ON public.office_emails;
CREATE POLICY "Users can update their own office emails" ON public.office_emails AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own office emails" ON public.office_emails;
CREATE POLICY "Users can view their own office emails" ON public.office_emails AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can delete their own interactions" ON public.office_interactions;
CREATE POLICY "Users can delete their own interactions" ON public.office_interactions AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own interactions" ON public.office_interactions;
CREATE POLICY "Users can insert their own interactions" ON public.office_interactions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own interactions" ON public.office_interactions;
CREATE POLICY "Users can update their own interactions" ON public.office_interactions AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own interactions" ON public.office_interactions;
CREATE POLICY "Users can view their own interactions" ON public.office_interactions AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete tag assignments" ON public.office_tag_assignments;
CREATE POLICY "Users can delete tag assignments" ON public.office_tag_assignments AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM office_tags
  WHERE ((office_tags.id = office_tag_assignments.tag_id) AND (office_tags.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can insert tag assignments" ON public.office_tag_assignments;
CREATE POLICY "Users can insert tag assignments" ON public.office_tag_assignments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM office_tags
  WHERE ((office_tags.id = office_tag_assignments.tag_id) AND (office_tags.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can view their tag assignments" ON public.office_tag_assignments;
CREATE POLICY "Users can view their tag assignments" ON public.office_tag_assignments AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM office_tags
  WHERE ((office_tags.id = office_tag_assignments.tag_id) AND (office_tags.user_id = auth.uid())))));
DROP POLICY IF EXISTS "Users can delete their own tags" ON public.office_tags;
CREATE POLICY "Users can delete their own tags" ON public.office_tags AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own tags" ON public.office_tags;
CREATE POLICY "Users can insert their own tags" ON public.office_tags AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own tags" ON public.office_tags;
CREATE POLICY "Users can update their own tags" ON public.office_tags AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own tags" ON public.office_tags;
CREATE POLICY "Users can view their own tags" ON public.office_tags AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own patient changes log" ON public.patient_changes_log;
CREATE POLICY "Users can insert their own patient changes log" ON public.patient_changes_log AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own patient changes log" ON public.patient_changes_log;
CREATE POLICY "Users can view their own patient changes log" ON public.patient_changes_log AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own patient sources" ON public.patient_sources;
CREATE POLICY "Users can delete their own patient sources" ON public.patient_sources AS PERMISSIVE FOR DELETE TO public
  USING ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own patient sources" ON public.patient_sources;
CREATE POLICY "Users can insert their own patient sources" ON public.patient_sources AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own patient sources" ON public.patient_sources;
CREATE POLICY "Users can update their own patient sources" ON public.patient_sources AS PERMISSIVE FOR UPDATE TO public
  USING ((created_by = auth.uid()))
  WITH CHECK ((created_by = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own patient sources" ON public.patient_sources;
CREATE POLICY "Users can view their own patient sources" ON public.patient_sources AS PERMISSIVE FOR SELECT TO public
  USING ((created_by = auth.uid()));
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limit_log;
CREATE POLICY "System can manage rate limits" ON public.rate_limit_log AS PERMISSIVE FOR ALL TO public
  WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view their own rate limits" ON public.rate_limit_log;
CREATE POLICY "Users can view their own rate limits" ON public.rate_limit_log AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage their own review replies" ON public.review_replies;
CREATE POLICY "Users can manage their own review replies" ON public.review_replies AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own review status" ON public.review_status;
CREATE POLICY "Users can delete their own review status" ON public.review_status AS PERMISSIVE FOR DELETE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own review status" ON public.review_status;
CREATE POLICY "Users can insert their own review status" ON public.review_status AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own review status" ON public.review_status;
CREATE POLICY "Users can update their own review status" ON public.review_status AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own review status" ON public.review_status;
CREATE POLICY "Users can view their own review status" ON public.review_status AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "System can manage sync logs" ON public.review_sync_log;
CREATE POLICY "System can manage sync logs" ON public.review_sync_log AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view their own sync logs" ON public.review_sync_log;
CREATE POLICY "Users can view their own sync logs" ON public.review_sync_log AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "System can insert audit logs" ON public.security_audit_log;
CREATE POLICY "System can insert audit logs" ON public.security_audit_log AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.security_audit_log;
CREATE POLICY "Users can view their own audit logs" ON public.security_audit_log AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their own source tags" ON public.source_tags;
CREATE POLICY "Users can delete their own source tags" ON public.source_tags AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their own source tags" ON public.source_tags;
CREATE POLICY "Users can insert their own source tags" ON public.source_tags AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their own source tags" ON public.source_tags;
CREATE POLICY "Users can update their own source tags" ON public.source_tags AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view their own source tags" ON public.source_tags;
CREATE POLICY "Users can view their own source tags" ON public.source_tags AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view subscription plans" ON public.subscription_plans AS PERMISSIVE FOR SELECT TO public
  USING (true);
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
CREATE POLICY "Users can insert their own subscription" ON public.subscriptions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;
CREATE POLICY "Users can update their own subscription" ON public.subscriptions AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription" ON public.subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Clinic admins can create invitations" ON public.user_invitations;
CREATE POLICY "Clinic admins can create invitations" ON public.user_invitations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_has_clinic_admin_access() AND (clinic_id = get_user_clinic_id()) AND (invited_by = auth.uid())));
DROP POLICY IF EXISTS "Clinic admins can update invitations" ON public.user_invitations;
CREATE POLICY "Clinic admins can update invitations" ON public.user_invitations AS PERMISSIVE FOR UPDATE TO public
  USING ((user_has_clinic_admin_access() AND (clinic_id = get_user_clinic_id())));
DROP POLICY IF EXISTS "Clinic admins can view invitations" ON public.user_invitations;
CREATE POLICY "Clinic admins can view invitations" ON public.user_invitations AS PERMISSIVE FOR SELECT TO public
  USING ((user_has_clinic_admin_access() AND (clinic_id = get_user_clinic_id())));
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile" ON public.user_profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)));
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)))
  WITH CHECK (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)));
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" ON public.user_profiles AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)));
