-- Create office_emails table to track email communication history
CREATE TABLE public.office_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  office_id UUID NOT NULL REFERENCES public.patient_sources(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.office_contacts(id) ON DELETE SET NULL,
  recipient_email TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  email_type TEXT NOT NULL DEFAULT 'outreach',
  status TEXT NOT NULL DEFAULT 'draft',
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  ai_content_id UUID REFERENCES public.ai_generated_content(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add constraint for valid email types
ALTER TABLE public.office_emails ADD CONSTRAINT office_emails_type_check 
  CHECK (email_type IN ('outreach', 'follow_up', 'thank_you', 're_engagement', 'holiday', 'custom'));

-- Add constraint for valid status
ALTER TABLE public.office_emails ADD CONSTRAINT office_emails_status_check 
  CHECK (status IN ('draft', 'sent', 'replied'));

-- Create indexes for faster queries
CREATE INDEX idx_office_emails_office_id ON public.office_emails(office_id);
CREATE INDEX idx_office_emails_user_id ON public.office_emails(user_id);
CREATE INDEX idx_office_emails_status ON public.office_emails(status);
CREATE INDEX idx_office_emails_created_at ON public.office_emails(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.office_emails ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own office emails" 
ON public.office_emails 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own office emails" 
ON public.office_emails 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own office emails" 
ON public.office_emails 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own office emails" 
ON public.office_emails 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_office_emails_updated_at
BEFORE UPDATE ON public.office_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();