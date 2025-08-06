-- Add clinic location settings to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN clinic_name text,
ADD COLUMN clinic_address text,
ADD COLUMN clinic_latitude numeric,
ADD COLUMN clinic_longitude numeric;