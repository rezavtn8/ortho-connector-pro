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
  AND auth.uid() = user_id  -- Prevent user_id modification
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