
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert user profile
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
  
  -- Send welcome email via edge function (truly async, non-blocking)
  PERFORM net.http_post(
    url := 'https://vqkzqwibbcvmdwgqladn.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxa3pxd2liYmN2bWR3Z3FsYWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDAyMDQsImV4cCI6MjA2OTE3NjIwNH0.S6qvIFA1itxemVUTzfz4dDr2J9jz2z69NEv-fgb4gK4'
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'email', NEW.email,
        'raw_user_meta_data', NEW.raw_user_meta_data
      )
    )
  );
  
  RETURN NEW;
END;
$function$;
