-- Create function to log application errors
CREATE OR REPLACE FUNCTION public.log_application_error(
  p_error_message TEXT,
  p_error_stack TEXT DEFAULT NULL,
  p_component_stack TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'error',
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  error_id uuid;
BEGIN
  INSERT INTO public.error_logs (
    error_message,
    error_stack,
    component_stack,
    url,
    user_agent,
    severity,
    user_id,
    metadata
  ) VALUES (
    p_error_message,
    p_error_stack,
    p_component_stack,
    p_url,
    p_user_agent,
    p_severity,
    auth.uid(),
    p_metadata
  ) RETURNING id INTO error_id;
  
  RETURN error_id;
END;
$$;