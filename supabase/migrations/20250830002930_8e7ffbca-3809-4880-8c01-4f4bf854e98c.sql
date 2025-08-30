-- Enable real-time updates for patient_sources table
ALTER TABLE public.patient_sources REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_sources;

-- Enable real-time updates for monthly_patients table  
ALTER TABLE public.monthly_patients REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_patients;