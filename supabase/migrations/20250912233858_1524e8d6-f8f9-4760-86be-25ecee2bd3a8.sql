-- AI Business Context and Usage Tracking Tables

-- AI business profiles to store business intelligence and communication preferences
CREATE TABLE public.ai_business_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID,
  business_persona JSONB NOT NULL DEFAULT '{}',
  communication_style TEXT DEFAULT 'professional',
  specialties TEXT[] DEFAULT '{}',
  brand_voice JSONB DEFAULT '{}',
  practice_values TEXT[],
  target_audience TEXT,
  competitive_advantages TEXT[],
  templates JSONB DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- AI usage tracking for monitoring and cost control
CREATE TABLE public.ai_usage_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_type TEXT NOT NULL, -- 'email_generation', 'review_response', 'content_creation', etc.
  tokens_used INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10,4) DEFAULT 0,
  quality_rating INTEGER, -- 1-5 rating from user
  execution_time_ms INTEGER,
  model_used TEXT DEFAULT 'gpt-4.1-2025-04-14',
  request_data JSONB,
  response_data JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AI generated content storage and management
CREATE TABLE public.ai_generated_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL, -- 'email', 'review_response', 'marketing_copy', etc.
  reference_id UUID, -- Reference to campaign, review, etc.
  generated_text TEXT NOT NULL,
  status TEXT DEFAULT 'generated', -- 'generated', 'approved', 'sent', 'rejected'
  feedback TEXT,
  quality_score DECIMAL(3,2),
  used BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AI response templates for reusable content patterns
CREATE TABLE public.ai_response_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_type TEXT NOT NULL, -- 'email_vip', 'email_cold', 'review_positive', etc.
  template_name TEXT NOT NULL,
  template_text TEXT NOT NULL,
  variables JSONB DEFAULT '{}', -- Template variables like {{practice_name}}, {{doctor_name}}
  usage_count INTEGER DEFAULT 0,
  effectiveness_score DECIMAL(3,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all AI tables
ALTER TABLE public.ai_business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_response_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_business_profiles
CREATE POLICY "Users can manage their own AI business profile"
ON public.ai_business_profiles
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for ai_usage_tracking
CREATE POLICY "Users can view their own AI usage"
ON public.ai_usage_tracking
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can insert AI usage tracking"
ON public.ai_usage_tracking
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own AI usage ratings"
ON public.ai_usage_tracking
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for ai_generated_content
CREATE POLICY "Users can manage their own AI generated content"
ON public.ai_generated_content
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for ai_response_templates
CREATE POLICY "Users can manage their own AI templates"
ON public.ai_response_templates
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add triggers for updated_at columns
CREATE TRIGGER update_ai_generated_content_updated_at
  BEFORE UPDATE ON public.ai_generated_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_response_templates_updated_at
  BEFORE UPDATE ON public.ai_response_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_ai_business_profiles_user_id ON public.ai_business_profiles(user_id);
CREATE INDEX idx_ai_usage_tracking_user_id ON public.ai_usage_tracking(user_id);
CREATE INDEX idx_ai_usage_tracking_task_type ON public.ai_usage_tracking(task_type);
CREATE INDEX idx_ai_usage_tracking_created_at ON public.ai_usage_tracking(created_at);
CREATE INDEX idx_ai_generated_content_user_id ON public.ai_generated_content(user_id);
CREATE INDEX idx_ai_generated_content_content_type ON public.ai_generated_content(content_type);
CREATE INDEX idx_ai_response_templates_user_id ON public.ai_response_templates(user_id);
CREATE INDEX idx_ai_response_templates_template_type ON public.ai_response_templates(template_type);