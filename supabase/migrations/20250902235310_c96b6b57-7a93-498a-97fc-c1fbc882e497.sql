-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('Intro Package', 'Mug Drop', 'Lunch Drop', 'CE Invite Pack', 'Monthly Promo Pack', 'Holiday Card Drop', 'Educational Material Drop')),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('In-Person', 'USPS', 'Courier')),
  assigned_rep_id UUID REFERENCES auth.users(id),
  materials_checklist TEXT[], -- Array of materials/items
  planned_delivery_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Scheduled', 'In Progress', 'Completed')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  clinic_id UUID REFERENCES public.clinics(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign_deliveries table to track individual office deliveries
CREATE TABLE public.campaign_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.patient_sources(id),
  delivery_status TEXT NOT NULL DEFAULT 'Not Started' CHECK (delivery_status IN ('Not Started', 'Delivered', 'Failed')),
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_notes TEXT,
  photo_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, office_id)
);

-- Enable Row Level Security
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_deliveries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for campaigns
CREATE POLICY "Users can view their own campaigns" 
ON public.campaigns 
FOR SELECT 
USING (created_by = auth.uid());

CREATE POLICY "Users can create their own campaigns" 
ON public.campaigns 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own campaigns" 
ON public.campaigns 
FOR UPDATE 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own campaigns" 
ON public.campaigns 
FOR DELETE 
USING (created_by = auth.uid());

-- Create RLS policies for campaign deliveries
CREATE POLICY "Users can view their own campaign deliveries" 
ON public.campaign_deliveries 
FOR SELECT 
USING (created_by = auth.uid());

CREATE POLICY "Users can create their own campaign deliveries" 
ON public.campaign_deliveries 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own campaign deliveries" 
ON public.campaign_deliveries 
FOR UPDATE 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own campaign deliveries" 
ON public.campaign_deliveries 
FOR DELETE 
USING (created_by = auth.uid());

-- Create trigger to update updated_at column
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_deliveries_updated_at
BEFORE UPDATE ON public.campaign_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();