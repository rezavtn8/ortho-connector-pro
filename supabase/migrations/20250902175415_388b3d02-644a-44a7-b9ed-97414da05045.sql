-- Create reviews table to store review status and metadata
CREATE TABLE public.review_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  google_review_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  clinic_id UUID,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled', 'follow-up', 'unreplied')),
  needs_attention BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(google_review_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.review_status ENABLE ROW LEVEL SECURITY;

-- Create policies for review status
CREATE POLICY "Users can view their own review status" 
ON public.review_status 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own review status" 
ON public.review_status 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own review status" 
ON public.review_status 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own review status" 
ON public.review_status 
FOR DELETE 
USING (user_id = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_review_status_updated_at
BEFORE UPDATE ON public.review_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();