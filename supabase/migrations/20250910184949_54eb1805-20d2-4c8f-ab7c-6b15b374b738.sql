-- Add new campaign type and fields for unified campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS campaign_mode text DEFAULT 'traditional';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS selected_gift_bundle jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS email_settings jsonb;

-- Add email and gift tracking to campaign_deliveries
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_body text;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_status text DEFAULT 'pending';
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS gift_status text DEFAULT 'pending';
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS action_mode text DEFAULT 'both';
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_copied_at timestamp with time zone;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS email_sent_at timestamp with time zone;
ALTER TABLE public.campaign_deliveries ADD COLUMN IF NOT EXISTS referral_tier text;

-- Create trigger to update updated_at column
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_deliveries_updated_at
  BEFORE UPDATE ON public.campaign_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();