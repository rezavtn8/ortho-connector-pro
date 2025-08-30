-- Security functions
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
  SELECT clinic_id FROM public.user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL  
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_has_clinic_admin_access()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.clinics c ON up.clinic_id = c.id
    WHERE up.user_id = auth.uid() 
    AND (up.role = 'Owner' OR c.owner_id = up.user_id)
  );
$$;

-- Accept invitation function
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_invitation RECORD;
    v_user_email TEXT;
BEGIN
    -- Get current user email
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
    
    -- Find valid invitation
    SELECT * INTO v_invitation
    FROM public.user_invitations
    WHERE token = p_token 
    AND email = v_user_email
    AND status = 'pending'
    AND expires_at > now();
    
    IF v_invitation IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
    END IF;
    
    -- Update user profile with clinic and role
    UPDATE public.user_profiles 
    SET clinic_id = v_invitation.clinic_id, role = v_invitation.role
    WHERE user_id = auth.uid();
    
    -- Mark invitation as accepted
    UPDATE public.user_invitations
    SET status = 'accepted'
    WHERE id = v_invitation.id;
    
    RETURN json_build_object('success', true, 'clinic_id', v_invitation.clinic_id);
END;
$$;

-- Clinics policies
CREATE POLICY "Users can view their clinic" ON public.clinics
FOR SELECT USING (id = public.get_user_clinic_id());

CREATE POLICY "Owners can update their clinic" ON public.clinics  
FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create clinics" ON public.clinics
FOR INSERT WITH CHECK (owner_id = auth.uid());

-- User profiles policies (replace existing)
DROP POLICY IF EXISTS "Users can view profiles in their clinic" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Owners can update clinic user profiles" ON public.user_profiles;

CREATE POLICY "Users can view profiles in their clinic" ON public.user_profiles
FOR SELECT USING (clinic_id = public.get_user_clinic_id());

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.user_profiles
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Owners can update clinic user profiles" ON public.user_profiles
FOR UPDATE USING (
  public.user_has_clinic_admin_access() 
  AND clinic_id = public.get_user_clinic_id()
);

-- User invitations policies
CREATE POLICY "Clinic admins can view invitations" ON public.user_invitations
FOR SELECT USING (
  public.user_has_clinic_admin_access() 
  AND clinic_id = public.get_user_clinic_id()
);

CREATE POLICY "Clinic admins can create invitations" ON public.user_invitations
FOR INSERT WITH CHECK (
  public.user_has_clinic_admin_access()
  AND clinic_id = public.get_user_clinic_id()
  AND invited_by = auth.uid()
);

CREATE POLICY "Clinic admins can update invitations" ON public.user_invitations
FOR UPDATE USING (
  public.user_has_clinic_admin_access()
  AND clinic_id = public.get_user_clinic_id()
);