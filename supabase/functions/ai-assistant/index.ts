import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIRequest {
  task_type: 'email_generation' | 'review_response' | 'content_creation' | 'analysis';
  context: any;
  prompt?: string;
  parameters?: {
    tone?: string;
    length?: 'short' | 'medium' | 'long';
    style?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user session
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { task_type, context, prompt, parameters }: AIRequest = await req.json();

    // Get business context for user
    const { data: businessProfile } = await supabase
      .from('ai_business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!businessProfile) {
      console.log('No business profile found, building one automatically...');
      
      // Auto-build business context
      const { data: buildResponse, error: buildError } = await supabase.functions.invoke('ai-business-context', {
        body: { action: 'build' },
        headers: {
          Authorization: req.headers.get('Authorization')!,
        },
      });

      if (buildError || !buildResponse?.profile) {
        return new Response(JSON.stringify({ 
          error: 'Business profile not found and failed to auto-build. Please set up your business context.' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Use the newly built profile
      const newBusinessProfile = buildResponse.profile;
      console.log('Auto-built business profile successfully');
    }

    // Build system prompt based on business context (use auto-built if needed)
    const activeProfile = businessProfile || buildResponse?.profile;
    const systemPrompt = buildSystemPrompt(activeProfile, task_type);
    
    // Build user prompt based on task type
    const userPrompt = buildUserPrompt(task_type, context, prompt, parameters);

    console.log('AI Request:', { task_type, user_id: user.id });

    // Make OpenAI API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 0;
    const estimatedCost = calculateCost(tokensUsed, 'gpt-5-2025-08-07');

    // Track usage
    await supabase
      .from('ai_usage_tracking')
      .insert({
        user_id: user.id,
        task_type,
        tokens_used: tokensUsed,
        estimated_cost: estimatedCost,
        execution_time_ms: Date.now() - startTime,
        model_used: 'gpt-5-2025-08-07',
        request_data: { task_type, context, prompt, parameters },
        response_data: { content: generatedContent },
        success: true,
      });

    // Store generated content
    const { data: contentRecord } = await supabase
      .from('ai_generated_content')
      .insert({
        user_id: user.id,
        content_type: task_type,
        reference_id: context.reference_id || null,
        generated_text: generatedContent,
        status: 'generated',
        metadata: { parameters, context },
      })
      .select()
      .single();

    return new Response(JSON.stringify({
      content: generatedContent,
      content_id: contentRecord?.id,
      usage: {
        tokens_used: tokensUsed,
        estimated_cost: estimatedCost,
        execution_time_ms: Date.now() - startTime,
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in ai-assistant:', error);

    // Track failed usage
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      );

      const authHeader = req.headers.get('Authorization')!;
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        await supabase
          .from('ai_usage_tracking')
          .insert({
            user_id: user.id,
            task_type: 'unknown',
            tokens_used: 0,
            estimated_cost: 0,
            execution_time_ms: Date.now() - startTime,
            success: false,
            error_message: error.message,
          });
      }
    } catch (trackingError) {
      console.error('Error tracking failed usage:', trackingError);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

function buildSystemPrompt(businessProfile: any, taskType: string): string {
  const { business_persona, communication_style, brand_voice } = businessProfile;
  
  let basePrompt = `You are an AI assistant for ${business_persona.practice_name}, a healthcare practice owned by ${business_persona.owner_name}.

BUSINESS CONTEXT:
- Practice: ${business_persona.practice_name}
- Owner: ${business_persona.owner_name} (${business_persona.owner_title})
- Location: ${business_persona.location}
- Communication Style: ${communication_style}
- Brand Voice: ${brand_voice.tone}
- Values: ${brand_voice.values.join(', ')}

IMPORTANT: Always maintain a ${brand_voice.tone} tone that reflects the practice's professional standards and values.`;

  switch (taskType) {
    case 'email_generation':
      return basePrompt + `

TASK: Generate professional referral relationship emails.

REQUIREMENTS:
1. Address recipient by name only (no degrees) in salutation
2. Include degrees only in your signature
3. Tailor tone based on referral relationship strength
4. Use referral data naturally, don't overload with numbers
5. Always end with the referring office's business name
6. Keep to 2-4 short paragraphs
7. Sound warm and appreciative, not robotic

SIGNATURE FORMAT:
Best regards,
${business_persona.owner_name}, ${business_persona.degrees}
${business_persona.owner_title}
${business_persona.practice_name}`;

    case 'review_response':
      return basePrompt + `

TASK: Generate professional responses to Google reviews.

REQUIREMENTS:
1. Thank the reviewer by name if provided
2. Acknowledge their specific feedback
3. Maintain professional healthcare standards
4. Show appreciation for their trust
5. Keep responses concise and genuine
6. Never include personal health information
7. Redirect complex issues to private communication`;

    case 'content_creation':
      return basePrompt + `

TASK: Create marketing and communication content.

REQUIREMENTS:
1. Align with practice values and brand voice
2. Focus on patient care and professional relationships
3. Use healthcare-appropriate language
4. Include clear calls to action when relevant
5. Maintain professional credibility`;

    default:
      return basePrompt + `

TASK: Provide professional assistance with healthcare practice communications.`;
  }
}

function buildUserPrompt(taskType: string, context: any, prompt?: string, parameters?: any): string {
  switch (taskType) {
    case 'email_generation':
      return `Generate a professional referral relationship email with the following context:

RECIPIENT INFORMATION:
- Owner Name: ${context.owner_name}
- Owner Role: ${context.owner_role}
- Office Name: ${context.office_name}
- Office Type: ${context.office_type}

REFERRAL DATA:
- Patients referred in last year: ${context.last_year_referrals}
- Total lifetime referrals: ${context.total_referrals}
- Last referral date: ${context.last_referral_date}
- Referral trend: ${context.referral_trend}

ADDITIONAL CONTEXT:
${context.additional_info || 'N/A'}

${prompt || 'Generate an appropriate email for this referral relationship.'}`;

    case 'review_response':
      return `Generate a professional response to this Google review:

REVIEW DETAILS:
- Reviewer: ${context.reviewer_name}
- Rating: ${context.rating}/5 stars
- Review Text: "${context.review_text}"
- Review Date: ${context.review_date}

RESPONSE STYLE: ${parameters?.tone || 'professional and appreciative'}

${prompt || 'Generate an appropriate response to this review.'}`;

    case 'content_creation':
      return `Create content for: ${context.content_type}

CONTEXT:
${JSON.stringify(context, null, 2)}

PARAMETERS:
- Length: ${parameters?.length || 'medium'}
- Style: ${parameters?.style || 'professional'}
- Tone: ${parameters?.tone || 'professional'}

PROMPT: ${prompt || 'Create appropriate content based on the context provided.'}`;

    default:
      return prompt || 'Please provide assistance with the given context.';
  }
}

function calculateCost(tokens: number, model: string): number {
  // Estimated pricing for GPT-4.1 (adjust based on actual pricing)
  const costPer1KTokens = 0.01; // $0.01 per 1K tokens
  return (tokens / 1000) * costPer1KTokens;
}

serve(handler);