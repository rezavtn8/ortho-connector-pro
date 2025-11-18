-- Phase 1: Create comprehensive brand settings table
CREATE TABLE IF NOT EXISTS public.clinic_brand_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  
  -- Logo & Visual Identity
  logo_url TEXT,
  logo_dark_url TEXT, -- for dark mode
  favicon_url TEXT,
  
  -- Brand Colors (stored as HSL for easy theming)
  primary_color TEXT DEFAULT '262.1 83.3% 57.8%', -- HSL values
  secondary_color TEXT DEFAULT '252 40% 50%',
  accent_color TEXT DEFAULT '262.1 83.3% 57.8%',
  background_color TEXT DEFAULT '0 0% 100%',
  foreground_color TEXT DEFAULT '222.2 84% 4.9%',
  
  -- Brand Typography
  brand_name TEXT,
  tagline TEXT,
  font_family TEXT DEFAULT 'system-ui',
  
  -- Contact & Social
  website_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  social_links JSONB DEFAULT '{}',
  
  -- Advanced Settings
  custom_css TEXT,
  brand_voice TEXT, -- e.g., 'professional', 'friendly', 'clinical'
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.clinic_brand_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their clinic brand settings"
ON public.clinic_brand_settings
FOR SELECT
USING (clinic_id = get_user_clinic_id());

CREATE POLICY "Clinic owners can update brand settings"
ON public.clinic_brand_settings
FOR UPDATE
USING (clinic_id = get_user_clinic_id() AND user_has_clinic_admin_access());

CREATE POLICY "Clinic owners can insert brand settings"
ON public.clinic_brand_settings
FOR INSERT
WITH CHECK (clinic_id = get_user_clinic_id() AND user_has_clinic_admin_access());

-- Trigger for updated_at
CREATE TRIGGER update_clinic_brand_settings_updated_at
BEFORE UPDATE ON public.clinic_brand_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_clinic_brand_settings_clinic_id ON public.clinic_brand_settings(clinic_id);

COMMENT ON TABLE public.clinic_brand_settings IS 'Centralized brand settings for unified platform branding';
COMMENT ON COLUMN public.clinic_brand_settings.primary_color IS 'Primary brand color in HSL format (e.g., "262.1 83.3% 57.8%")';
COMMENT ON COLUMN public.clinic_brand_settings.social_links IS 'Social media links as JSON: {"facebook": "url", "instagram": "url", etc.}';
COMMENT ON COLUMN public.clinic_brand_settings.brand_voice IS 'Brand personality for AI-generated content';