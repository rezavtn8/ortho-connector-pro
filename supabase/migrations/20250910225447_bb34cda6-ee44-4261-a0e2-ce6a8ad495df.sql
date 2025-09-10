-- Enable Row Level Security on dashboard_summary table
ALTER TABLE public.dashboard_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for dashboard_summary table
CREATE POLICY "Users can view their own dashboard summary" 
ON public.dashboard_summary 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own dashboard summary" 
ON public.dashboard_summary 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own dashboard summary" 
ON public.dashboard_summary 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own dashboard summary" 
ON public.dashboard_summary 
FOR DELETE 
USING (user_id = auth.uid());

-- Enable Row Level Security on office_metrics table
ALTER TABLE public.office_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for office_metrics table
CREATE POLICY "Users can view their own office metrics" 
ON public.office_metrics 
FOR SELECT 
USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own office metrics" 
ON public.office_metrics 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own office metrics" 
ON public.office_metrics 
FOR UPDATE 
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own office metrics" 
ON public.office_metrics 
FOR DELETE 
USING (created_by = auth.uid());