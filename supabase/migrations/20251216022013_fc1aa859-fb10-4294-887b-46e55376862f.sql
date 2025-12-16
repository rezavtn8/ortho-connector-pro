-- PHASE 3: Data Persistence Tables

-- Mailing Label Edits (persist custom label data)
CREATE TABLE public.mailing_label_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  office_id UUID NOT NULL REFERENCES public.patient_sources(id) ON DELETE CASCADE,
  custom_name TEXT,
  custom_contact_name TEXT,
  custom_address1 TEXT,
  custom_address2 TEXT,
  custom_city TEXT,
  custom_state TEXT,
  custom_zip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, office_id)
);

ALTER TABLE public.mailing_label_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own label edits" ON public.mailing_label_edits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own label edits" ON public.mailing_label_edits
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own label edits" ON public.mailing_label_edits
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own label edits" ON public.mailing_label_edits
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_mailing_label_edits_updated_at
  BEFORE UPDATE ON public.mailing_label_edits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Campaign Templates
CREATE TABLE public.campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  target_tiers TEXT[],
  email_subject_template TEXT,
  email_body_template TEXT,
  gift_bundle JSONB,
  materials_checklist TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates" ON public.campaign_templates
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own templates" ON public.campaign_templates
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own templates" ON public.campaign_templates
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own templates" ON public.campaign_templates
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_campaign_templates_updated_at
  BEFORE UPDATE ON public.campaign_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Office Interactions (activity timeline)
CREATE TABLE public.office_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  office_id UUID NOT NULL REFERENCES public.patient_sources(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.office_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interactions" ON public.office_interactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own interactions" ON public.office_interactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own interactions" ON public.office_interactions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own interactions" ON public.office_interactions
  FOR DELETE USING (user_id = auth.uid());

-- Office Contacts
CREATE TABLE public.office_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  office_id UUID NOT NULL REFERENCES public.patient_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  birthday DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.office_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts" ON public.office_contacts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own contacts" ON public.office_contacts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own contacts" ON public.office_contacts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own contacts" ON public.office_contacts
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_office_contacts_updated_at
  BEFORE UPDATE ON public.office_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- PHASE 4: User profiles update for onboarding
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- PHASE 5: Campaign ROI tracking
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS roi_tracking JSONB DEFAULT '{}';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS actual_referrals INTEGER DEFAULT 0;