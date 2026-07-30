-- Fast lookups for login throttling
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_endpoint_created
  ON public.rate_limit_log (endpoint, created_at DESC);

-- Server-side login throttle, keyed on a hashed email identifier.
-- Called only by the auth-rate-limit edge function using the service role.
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_key text,
  p_record_failure boolean DEFAULT false,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_endpoint text := 'login:' || p_key;
  v_window_start timestamptz := now() - (p_window_minutes || ' minutes')::interval;
  v_count integer;
  v_oldest timestamptz;
  v_allowed boolean;
  v_retry_after integer := 0;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 THEN
    RETURN json_build_object('allowed', false, 'error', 'missing key');
  END IF;

  SELECT COALESCE(SUM(request_count), 0), MIN(created_at)
    INTO v_count, v_oldest
  FROM public.rate_limit_log
  WHERE endpoint = v_endpoint
    AND created_at > v_window_start;

  v_allowed := v_count < p_max_attempts;

  -- Record the failed attempt even when already blocked, so hammering extends nothing
  -- but is still observable in the log.
  IF p_record_failure THEN
    INSERT INTO public.rate_limit_log (user_id, endpoint, request_count, window_start)
    VALUES (NULL, v_endpoint, 1, now());
    v_count := v_count + 1;
    IF v_oldest IS NULL THEN
      v_oldest := now();
    END IF;
    v_allowed := v_count < p_max_attempts;
  END IF;

  IF NOT v_allowed AND v_oldest IS NOT NULL THEN
    v_retry_after := GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM (v_oldest + (p_window_minutes || ' minutes')::interval - now())))::integer
    );
  END IF;

  RETURN json_build_object(
    'allowed', v_allowed,
    'attempts', v_count,
    'max_attempts', p_max_attempts,
    'remaining', GREATEST(0, p_max_attempts - v_count),
    'retry_after_seconds', v_retry_after
  );
END;
$$;

-- Clears the counter for an identifier after a successful login.
CREATE OR REPLACE FUNCTION public.reset_login_rate_limit(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limit_log WHERE endpoint = 'login:' || p_key;
END;
$$;

-- Backend-only: never callable from the browser.
REVOKE ALL ON FUNCTION public.check_login_rate_limit(text, boolean, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_login_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(text, boolean, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_login_rate_limit(text) TO service_role;