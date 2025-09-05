-- Fix search path security issues for audit functions

-- Fix audit_data_access function
CREATE OR REPLACE FUNCTION public.audit_data_access()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log data modifications on sensitive tables
  IF TG_TABLE_NAME IN ('user_profiles', 'patient_sources', 'discovered_offices', 'user_invitations') THEN
    PERFORM public.log_security_event(
      auth.uid(),
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'old_values', CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        'new_values', CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix validate_user_profile_update function
CREATE OR REPLACE FUNCTION public.validate_user_profile_update()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Prevent users from changing their user_id
  IF OLD.user_id != NEW.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id';
  END IF;
  
  -- Validate email format (basic check)
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Prevent role elevation (if role system is implemented)
  -- Users cannot promote themselves to Owner role
  IF OLD.role != 'Owner' AND NEW.role = 'Owner' THEN
    RAISE EXCEPTION 'Cannot self-promote to Owner role';
  END IF;
  
  RETURN NEW;
END;
$$;