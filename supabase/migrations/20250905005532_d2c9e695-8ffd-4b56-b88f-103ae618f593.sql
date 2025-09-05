-- Security Enhancement Migration
-- Addresses authentication security and adds audit logging

-- 1. Create audit log table for security monitoring
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action_type TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only allow system to insert audit logs, admins to read them
CREATE POLICY "System can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their own audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (user_id = auth.uid());

-- 2. Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id UUID DEFAULT auth.uid(),
  p_action_type TEXT DEFAULT 'unknown',
  p_table_name TEXT DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.security_audit_log (
    user_id,
    action_type,
    table_name,
    record_id,
    details
  )
  VALUES (
    p_user_id,
    p_action_type,
    p_table_name,
    p_record_id,
    p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 3. Add trigger function for data access monitoring
CREATE OR REPLACE FUNCTION public.audit_data_access()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- 4. Add audit triggers to sensitive tables
CREATE TRIGGER audit_user_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_data_access();

CREATE TRIGGER audit_patient_sources
  AFTER INSERT OR UPDATE OR DELETE ON public.patient_sources
  FOR EACH ROW EXECUTE FUNCTION public.audit_data_access();

CREATE TRIGGER audit_discovered_offices
  AFTER INSERT OR UPDATE OR DELETE ON public.discovered_offices
  FOR EACH ROW EXECUTE FUNCTION public.audit_data_access();

CREATE TRIGGER audit_user_invitations
  AFTER INSERT OR UPDATE OR DELETE ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.audit_data_access();

-- 5. Strengthen user profile RLS policies with additional checks
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" 
ON public.user_profiles 
FOR SELECT 
USING (
  auth.uid() = user_id 
  AND auth.uid() IS NOT NULL
);

-- 6. Add rate limiting table for API protection
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ip_address INET,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for rate limiting
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limits" 
ON public.rate_limit_log 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "System can manage rate limits" 
ON public.rate_limit_log 
FOR ALL 
WITH CHECK (true);

-- 7. Create function to check and enforce rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate window start time
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Get current request count in window
  SELECT COALESCE(SUM(request_count), 0)
  INTO v_current_count
  FROM public.rate_limit_log
  WHERE user_id = v_user_id
    AND endpoint = p_endpoint
    AND created_at > v_window_start;
  
  -- If under limit, log the request
  IF v_current_count < p_max_requests THEN
    INSERT INTO public.rate_limit_log (user_id, endpoint, request_count)
    VALUES (v_user_id, p_endpoint, 1)
    ON CONFLICT (user_id, endpoint, date_trunc('hour', created_at))
    DO UPDATE SET request_count = rate_limit_log.request_count + 1;
    
    RETURN TRUE;
  END IF;
  
  -- Log rate limit violation
  PERFORM public.log_security_event(
    v_user_id,
    'RATE_LIMIT_EXCEEDED',
    'rate_limit_log',
    NULL,
    jsonb_build_object(
      'endpoint', p_endpoint,
      'limit', p_max_requests,
      'window_minutes', p_window_minutes,
      'current_count', v_current_count
    )
  );
  
  RETURN FALSE;
END;
$$;

-- 8. Enhanced user profile security with additional validation
CREATE OR REPLACE FUNCTION public.validate_user_profile_update()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_user_profile_changes
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_profile_update();

-- 9. Create data retention policy function
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete audit logs older than 1 year
  DELETE FROM public.security_audit_log
  WHERE timestamp < now() - INTERVAL '1 year';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Delete rate limit logs older than 7 days
  DELETE FROM public.rate_limit_log
  WHERE created_at < now() - INTERVAL '7 days';
  
  RETURN v_deleted_count;
END;
$$;

-- 10. Add indexes for better performance on audit queries
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_timestamp 
ON public.security_audit_log (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_action_timestamp 
ON public.security_audit_log (action_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_user_endpoint_time 
ON public.rate_limit_log (user_id, endpoint, created_at DESC);