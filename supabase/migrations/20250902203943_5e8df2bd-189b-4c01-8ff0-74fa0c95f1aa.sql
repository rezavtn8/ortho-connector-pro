-- Create discovered_offices table
CREATE TABLE public.discovered_offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  rating NUMERIC,
  lat NUMERIC,
  lng NUMERIC,
  discovered_by UUID NOT NULL,
  clinic_id UUID,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'google',
  imported BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discovered_offices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their discovered offices" 
ON public.discovered_offices 
FOR SELECT 
USING (discovered_by = auth.uid());

CREATE POLICY "Users can insert their discovered offices" 
ON public.discovered_offices 
FOR INSERT 
WITH CHECK (discovered_by = auth.uid());

CREATE POLICY "Users can update their discovered offices" 
ON public.discovered_offices 
FOR UPDATE 
USING (discovered_by = auth.uid())
WITH CHECK (discovered_by = auth.uid());

CREATE POLICY "Users can delete their discovered offices" 
ON public.discovered_offices 
FOR DELETE 
USING (discovered_by = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_discovered_offices_clinic_id ON public.discovered_offices(clinic_id);
CREATE INDEX idx_discovered_offices_fetched_at ON public.discovered_offices(clinic_id, fetched_at);
CREATE INDEX idx_discovered_offices_place_id ON public.discovered_offices(place_id);

-- Add trigger for updated_at
CREATE TRIGGER update_discovered_offices_updated_at
BEFORE UPDATE ON public.discovered_offices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();