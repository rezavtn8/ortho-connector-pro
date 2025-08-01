-- Create incentive tracking table
CREATE TABLE public.marketing_incentives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL,
  incentive_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  personalized_message TEXT,
  assigned_staff TEXT,
  status TEXT NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned', 'Sent', 'Delivered', 'Cancelled')),
  delivery_method TEXT CHECK (delivery_method IN ('In-person', 'Mail', 'Email', 'Other')),
  scheduled_date DATE,
  actual_sent_date DATE,
  cost_amount DECIMAL(10, 2),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.marketing_incentives ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view all marketing incentives" 
ON public.marketing_incentives 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert marketing incentives" 
ON public.marketing_incentives 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update marketing incentives" 
ON public.marketing_incentives 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete marketing incentives" 
ON public.marketing_incentives 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_marketing_incentives_updated_at
BEFORE UPDATE ON public.marketing_incentives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_marketing_incentives_office_id ON public.marketing_incentives(office_id);
CREATE INDEX idx_marketing_incentives_status ON public.marketing_incentives(status);
CREATE INDEX idx_marketing_incentives_scheduled_date ON public.marketing_incentives(scheduled_date);
CREATE INDEX idx_marketing_incentives_created_at ON public.marketing_incentives(created_at);