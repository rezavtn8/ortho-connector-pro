-- CRITICAL SECURITY FIX: Remove overly permissive RLS policy from patient_sources table
-- This policy currently allows ANY authenticated user to access ALL patient source data
DROP POLICY IF EXISTS "Users can do everything with sources" ON public.patient_sources;

-- Ensure we have proper user-specific policies in place
-- These should already exist but let's verify they're correct

-- Policy for users to view only their own patient sources
DROP POLICY IF EXISTS "Users can view their own patient sources" ON public.patient_sources;
CREATE POLICY "Users can view their own patient sources" 
ON public.patient_sources 
FOR SELECT 
USING (created_by = auth.uid());

-- Policy for users to insert their own patient sources
DROP POLICY IF EXISTS "Users can insert their own patient sources" ON public.patient_sources;
CREATE POLICY "Users can insert their own patient sources" 
ON public.patient_sources 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

-- Policy for users to update their own patient sources
DROP POLICY IF EXISTS "Users can update their own patient sources" ON public.patient_sources;
CREATE POLICY "Users can update their own patient sources" 
ON public.patient_sources 
FOR UPDATE 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Policy for users to delete their own patient sources
DROP POLICY IF EXISTS "Users can delete their own patient sources" ON public.patient_sources;
CREATE POLICY "Users can delete their own patient sources" 
ON public.patient_sources 
FOR DELETE 
USING (created_by = auth.uid());