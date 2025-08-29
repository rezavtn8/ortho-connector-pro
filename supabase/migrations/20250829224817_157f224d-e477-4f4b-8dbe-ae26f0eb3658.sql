-- Phase 1: Add user ownership and enable RLS on all tables

-- Add user_id columns to tables that need them
ALTER TABLE public.monthly_patients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.patient_changes_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.source_tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing records to have a user_id (assign to first user if any exist)
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    -- Get the first user ID from auth.users
    SELECT id INTO first_user_id FROM auth.users LIMIT 1;
    
    IF first_user_id IS NOT NULL THEN
        -- Update existing records
        UPDATE public.monthly_patients SET user_id = first_user_id WHERE user_id IS NULL;
        UPDATE public.patient_changes_log SET user_id = first_user_id WHERE user_id IS NULL;
        UPDATE public.source_tags SET user_id = first_user_id WHERE user_id IS NULL;
        UPDATE public.patient_sources SET created_by = first_user_id WHERE created_by IS NULL;
    END IF;
END $$;

-- Enable Row Level Security on all tables
ALTER TABLE public.patient_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_changes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for patient_sources (using created_by column)
CREATE POLICY "Users can view their own patient sources"
ON public.patient_sources FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own patient sources"
ON public.patient_sources FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own patient sources"
ON public.patient_sources FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own patient sources"
ON public.patient_sources FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Create RLS policies for monthly_patients
CREATE POLICY "Users can view their own monthly patients"
ON public.monthly_patients FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own monthly patients"
ON public.monthly_patients FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own monthly patients"
ON public.monthly_patients FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own monthly patients"
ON public.monthly_patients FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Create RLS policies for patient_changes_log
CREATE POLICY "Users can view their own patient changes log"
ON public.patient_changes_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own patient changes log"
ON public.patient_changes_log FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create RLS policies for source_tags
CREATE POLICY "Users can view their own source tags"
ON public.source_tags FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own source tags"
ON public.source_tags FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own source tags"
ON public.source_tags FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own source tags"
ON public.source_tags FOR DELETE
TO authenticated
USING (user_id = auth.uid());