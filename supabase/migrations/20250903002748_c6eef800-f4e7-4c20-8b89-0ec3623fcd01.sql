-- Add new fields to discovered_offices table for Discovery Assistant
ALTER TABLE public.discovered_offices 
ADD COLUMN search_distance integer,
ADD COLUMN search_location_lat numeric,
ADD COLUMN search_location_lng numeric, 
ADD COLUMN office_type text DEFAULT 'Unknown',
ADD COLUMN discovery_session_id uuid;

-- Create discovery_sessions table to track search sessions and rate limiting
CREATE TABLE public.discovery_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  clinic_id uuid,
  search_distance integer NOT NULL,
  search_lat numeric NOT NULL,
  search_lng numeric NOT NULL,
  office_type_filter text,
  zip_code_override text,
  results_count integer DEFAULT 0,
  api_call_made boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on discovery_sessions
ALTER TABLE public.discovery_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for discovery_sessions
CREATE POLICY "Users can view their own discovery sessions" 
ON public.discovery_sessions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own discovery sessions" 
ON public.discovery_sessions 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own discovery sessions" 
ON public.discovery_sessions 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own discovery sessions" 
ON public.discovery_sessions 
FOR DELETE 
USING (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_discovery_sessions_user_clinic_date ON public.discovery_sessions(user_id, clinic_id, created_at);
CREATE INDEX idx_discovered_offices_session ON public.discovered_offices(discovery_session_id);

-- Create trigger for updated_at on discovery_sessions
CREATE TRIGGER update_discovery_sessions_updated_at
BEFORE UPDATE ON public.discovery_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();