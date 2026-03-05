
-- Competitor watchlist: offices the user wants to track
CREATE TABLE public.competitor_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  google_place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  specialty TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_place_id)
);

-- Weekly snapshots of competitor data
CREATE TABLE public.competitor_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  watchlist_id UUID NOT NULL REFERENCES public.competitor_watchlist(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_rating NUMERIC,
  review_count INTEGER DEFAULT 0,
  review_velocity NUMERIC DEFAULT 0, -- reviews per week
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(watchlist_id, snapshot_date)
);

-- RLS
ALTER TABLE public.competitor_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own watchlist"
  ON public.competitor_watchlist FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own snapshots"
  ON public.competitor_snapshots FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own snapshots"
  ON public.competitor_snapshots FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_competitor_watchlist_updated_at
  BEFORE UPDATE ON public.competitor_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
