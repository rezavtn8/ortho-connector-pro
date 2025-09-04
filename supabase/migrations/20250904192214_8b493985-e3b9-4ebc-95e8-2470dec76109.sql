-- Add unique constraint on google_place_id to prevent duplicates
ALTER TABLE public.patient_sources 
ADD CONSTRAINT unique_google_place_id 
UNIQUE (google_place_id) 
WHERE google_place_id IS NOT NULL;

-- Create audit log table for Google Places updates
CREATE TABLE public.google_places_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  office_id UUID NOT NULL,
  google_place_id TEXT,
  action TEXT NOT NULL, -- 'confirmed', 'updated', 'conflict_detected'
  field_updates JSONB, -- stores what fields were updated
  old_values JSONB, -- stores old field values
  new_values JSONB, -- stores new field values
  conflict_details JSONB, -- stores conflict information if applicable
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log table
ALTER TABLE public.google_places_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies for audit log
CREATE POLICY "Users can view their own audit logs" 
ON public.google_places_audit_log 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own audit logs" 
ON public.google_places_audit_log 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Add index for better performance
CREATE INDEX idx_google_places_audit_log_office_id ON public.google_places_audit_log(office_id);
CREATE INDEX idx_google_places_audit_log_user_id ON public.google_places_audit_log(user_id);
CREATE INDEX idx_google_places_audit_log_created_at ON public.google_places_audit_log(created_at);

-- Function to log Google Places updates
CREATE OR REPLACE FUNCTION public.log_google_places_update(
  p_office_id UUID,
  p_google_place_id TEXT,
  p_action TEXT,
  p_field_updates JSONB DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_conflict_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.google_places_audit_log (
    user_id,
    office_id,
    google_place_id,
    action,
    field_updates,
    old_values,
    new_values,
    conflict_details
  )
  VALUES (
    auth.uid(),
    p_office_id,
    p_google_place_id,
    p_action,
    p_field_updates,
    p_old_values,
    p_new_values,
    p_conflict_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;