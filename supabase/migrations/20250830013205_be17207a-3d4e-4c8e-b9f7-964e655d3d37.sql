-- Create security functions first
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT clinic_id FROM public.user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL  
SECURITY DEFINER
STABLE
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_has_clinic_admin_access()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE  
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.clinics c ON up.clinic_id = c.id
    WHERE up.user_id = auth.uid() 
    AND (up.role = 'Owner' OR c.owner_id = up.user_id)
  );
$$;

-- Clinics policies
CREATE POLICY "Users can view their clinic" ON public.clinics
FOR SELECT USING (id = public.get_user_clinic_id());

CREATE POLICY "Owners can update their clinic" ON public.clinics  
FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create clinics" ON public.clinics
FOR INSERT WITH CHECK (owner_id = auth.uid());