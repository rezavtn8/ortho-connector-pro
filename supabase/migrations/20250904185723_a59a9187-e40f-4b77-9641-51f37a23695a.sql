-- Add name fields to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT,
ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
    THEN first_name || ' ' || last_name
    WHEN first_name IS NOT NULL 
    THEN first_name
    WHEN last_name IS NOT NULL 
    THEN last_name
    ELSE NULL
  END
) STORED;

-- Update the handle_new_user trigger function to handle name fields from signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id, 
    email, 
    first_name, 
    last_name, 
    role, 
    clinic_id
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'Front Desk', 
    NULL
  );
  RETURN NEW;
END;
$$;