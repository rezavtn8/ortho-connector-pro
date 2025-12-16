-- Office Tags System
CREATE TABLE public.office_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.office_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tags" ON public.office_tags
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own tags" ON public.office_tags
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tags" ON public.office_tags
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own tags" ON public.office_tags
  FOR DELETE USING (user_id = auth.uid());

-- Office Tag Assignments
CREATE TABLE public.office_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.patient_sources(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.office_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID,
  UNIQUE(office_id, tag_id)
);

ALTER TABLE public.office_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tag assignments" ON public.office_tag_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.office_tags WHERE id = tag_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert tag assignments" ON public.office_tag_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.office_tags WHERE id = tag_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete tag assignments" ON public.office_tag_assignments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.office_tags WHERE id = tag_id AND user_id = auth.uid())
  );

-- Trigger for updated_at on office_tags
CREATE TRIGGER update_office_tags_updated_at
  BEFORE UPDATE ON public.office_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();