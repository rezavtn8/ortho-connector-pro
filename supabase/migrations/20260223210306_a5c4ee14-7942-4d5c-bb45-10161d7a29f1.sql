ALTER TABLE public.user_profiles
ADD COLUMN email_preferences jsonb NOT NULL DEFAULT '{"biweekly_digest": true, "weekly_reports": true, "monthly_reports": true, "referral_alerts": true}'::jsonb;