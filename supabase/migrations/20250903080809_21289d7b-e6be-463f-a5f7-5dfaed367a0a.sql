-- Add PIN code encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to encrypt PIN code
CREATE OR REPLACE FUNCTION public.encrypt_pin_code(pin_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF pin_text IS NULL OR pin_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN crypt(pin_text, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to verify PIN code
CREATE OR REPLACE FUNCTION public.verify_pin_code(pin_text TEXT, encrypted_pin TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF pin_text IS NULL OR encrypted_pin IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN (crypt(pin_text, encrypted_pin) = encrypted_pin);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to update user PIN code securely
CREATE OR REPLACE FUNCTION public.update_user_pin_code(new_pin TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_pin TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Validate PIN format (4-6 digits)
  IF new_pin IS NOT NULL AND (new_pin !~ '^[0-9]{4,6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be 4-6 digits');
  END IF;
  
  -- Encrypt the PIN
  IF new_pin IS NOT NULL THEN
    v_encrypted_pin := encrypt_pin_code(new_pin);
  ELSE
    v_encrypted_pin := NULL;
  END IF;
  
  -- Update the user's PIN
  UPDATE public.user_profiles 
  SET pin_code = v_encrypted_pin, updated_at = NOW()
  WHERE user_id = v_user_id;
  
  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to verify user PIN code
CREATE OR REPLACE FUNCTION public.verify_user_pin_code(input_pin TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_stored_pin TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get the stored encrypted PIN
  SELECT pin_code INTO v_stored_pin
  FROM public.user_profiles 
  WHERE user_id = v_user_id;
  
  -- If no PIN is set
  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No PIN set for this user');
  END IF;
  
  -- Verify the PIN
  IF verify_pin_code(input_pin, v_stored_pin) THEN
    RETURN json_build_object('success', true, 'verified', true);
  ELSE
    RETURN json_build_object('success', true, 'verified', false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;