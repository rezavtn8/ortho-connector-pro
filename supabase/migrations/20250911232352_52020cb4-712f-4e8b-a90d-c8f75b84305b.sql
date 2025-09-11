-- Update patient count functions to also log to activity_log
CREATE OR REPLACE FUNCTION public.adjust_patient_count(p_source_id uuid, p_year_month character varying, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_old_count INTEGER;
    v_new_count INTEGER;
    v_source_name TEXT;
BEGIN
    -- Get current count and source name
    SELECT patient_count INTO v_old_count
    FROM public.monthly_patients
    WHERE source_id = p_source_id AND year_month = p_year_month AND user_id = auth.uid();
    
    IF v_old_count IS NULL THEN
        v_old_count := 0;
    END IF;
    
    -- Get source name
    SELECT name INTO v_source_name
    FROM public.patient_sources
    WHERE id = p_source_id AND created_by = auth.uid();
    
    -- Calculate new count
    v_new_count := GREATEST(0, v_old_count + p_delta);
    
    -- Upsert monthly patients
    INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id)
    VALUES (p_source_id, p_year_month, v_new_count, auth.uid())
    ON CONFLICT (source_id, year_month)
    DO UPDATE SET 
        patient_count = v_new_count,
        updated_at = NOW()
    WHERE public.monthly_patients.user_id = auth.uid();
    
    -- Log change in patient_changes_log
    INSERT INTO public.patient_changes_log (
        source_id, year_month, old_count, new_count, change_type, user_id
    ) VALUES (
        p_source_id, p_year_month, v_old_count, v_new_count,
        CASE WHEN p_delta > 0 THEN 'increment' ELSE 'decrement' END,
        auth.uid()
    );
    
    -- Log in activity_log
    PERFORM public.log_activity(
        CASE WHEN p_delta > 0 THEN 'patient_count_increased' ELSE 'patient_count_decreased' END,
        'patient_count',
        p_source_id,
        v_source_name,
        jsonb_build_object(
            'old_count', v_old_count,
            'new_count', v_new_count,
            'change', p_delta,
            'year_month', p_year_month
        )
    );
    
    RETURN v_new_count;
END;
$$;

-- Update set_patient_count function
CREATE OR REPLACE FUNCTION public.set_patient_count(p_source_id uuid, p_year_month character varying, p_count integer, p_reason text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_old_count INTEGER;
    v_source_name TEXT;
BEGIN
    -- Get current count and source name
    SELECT patient_count INTO v_old_count
    FROM public.monthly_patients
    WHERE source_id = p_source_id AND year_month = p_year_month AND user_id = auth.uid();
    
    IF v_old_count IS NULL THEN
        v_old_count := 0;
    END IF;
    
    -- Get source name
    SELECT name INTO v_source_name
    FROM public.patient_sources
    WHERE id = p_source_id AND created_by = auth.uid();
    
    -- Set new count
    INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id)
    VALUES (p_source_id, p_year_month, p_count, auth.uid())
    ON CONFLICT (source_id, year_month)
    DO UPDATE SET 
        patient_count = p_count,
        updated_at = NOW()
    WHERE public.monthly_patients.user_id = auth.uid();
    
    -- Log change in patient_changes_log
    INSERT INTO public.patient_changes_log (
        source_id, year_month, old_count, new_count, change_type, reason, user_id
    ) VALUES (
        p_source_id, p_year_month, v_old_count, p_count, 'manual_edit', p_reason, auth.uid()
    );
    
    -- Log in activity_log
    PERFORM public.log_activity(
        'patient_count_updated',
        'patient_count',
        p_source_id,
        v_source_name,
        jsonb_build_object(
            'old_count', v_old_count,
            'new_count', p_count,
            'change', p_count - v_old_count,
            'year_month', p_year_month,
            'reason', p_reason
        )
    );
    
    RETURN p_count;
END;
$$;