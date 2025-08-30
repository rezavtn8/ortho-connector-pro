-- Drop existing policies and recreate user invitations policies
DROP POLICY IF EXISTS "Clinic admins can view invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Clinic admins can create invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Clinic admins can update invitations" ON public.user_invitations;

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