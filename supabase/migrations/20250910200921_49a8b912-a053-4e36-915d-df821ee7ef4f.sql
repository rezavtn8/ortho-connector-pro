-- Add additional personal information fields to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS company_name text;

-- Update the handle_new_user function to include additional profile data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id, 
    email, 
    first_name, 
    last_name, 
    phone,
    job_title,
    company_name,
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
    NEW.raw_user_meta_data ->> 'company_name',
    'Front Desk', 
    NULL
  );
  RETURN NEW;
END;
$$;