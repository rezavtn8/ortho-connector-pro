-- Create marketing_visits table for tracking office visits
CREATE TABLE public.marketing_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visit_time TIME,
  visit_group TEXT,
  visited BOOLEAN DEFAULT FALSE,
  visited_by TEXT,
  approach_used TEXT[],
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_visits ENABLE ROW LEVEL SECURITY;

-- Create policies for marketing_visits
CREATE POLICY "Authenticated users can view all marketing visits" 
ON public.marketing_visits 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert marketing visits" 
ON public.marketing_visits 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update marketing visits" 
ON public.marketing_visits 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete marketing visits" 
ON public.marketing_visits 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_marketing_visits_updated_at
BEFORE UPDATE ON public.marketing_visits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();