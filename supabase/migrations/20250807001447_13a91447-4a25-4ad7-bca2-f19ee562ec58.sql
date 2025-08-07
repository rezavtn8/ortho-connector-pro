-- Add patient_load column to referring_offices table if it doesn't exist
ALTER TABLE public.referring_offices 
ADD COLUMN IF NOT EXISTS patient_load integer DEFAULT 0;

-- Create patient_load_history table for temporal tracking
CREATE TABLE public.patient_load_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid NOT NULL REFERENCES public.referring_offices(id) ON DELETE CASCADE,
  patient_count integer NOT NULL,
  previous_count integer,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  changed_by_user_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.patient_load_history ENABLE ROW LEVEL SECURITY;

-- Create policies for patient_load_history
CREATE POLICY "Authenticated users can view patient load history" 
ON public.patient_load_history 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert patient load history" 
ON public.patient_load_history 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update patient load history" 
ON public.patient_load_history 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete patient load history" 
ON public.patient_load_history 
FOR DELETE 
USING (true);

-- Create indexes for efficient querying
CREATE INDEX idx_patient_load_history_office_id ON public.patient_load_history(office_id);
CREATE INDEX idx_patient_load_history_timestamp ON public.patient_load_history(timestamp);
CREATE INDEX idx_patient_load_history_office_timestamp ON public.patient_load_history(office_id, timestamp);

-- Create function to automatically log patient load changes
CREATE OR REPLACE FUNCTION public.log_patient_load_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if patient_load actually changed
  IF OLD.patient_load IS DISTINCT FROM NEW.patient_load THEN
    INSERT INTO public.patient_load_history (
      office_id,
      patient_count,
      previous_count,
      timestamp,
      changed_by_user_id
    ) VALUES (
      NEW.id,
      NEW.patient_load,
      OLD.patient_load,
      now(),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic logging
CREATE TRIGGER patient_load_change_trigger
  AFTER UPDATE OF patient_load ON public.referring_offices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_patient_load_change();

-- Create function to get patient load trend
CREATE OR REPLACE FUNCTION public.get_patient_load_trend(office_id_param uuid, days_back integer DEFAULT 30)
RETURNS TABLE (
  current_count integer,
  previous_count integer,
  trend_direction text,
  last_updated timestamp with time zone
) AS $$
DECLARE
  current_val integer;
  comparison_val integer;
  last_update timestamp with time zone;
BEGIN
  -- Get current patient load
  SELECT patient_load INTO current_val
  FROM public.referring_offices
  WHERE id = office_id_param;
  
  -- Get the most recent update timestamp
  SELECT MAX(timestamp) INTO last_update
  FROM public.patient_load_history
  WHERE office_id = office_id_param;
  
  -- Get patient load from specified days ago for comparison
  SELECT patient_count INTO comparison_val
  FROM public.patient_load_history
  WHERE office_id = office_id_param
    AND timestamp <= (now() - (days_back || ' days')::interval)
  ORDER BY timestamp DESC
  LIMIT 1;
  
  -- If no historical data, use current value
  IF comparison_val IS NULL THEN
    comparison_val := current_val;
  END IF;
  
  -- Determine trend direction
  RETURN QUERY SELECT 
    current_val,
    comparison_val,
    CASE 
      WHEN current_val > comparison_val THEN 'up'
      WHEN current_val < comparison_val THEN 'down'
      ELSE 'stable'
    END,
    last_update;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;