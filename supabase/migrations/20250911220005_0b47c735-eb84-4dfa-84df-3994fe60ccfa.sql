-- Critical Security Fix: Make user_id NOT NULL and add constraints
-- This prevents RLS policy bypasses where user_id could be NULL

-- First, update any existing NULL user_id records (should not exist but safety first)
UPDATE public.user_profiles 
SET user_id = id 
WHERE user_id IS NULL;

-- Make user_id NOT NULL to prevent RLS bypasses
ALTER TABLE public.user_profiles 
ALTER COLUMN user_id SET NOT NULL;

-- Add unique constraint on user_id to prevent duplicate profiles
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);

-- Strengthen RLS policies for user_profiles with additional validation
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

-- Enhanced RLS policies with stronger validation
CREATE POLICY "Users can view their own profile" 
ON public.user_profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "Users can update their own profile" 
ON public.user_profiles 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
) 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
  AND auth.uid() = NEW.user_id  -- Prevent user_id modification
);

CREATE POLICY "Users can insert their own profile" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- Fix missing RLS on dashboard_summary table
ALTER TABLE public.dashboard_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dashboard summary" 
ON public.dashboard_summary 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "Users can insert their own dashboard summary" 
ON public.dashboard_summary 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

CREATE POLICY "Users can update their own dashboard summary" 
ON public.dashboard_summary 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
) 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- Fix missing RLS on office_metrics table
ALTER TABLE public.office_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own office metrics" 
ON public.office_metrics 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = created_by
);

CREATE POLICY "Users can insert their own office metrics" 
ON public.office_metrics 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = created_by
);

CREATE POLICY "Users can update their own office metrics" 
ON public.office_metrics 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = created_by
) 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = created_by
);

CREATE POLICY "Users can delete their own office metrics" 
ON public.office_metrics 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = created_by
);

-- Add enhanced security validation trigger for user_profiles
CREATE OR REPLACE FUNCTION public.validate_user_profile_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent NULL user_id (additional safety check)
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL for security reasons';
  END IF;
  
  -- Prevent users from changing their user_id
  IF TG_OP = 'UPDATE' AND OLD.user_id != NEW.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id for security reasons';
  END IF;
  
  -- Validate email format (enhanced security)
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Sanitize phone numbers (remove potential injection)
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '[^0-9+\-\(\)\s]', '', 'g');
  END IF;
  
  -- Log sensitive profile changes for audit
  IF TG_OP = 'UPDATE' AND (
    OLD.email != NEW.email OR 
    OLD.phone != NEW.phone OR 
    OLD.role != NEW.role
  ) THEN
    PERFORM public.log_security_event(
      NEW.user_id,
      'PROFILE_SENSITIVE_UPDATE',
      'user_profiles',
      NEW.id,
      jsonb_build_object(
        'changed_fields', jsonb_build_object(
          'email', CASE WHEN OLD.email != NEW.email THEN 'changed' ELSE 'unchanged' END,
          'phone', CASE WHEN OLD.phone != NEW.phone THEN 'changed' ELSE 'unchanged' END,
          'role', CASE WHEN OLD.role != NEW.role THEN 'changed' ELSE 'unchanged' END
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply the security validation trigger
DROP TRIGGER IF EXISTS validate_user_profile_security ON public.user_profiles;
CREATE TRIGGER validate_user_profile_security
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_profile_security();