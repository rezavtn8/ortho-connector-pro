-- Fix create_clinic_for_user function to remove references to deleted columns
CREATE OR REPLACE FUNCTION public.create_clinic_for_user(
  p_name text, 
  p_address text DEFAULT NULL::text, 
  p_latitude numeric DEFAULT NULL::numeric, 
  p_longitude numeric DEFAULT NULL::numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Update user profile with only clinic_id (removed clinic_name, clinic_address, clinic_latitude, clinic_longitude)
  UPDATE public.user_profiles 
  SET clinic_id = v_clinic_id,
      updated_at = NOW()
  WHERE user_id = v_user_id;
  
  RETURN json_build_object(
    'success', true, 
    'clinic_id', v_clinic_id,
    'message', 'Clinic created successfully'
  );
END;
$function$;