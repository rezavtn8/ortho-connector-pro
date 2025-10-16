-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Update the handle_new_user function to also send welcome email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_response extensions.http_response;
BEGIN
  -- Insert user profile as before
  INSERT INTO public.user_profiles (
    user_id, 
    email, 
    first_name, 
    last_name, 
    phone,
    job_title,
    degrees,
    role, 
    clinic_id
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'job_title',
    NEW.raw_user_meta_data ->> 'degrees',
    'Front Desk', 
    NULL
  );
  
  -- Send welcome email via edge function (non-blocking)
  PERFORM extensions.http((
    'POST',
    'https://vqkzqwibbcvmdwgqladn.supabase.co/functions/v1/send-welcome-email',
    ARRAY[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxa3pxd2liYmN2bWR3Z3FsYWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDAyMDQsImV4cCI6MjA2OTE3NjIwNH0.S6qvIFA1itxemVUTzfz4dDr2J9jz2z69NEv-fgb4gK4')
    ],
    'application/json',
    json_build_object(
      'record', json_build_object(
        'email', NEW.email,
        'raw_user_meta_data', NEW.raw_user_meta_data
      )
    )::text
  )::extensions.http_request);
  
  RETURN NEW;
END;
$$;