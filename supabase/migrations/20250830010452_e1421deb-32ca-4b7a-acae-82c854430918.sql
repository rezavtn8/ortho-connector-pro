-- Create marketing_visits table
CREATE TABLE public.marketing_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL,
  visit_date DATE NOT NULL,
  visit_type TEXT NOT NULL CHECK (visit_type IN ('New Target', 'Routine', 'Reconnect', 'Follow-up')),
  group_tag TEXT,
  contact_person TEXT,
  visited BOOLEAN NOT NULL DEFAULT false,
  rep_name TEXT NOT NULL,
  materials_handed_out TEXT[], -- Array of materials
  star_rating INTEGER CHECK (star_rating >= 1 AND star_rating <= 5),
  follow_up_notes TEXT,
  photo_url TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_visits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own marketing visits"
ON public.marketing_visits
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own marketing visits"
ON public.marketing_visits
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own marketing visits"
ON public.marketing_visits
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own marketing visits"
ON public.marketing_visits
FOR DELETE
USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_marketing_visits_office_id ON public.marketing_visits(office_id);
CREATE INDEX idx_marketing_visits_user_id ON public.marketing_visits(user_id);
CREATE INDEX idx_marketing_visits_visit_date ON public.marketing_visits(visit_date);
CREATE INDEX idx_marketing_visits_rep_name ON public.marketing_visits(rep_name);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_marketing_visits_updated_at
BEFORE UPDATE ON public.marketing_visits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key reference (optional - helps with data integrity)
ALTER TABLE public.marketing_visits 
ADD CONSTRAINT fk_marketing_visits_office 
FOREIGN KEY (office_id) REFERENCES public.patient_sources(id) ON DELETE CASCADE;