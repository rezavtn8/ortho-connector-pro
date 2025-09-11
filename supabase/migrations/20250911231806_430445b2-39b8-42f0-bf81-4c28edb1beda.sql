-- Create comprehensive activity log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL, -- 'source', 'patient_count', 'tag', 'import', etc.
  resource_id UUID NULL, -- ID of the affected resource
  resource_name TEXT NULL, -- Name/description of the affected resource
  details JSONB NULL, -- Additional context (old/new values, counts, etc.)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own activity log" 
ON public.activity_log 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own activity log" 
ON public.activity_log 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create index for better performance
CREATE INDEX idx_activity_log_user_created ON public.activity_log(user_id, created_at DESC);

-- Create function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_resource_name TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_log (
    user_id,
    action_type,
    resource_type,
    resource_id,
    resource_name,
    details
  )
  VALUES (
    auth.uid(),
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;