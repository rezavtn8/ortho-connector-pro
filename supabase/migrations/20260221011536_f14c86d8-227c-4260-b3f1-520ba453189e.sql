
-- Create groups table for organizing discovered offices
CREATE TABLE public.discovered_office_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discovered_office_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own groups" ON public.discovered_office_groups FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create their own groups" ON public.discovered_office_groups FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own groups" ON public.discovered_office_groups FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own groups" ON public.discovered_office_groups FOR DELETE USING (user_id = auth.uid());

-- Create group members junction table
CREATE TABLE public.discovered_office_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.discovered_office_groups(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES public.discovered_offices(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, office_id)
);

-- Enable RLS
ALTER TABLE public.discovered_office_group_members ENABLE ROW LEVEL SECURITY;

-- Use security definer function to check group ownership
CREATE OR REPLACE FUNCTION public.user_owns_discovered_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.discovered_office_groups
    WHERE id = p_group_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Users can view their group members" ON public.discovered_office_group_members FOR SELECT USING (public.user_owns_discovered_group(group_id));
CREATE POLICY "Users can add to their groups" ON public.discovered_office_group_members FOR INSERT WITH CHECK (public.user_owns_discovered_group(group_id));
CREATE POLICY "Users can remove from their groups" ON public.discovered_office_group_members FOR DELETE USING (public.user_owns_discovered_group(group_id));

-- Trigger for updated_at
CREATE TRIGGER update_discovered_office_groups_updated_at
  BEFORE UPDATE ON public.discovered_office_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
