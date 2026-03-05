
-- Add UPDATE and DELETE policies on competitor_snapshots for future-proofing
CREATE POLICY "Users can update their own snapshots"
ON public.competitor_snapshots
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own snapshots"
ON public.competitor_snapshots
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
