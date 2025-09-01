-- Create a secure function for clinic creation that bypasses RLS issues
CREATE OR REPLACE FUNCTION public.create_clinic_for_user(
  p_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();
  
  -- Validate user is authenticated
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if user already has a clinic
  IF EXISTS (SELECT 1 FROM public.clinics WHERE owner_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User already owns a clinic');
  END IF;
  
  -- Create the clinic
  INSERT INTO public.clinics (name, address, latitude, longitude, owner_id)
  VALUES (p_name, p_address, p_latitude, p_longitude, v_user_id)
  RETURNING id INTO v_clinic_id;
  
  -- Update user profile with clinic_id
  UPDATE public.user_profiles 
  SET clinic_id = v_clinic_id, 
      clinic_name = p_name,
      clinic_address = p_address,
      clinic_latitude = p_latitude,
      clinic_longitude = p_longitude,
      updated_at = NOW()
  WHERE user_id = v_user_id;
  
  RETURN json_build_object(
    'success', true, 
    'clinic_id', v_clinic_id,
    'message', 'Clinic created successfully'
  );
END;
$$;

-- Create helper function to validate auth context
CREATE OR REPLACE FUNCTION public.validate_auth_context() 
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  RETURN json_build_object(
    'authenticated', v_user_id IS NOT NULL,
    'user_id', v_user_id,
    'timestamp', NOW()
  );
END;
$$;