import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { task_type, context, parameters, ai_settings, business_context } = await req.json();

    console.log('AI Assistant request:', { task_type, user_id: user.id });

    // Fetch AI business profile if not provided
    let aiProfile = ai_settings;
    if (!aiProfile) {
      const { data: profile } = await supabase
        .from('ai_business_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      aiProfile = profile;
    }

    // Build system prompt with AI settings
    const systemPrompt = buildSystemPrompt(task_type, aiProfile, business_context);
    const userPrompt = buildUserPrompt(task_type, context, parameters, aiProfile, business_context);

    console.log('Calling OpenAI for task:', task_type);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log('AI Assistant response generated');

    return new Response(JSON.stringify({
      success: true,
      content,
      usage: {
        tokens_used: data.usage?.total_tokens || 0
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in ai-assistant:', error);

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

function buildSystemPrompt(taskType: string, aiSettings: any, businessContext?: any): string {
  const communicationStyle = aiSettings?.communication_style || 'professional';
  const brandVoice = aiSettings?.brand_voice?.traits || ['Professional', 'Trustworthy', 'Caring'];
  const competitiveAdvantages = aiSettings?.competitive_advantages || [];
  const specialties = aiSettings?.specialties || [];
  const practiceValues = aiSettings?.practice_values || [];
  const targetAudience = aiSettings?.target_audience || '';

  const basePrompt = `You are an expert healthcare marketing and communication specialist.

BRAND IDENTITY:
• Communication Style: ${communicationStyle}
• Brand Voice Traits: ${brandVoice.join(', ')}
• Target Audience: ${targetAudience || 'Healthcare professionals and patients'}

PRACTICE STRENGTHS:
${competitiveAdvantages.length > 0 ? `• Competitive Advantages: ${competitiveAdvantages.join(', ')}` : ''}
${specialties.length > 0 ? `• Specialties: ${specialties.join(', ')}` : ''}
${practiceValues.length > 0 ? `• Core Values: ${practiceValues.join(', ')}` : ''}

CRITICAL INSTRUCTIONS:
• Match the ${communicationStyle} communication style exactly
• Embody these brand traits: ${brandVoice.join(', ')}
• Naturally weave in practice strengths when relevant
• Keep tone consistent with the practice's values
• Be authentic and avoid generic templates`;

  switch (taskType) {
    case 'email_generation':
      return `${basePrompt}

TASK: Generate a referral outreach email.

HARD REQUIREMENTS:
- Greet the recipient by name
- Reference SPECIFIC referral/visit data provided
- Use the sender's real name and practice details (provided in the user prompt)
- NO placeholders like [Practice Name], [Your Name], or "the team at the practice"
- Signature MUST be exactly the sender block (name, optional credentials, optional title, exact practice name)
- Keep total length between 120–180 words, concise and specific
- Emphasize: ${competitiveAdvantages.slice(0, 2).join(' and ') || 'quality care'}`;

    case 'review_response':
      const practiceName = businessContext?.practice_name || 'our practice';
      const doctorName = businessContext?.doctor_name || '';
      return `${basePrompt}

PRACTICE DETAILS:
• Practice Name: ${practiceName}
${doctorName ? `• Doctor: ${doctorName}` : ''}
${businessContext?.degrees ? `• Credentials: ${businessContext.degrees}` : ''}
${businessContext?.job_title ? `• Title: ${businessContext.job_title}` : ''}

TASK: Generate a thoughtful review response.
CRITICAL INSTRUCTIONS:
- Thank the reviewer by their actual name warmly and specifically
- Reference SPECIFIC points they mentioned in their review (procedure, staff names, experience details)
- Sign ONLY with "${doctorName || 'The Team'}" - write this EXACT name, NO variations or additions
- Naturally mention "${practiceName}" once in the response body
- Keep response between 80-120 words - be concise and genuine
- End with a brief, warm closing

FORBIDDEN:
- NO generic phrases like "we appreciate your feedback"
- NO placeholders like [Practice Name], [Your Name], [Doctor Name]
- NO signing with titles like "Dr. [Name] and Team" - use ONLY the exact name provided
- NO vague statements - be specific to their review`;

    default:
      return basePrompt;
  }
}

function buildUserPrompt(taskType: string, context: any, parameters: any, aiSettings: any, businessContext?: any): string {
  switch (taskType) {
    case 'email_generation':
      return `Generate a personalized referral outreach email.

RECIPIENT:
• Name: ${context.owner_name || context.office_name}
• Office: ${context.office_name}
• Role: ${context.owner_role || 'Healthcare Professional'}
• Relationship: ${context.relationship_score || context.relationship_strength}

REFERRAL DATA:
• Total Referrals (12 months): ${context.referral_count_past_12_months || context.total_referrals || 0}
• Recent Activity: ${context.recent_referrals_6months || 0} in last 6 months
• Last Referral: ${context.last_referral_date || context.last_referral_month || 'Recently'}
• Frequency: ${context.referral_frequency || 'Occasional'}

SENDER (USE EXACT DETAILS – NO PLACEHOLDERS):
• Name: ${context.sender_name}
${context.sender_degrees ? `• Credentials: ${context.sender_degrees}` : ''}
${context.sender_title ? `• Title: ${context.sender_title}` : ''}
• Practice: ${context.practice_name}

GUIDELINES (120–180 words):
1) Open with their name and 1–2 specifics from the data above
2) Mention "${context.practice_name}" exactly once in the body (do not say "our practice" or "the practice")
3) Clear, relevant next step (offer forms/materials/quick call)
4) Close with this EXACT signature block:

${context.sender_name}${context.sender_degrees ? `, ${context.sender_degrees}` : ''}
${context.sender_title ? context.sender_title : ''}
${context.practice_name}

FORBIDDEN:
- Any placeholders (e.g., [Practice Name], [Your Name])
- "the team at the practice" or "our practice"
- Changing or paraphrasing real names or the practice name`;

    case 'review_response':
      const practiceName = businessContext?.practice_name || 'the practice';
      const doctorName = businessContext?.doctor_name || '';
      const doctorTitle = businessContext?.job_title || '';
      const doctorDegrees = businessContext?.degrees || '';
      
      return `Generate a personalized review response for this 5-star review.

EXACT INFORMATION TO USE:
Practice Name: "${practiceName}" (use this exact name in your response)
${doctorName ? `Doctor's Name: "${doctorName}" (sign with ONLY this name, nothing else)` : 'Sign with: "The Team"'}
${doctorTitle ? `Title: ${doctorTitle}` : ''}
${doctorDegrees ? `Credentials: ${doctorDegrees}` : ''}

REVIEW DETAILS:
Reviewer Name: ${context.reviewer_name}
Rating: ${context.rating}/5 stars
Review: "${context.review_text}"

RESPONSE STRUCTURE (80-120 words):
1. Opening: Thank ${context.reviewer_name} by name and reference a SPECIFIC detail from their review
2. Body: Mention "${practiceName}" naturally while addressing their specific experience
3. Closing: Brief warm statement
4. Signature: "${doctorName || 'The Team'}" ONLY - no additions

MUST REFERENCE SPECIFICALLY FROM REVIEW:
- If they mention staff names → acknowledge those staff members
- If they mention procedure type → reference that specific procedure  
- If they mention emotions (nervous, comfortable, etc.) → acknowledge those feelings
- If they mention pain/comfort level → reference that specific point

FORBIDDEN - DO NOT:
- Write [Practice Name], [Doctor Name], or any brackets
- Sign with "Dr. [Name] and the Team" - use ONLY the exact name
- Use generic phrases - every sentence must be specific to THIS review`;

    default:
      return JSON.stringify(context);
  }
}

serve(handler);
