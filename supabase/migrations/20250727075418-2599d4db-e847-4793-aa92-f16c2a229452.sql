-- Fix function search_path security warnings by setting secure search_path

-- Update the timestamp function to be secure
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update the office score calculation function to be secure  
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';