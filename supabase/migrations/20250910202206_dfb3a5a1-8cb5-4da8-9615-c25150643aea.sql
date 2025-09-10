-- Remove clinic-related columns from user_profiles table
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS company_name;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS clinic_name;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS clinic_address;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS clinic_latitude;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS clinic_longitude;

-- Update the handle_new_user function to not include company_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id, 
    email, 
    first_name, 
    last_name, 
    phone,
    job_title,
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
    'Front Desk', 
    NULL
  );
  RETURN NEW;
END;
$$;