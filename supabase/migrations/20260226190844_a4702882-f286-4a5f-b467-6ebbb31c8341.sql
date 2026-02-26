
ALTER TABLE campaigns DROP CONSTRAINT campaigns_delivery_method_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_delivery_method_check 
  CHECK (delivery_method = ANY (ARRAY['In-Person','USPS','Courier','email','physical','letter']));

ALTER TABLE campaigns DROP CONSTRAINT campaigns_campaign_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_campaign_type_check 
  CHECK (campaign_type = ANY (ARRAY[
    'Intro Package','Mug Drop','Lunch Drop','CE Invite Pack','Monthly Promo Pack',
    'Holiday Card Drop','Educational Material Drop','referral_outreach','new_office',
    're_engagement','important_date','referral_appreciation','holiday_seasonal'
  ]));
