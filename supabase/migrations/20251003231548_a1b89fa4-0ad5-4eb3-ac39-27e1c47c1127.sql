-- Create subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text UNIQUE NOT NULL,
  name text NOT NULL,
  price_monthly numeric NOT NULL,
  stripe_price_id text,
  features jsonb DEFAULT '[]'::jsonb,
  max_offices integer,
  max_users integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_id text NOT NULL REFERENCES public.subscription_plans(plan_id),
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view subscription plans"
ON public.subscription_plans
FOR SELECT
USING (true);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscription"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
ON public.subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
ON public.subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- Seed placeholder plans
INSERT INTO public.subscription_plans (plan_id, name, price_monthly, features, max_offices, max_users, stripe_price_id)
VALUES 
  ('solo', 'Solo Practice', 49, '["Up to 50 referral sources", "Marketing visit tracking", "Patient tracking", "Basic analytics", "Email support"]'::jsonb, 50, 1, 'price_test_solo'),
  ('group', 'Group Practice', 99, '["Up to 200 referral sources", "Everything in Solo", "Campaign management", "Advanced analytics", "Priority support", "Team collaboration"]'::jsonb, 200, 5, 'price_test_group'),
  ('multi', 'Multi-Location', 199, '["Unlimited referral sources", "Everything in Group", "Multi-location management", "Custom integrations", "Dedicated account manager", "White-label options"]'::jsonb, 9999, 999, 'price_test_multi')
ON CONFLICT (plan_id) DO NOTHING;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER set_updated_at_subscription_plans
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_subscriptions
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();