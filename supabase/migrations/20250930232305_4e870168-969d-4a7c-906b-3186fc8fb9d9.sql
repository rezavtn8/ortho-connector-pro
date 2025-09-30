-- Update campaigns table constraints to support new AI-powered campaign types

-- Drop old constraints
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_delivery_method_check;

-- Add new constraints with expanded options
ALTER TABLE campaigns ADD CONSTRAINT campaigns_campaign_type_check 
CHECK (campaign_type IN (
  'Intro Package',
  'Mug Drop',
  'Lunch Drop',
  'CE Invite Pack',
  'Monthly Promo Pack',
  'Holiday Card Drop',
  'Educational Material Drop',
  'referral_outreach',
  'new_office',
  're_engagement',
  'important_date'
));

ALTER TABLE campaigns ADD CONSTRAINT campaigns_delivery_method_check 
CHECK (delivery_method IN (
  'In-Person',
  'USPS',
  'Courier',
  'email',
  'physical'
));