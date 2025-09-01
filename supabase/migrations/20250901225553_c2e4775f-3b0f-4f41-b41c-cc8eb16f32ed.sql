-- Step 1: Make clinic_id nullable in user_profiles to break circular dependency
ALTER TABLE public.user_profiles ALTER COLUMN clinic_id DROP NOT NULL;

-- Step 2: Update the handle_new_user trigger to set clinic_id as NULL initially
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, role, clinic_id)
  VALUES (NEW.id, NEW.email, 'Front Desk', NULL);
  RETURN NEW;
END;
$$;

-- Step 3: Update get_user_clinic_id function to handle NULL clinic_id gracefully
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM public.user_profiles WHERE user_id = auth.uid();
$$;

-- Step 4: Update clinics RLS policies to handle cases where user has no clinic yet
DROP POLICY IF EXISTS "Users can view their clinic" ON public.clinics;
DROP POLICY IF EXISTS "Owners can update their clinic" ON public.clinics;
DROP POLICY IF EXISTS "Authenticated users can create clinics" ON public.clinics;

-- Allow users to view their clinic (if they have one)
CREATE POLICY "Users can view their clinic" 
ON public.clinics 
FOR SELECT 
USING (id = get_user_clinic_id());

-- Allow users to create clinics (when they don't have one yet)
CREATE POLICY "Authenticated users can create clinics" 
ON public.clinics 
FOR INSERT 
WITH CHECK (owner_id = auth.uid());

-- Allow clinic owners to update their clinic
CREATE POLICY "Owners can update their clinic" 
ON public.clinics 
FOR UPDATE 
USING (owner_id = auth.uid());