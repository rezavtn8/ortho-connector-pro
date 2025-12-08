-- Create daily_patients table for granular daily tracking
CREATE TABLE public.daily_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES patient_sources(id) ON DELETE CASCADE,
  patient_date DATE NOT NULL,
  patient_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  user_id UUID NOT NULL,
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, patient_date, user_id)
);

-- Enable RLS
ALTER TABLE public.daily_patients ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_patients
CREATE POLICY "Users can view their own daily patients"
ON public.daily_patients FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own daily patients"
ON public.daily_patients FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own daily patients"
ON public.daily_patients FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own daily patients"
ON public.daily_patients FOR DELETE
USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_daily_patients_updated_at
BEFORE UPDATE ON public.daily_patients
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Function to add/update daily patient entry
CREATE OR REPLACE FUNCTION public.add_daily_patients(
  p_source_id UUID,
  p_date DATE,
  p_count INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry_id UUID;
  v_year_month VARCHAR;
  v_monthly_total INTEGER;
BEGIN
  -- Insert or update daily entry
  INSERT INTO public.daily_patients (source_id, patient_date, patient_count, notes, user_id)
  VALUES (p_source_id, p_date, p_count, p_notes, auth.uid())
  ON CONFLICT (source_id, patient_date, user_id)
  DO UPDATE SET
    patient_count = EXCLUDED.patient_count,
    notes = COALESCE(EXCLUDED.notes, daily_patients.notes),
    updated_at = now()
  RETURNING id INTO v_entry_id;
  
  -- Calculate year_month for the date
  v_year_month := TO_CHAR(p_date, 'YYYY-MM');
  
  -- Sync to monthly_patients
  SELECT COALESCE(SUM(patient_count), 0) INTO v_monthly_total
  FROM public.daily_patients
  WHERE source_id = p_source_id
    AND TO_CHAR(patient_date, 'YYYY-MM') = v_year_month
    AND user_id = auth.uid();
  
  -- Update monthly_patients
  INSERT INTO public.monthly_patients (source_id, year_month, patient_count, user_id)
  VALUES (p_source_id, v_year_month, v_monthly_total, auth.uid())
  ON CONFLICT (source_id, year_month)
  DO UPDATE SET
    patient_count = v_monthly_total,
    updated_at = now()
  WHERE monthly_patients.user_id = auth.uid();
  
  RETURN json_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'date', p_date,
    'count', p_count,
    'monthly_total', v_monthly_total
  );
END;
$$;

-- Function to get daily patients for a month
CREATE OR REPLACE FUNCTION public.get_daily_patients_for_month(
  p_year_month VARCHAR
)
RETURNS TABLE (
  id UUID,
  source_id UUID,
  source_name TEXT,
  source_type TEXT,
  patient_date DATE,
  patient_count INTEGER,
  notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dp.id,
    dp.source_id,
    ps.name::TEXT as source_name,
    ps.source_type::TEXT,
    dp.patient_date,
    dp.patient_count,
    dp.notes
  FROM public.daily_patients dp
  JOIN public.patient_sources ps ON dp.source_id = ps.id
  WHERE TO_CHAR(dp.patient_date, 'YYYY-MM') = p_year_month
    AND dp.user_id = auth.uid()
  ORDER BY dp.patient_date DESC, ps.name;
END;
$$;

-- Function to delete a daily patient entry and sync monthly
CREATE OR REPLACE FUNCTION public.delete_daily_patients(
  p_entry_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_id UUID;
  v_patient_date DATE;
  v_year_month VARCHAR;
  v_monthly_total INTEGER;
BEGIN
  -- Get the entry details before deletion
  SELECT source_id, patient_date INTO v_source_id, v_patient_date
  FROM public.daily_patients
  WHERE id = p_entry_id AND user_id = auth.uid();
  
  IF v_source_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Entry not found');
  END IF;
  
  -- Delete the entry
  DELETE FROM public.daily_patients WHERE id = p_entry_id AND user_id = auth.uid();
  
  -- Recalculate monthly total
  v_year_month := TO_CHAR(v_patient_date, 'YYYY-MM');
  
  SELECT COALESCE(SUM(patient_count), 0) INTO v_monthly_total
  FROM public.daily_patients
  WHERE source_id = v_source_id
    AND TO_CHAR(patient_date, 'YYYY-MM') = v_year_month
    AND user_id = auth.uid();
  
  -- Update monthly_patients
  UPDATE public.monthly_patients
  SET patient_count = v_monthly_total, updated_at = now()
  WHERE source_id = v_source_id
    AND year_month = v_year_month
    AND user_id = auth.uid();
  
  RETURN json_build_object(
    'success', true,
    'deleted_id', p_entry_id,
    'monthly_total', v_monthly_total
  );
END;
$$;