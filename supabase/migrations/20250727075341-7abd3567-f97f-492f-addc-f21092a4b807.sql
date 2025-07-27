-- Create referring offices table
CREATE TABLE public.referring_offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  google_rating DECIMAL(2,1),
  yelp_rating DECIMAL(2,1),
  office_hours TEXT,
  distance_from_clinic DECIMAL(5,2),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  source TEXT DEFAULT 'Manual' CHECK (source IN ('Manual', 'Google', 'Yelp')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tags table for flexible tagging
CREATE TABLE public.office_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.referring_offices(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referral data table
CREATE TABLE public.referral_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.referring_offices(id) ON DELETE CASCADE,
  month_year DATE NOT NULL, -- First day of the month for the data
  referral_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(office_id, month_year)
);

-- Create engagement logs table
CREATE TABLE public.engagement_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.referring_offices(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('Call', 'Email', 'In-person visit', 'Promo/gift drop', 'CE invite')),
  notes TEXT,
  interaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by TEXT, -- Will store user email or name
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user roles table
CREATE TYPE public.user_role AS ENUM ('Owner', 'Front Desk', 'Marketing Rep');

CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'Front Desk',
  pin_code TEXT, -- For quick login for Front Desk and Marketing Rep
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.referring_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a single-tenant application)
-- All authenticated users can access all data
CREATE POLICY "Authenticated users can view all referring offices"
  ON public.referring_offices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert referring offices"
  ON public.referring_offices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update referring offices"
  ON public.referring_offices FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete referring offices"
  ON public.referring_offices FOR DELETE
  TO authenticated
  USING (true);

-- Office tags policies
CREATE POLICY "Authenticated users can view all office tags"
  ON public.office_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert office tags"
  ON public.office_tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update office tags"
  ON public.office_tags FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete office tags"
  ON public.office_tags FOR DELETE
  TO authenticated
  USING (true);

-- Referral data policies
CREATE POLICY "Authenticated users can view all referral data"
  ON public.referral_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert referral data"
  ON public.referral_data FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update referral data"
  ON public.referral_data FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete referral data"
  ON public.referral_data FOR DELETE
  TO authenticated
  USING (true);

-- Engagement logs policies
CREATE POLICY "Authenticated users can view all engagement logs"
  ON public.engagement_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert engagement logs"
  ON public.engagement_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update engagement logs"
  ON public.engagement_logs FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete engagement logs"
  ON public.engagement_logs FOR DELETE
  TO authenticated
  USING (true);

-- User profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_referring_offices_updated_at
  BEFORE UPDATE ON public.referring_offices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_data_updated_at
  BEFORE UPDATE ON public.referral_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate office scores
CREATE OR REPLACE FUNCTION public.calculate_office_score(office_id_param UUID)
RETURNS TEXT AS $$
DECLARE
  recent_referrals INTEGER;
  last_referral_date DATE;
  days_since_referral INTEGER;
  total_referrals INTEGER;
BEGIN
  -- Get referral count for past 3 months
  SELECT COALESCE(SUM(referral_count), 0)
  INTO recent_referrals
  FROM public.referral_data
  WHERE office_id = office_id_param
    AND month_year >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months');

  -- Get total referrals
  SELECT COALESCE(SUM(referral_count), 0)
  INTO total_referrals
  FROM public.referral_data
  WHERE office_id = office_id_param;

  -- Get last referral date (approximation based on latest month with referrals)
  SELECT MAX(month_year)
  INTO last_referral_date
  FROM public.referral_data
  WHERE office_id = office_id_param AND referral_count > 0;

  -- Calculate days since last referral
  IF last_referral_date IS NOT NULL THEN
    days_since_referral := CURRENT_DATE - last_referral_date;
  ELSE
    days_since_referral := 9999; -- Very high number for no referrals
  END IF;

  -- Determine score based on criteria
  IF recent_referrals >= 5 AND days_since_referral <= 60 THEN
    RETURN 'Strong';
  ELSIF recent_referrals >= 2 AND days_since_referral <= 90 THEN
    RETURN 'Moderate';
  ELSIF total_referrals > 0 AND days_since_referral <= 180 THEN
    RETURN 'Sporadic';
  ELSE
    RETURN 'Cold';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX idx_referring_offices_name ON public.referring_offices(name);
CREATE INDEX idx_office_tags_office_id ON public.office_tags(office_id);
CREATE INDEX idx_office_tags_tag ON public.office_tags(tag);
CREATE INDEX idx_referral_data_office_id ON public.referral_data(office_id);
CREATE INDEX idx_referral_data_month_year ON public.referral_data(month_year);
CREATE INDEX idx_engagement_logs_office_id ON public.engagement_logs(office_id);
CREATE INDEX idx_engagement_logs_date ON public.engagement_logs(interaction_date);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);