import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIRequest {
  task_type: 'email_generation' | 'review_response' | 'content_creation' | 'analysis' | 'comprehensive_analysis' | 'practice_consultation';
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

    // Get business context for user - auto-build if missing
    let { data: businessProfile } = await supabase
      .from('ai_business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!businessProfile) {
      console.log('No business profile found, auto-building from available data...');
      
      // Auto-build business profile from available data
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const { data: clinic } = await supabase
        .from('clinics')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      // Create a basic business profile
      const autoProfile = {
        user_id: user.id,
        business_persona: {
          practice_name: clinic?.name || userProfile?.clinic_name || 'Healthcare Practice',
          owner_name: `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'Doctor',
          owner_title: userProfile?.job_title || 'Healthcare Professional',
          degrees: userProfile?.degrees || 'DDS',
          location: clinic?.address || 'Healthcare Location'
        },
        communication_style: 'professional',
        brand_voice: {
          tone: 'professional',
          values: ['patient care', 'excellence', 'trust']
        }
      };

      // Insert the auto-built profile
      const { data: newProfile } = await supabase
        .from('ai_business_profiles')
        .insert(autoProfile)
        .select()
        .single();

      businessProfile = newProfile || autoProfile;
      console.log('Auto-built business profile:', businessProfile);
    }

    // Build system prompt based on business context
    const systemPrompt = buildSystemPrompt(businessProfile, task_type);
    
    // Build user prompt based on task type
    const userPrompt = buildUserPrompt(task_type, context, prompt, parameters);

    console.log('AI Request:', { task_type, user_id: user.id });
    console.log('System Prompt:', systemPrompt);
    console.log('User Prompt:', userPrompt);

    // Make OpenAI API call (primary: gpt-4.1-2025-04-14)
    let modelUsed = 'gpt-4.1-2025-04-14';
    let generatedContent = '';
    let tokensUsed = 0;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelUsed,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        // gpt-4.1+ uses max_completion_tokens and does not support temperature
        max_completion_tokens: 1200,
      }),
    });

    console.log('OpenAI Response Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      generatedContent = (data.choices?.[0]?.message?.content || '').toString();
      tokensUsed = data.usage?.total_tokens || 0;
      console.log('Generated Content (primary gpt-4.1):', generatedContent?.slice(0, 200));
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error (primary):', errorData);
    }

    // Fallback: if primary failed or returned empty, retry with legacy gpt-4o-mini (supports temperature/max_tokens)
    if (!generatedContent || !generatedContent.trim()) {
      console.warn('Primary model empty/failed, retrying with gpt-4o-mini');
      modelUsed = 'gpt-4o-mini';
      const response2 = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelUsed,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 800,
          temperature: 0.7,
        }),
      });

      console.log('Fallback OpenAI Response Status:', response2.status);
      if (!response2.ok) {
        const errorData2 = await response2.json().catch(() => ({}));
        console.error('Fallback OpenAI API Error:', errorData2);
        throw new Error(`OpenAI API error (fallback)`);
      }

      const data2 = await response2.json();
      generatedContent = (data2.choices?.[0]?.message?.content || '').toString();
      console.log('Generated Content (fallback gpt-4o-mini):', generatedContent?.slice(0, 200));
      tokensUsed += data2.usage?.total_tokens || 0;
    }

    const estimatedCost = calculateCost(tokensUsed, modelUsed);

    // Track usage
    await supabase
      .from('ai_usage_tracking')
      .insert({
        user_id: user.id,
        task_type,
        tokens_used: tokensUsed,
        estimated_cost: estimatedCost,
        execution_time_ms: Date.now() - startTime,
        model_used: modelUsed,
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
      return `You are a GPT-powered assistant writing **formal, professional, and personalized emails** for ${business_persona.practice_name}'s Partnering Offices platform.

You are given live referral data and relationship metadata for a dental or medical office that has referred patients to our practice (e.g. an endodontic or surgical center).

### OBJECTIVE
Generate an editable email draft addressed to the office owner, tailored to their actual referral activity. This email will be sent by the owner of the specialty clinic. It should:

- Match the appropriate tone based on the **RelationshipScore**
- Use referral data thoughtfully (don't be robotic or over-numeric)
- Highlight the owner's name and role (e.g., Dr. John Smith, General Dentist)
- Mention the business name (both in opening and end)
- End with: "Respectfully," followed by our sender's info
- Leave a bit of room for manual additions

### STRUCTURE
1. **Greeting** (e.g., "Dear Dr. Smith,")
2. **Intro Paragraph** – Varies based on their relationship score:
   - VIP → Express deep appreciation and reinforce collaboration
   - Warm → Thank them sincerely, offer support, ask if they need anything
   - Sporadic → Mention recent activity and invite feedback
   - Cold → Reintroduce our clinic, remind them of how we can help their patients
3. **Referral Data Summary** – Gently reference:
   - Number of referrals in the past year (rounded / described naturally)
   - Treatment types (e.g., root canals, implants, trauma cases)
   - Timing of most recent referral (e.g., "a few months ago," "earlier this year")
4. **Call to Action** – One of:
   - Invite feedback
   - Ask if they'd like updated referral forms or CE events
   - Invite them to reach out with any patient needs
5. **Closing** – Always end with gratitude and mention the business name again

### REQUIREMENTS
- Never include degrees at the **start of the name**. Instead: "Dr. John Smith, DDS – General Dentist"
- Include both contact person's name/role and business name in the first and last part of the email
- Tone must be official, warm, and tailored to the situation. Slight variation between outputs is encouraged
- If referral count is very low, avoid shame. Gently offer support or reconnection
- Include {{ExtraNotes}} as an optional add-on at the end (if any)

### SIGNATURE FORMAT:
Respectfully,  
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

    case 'comprehensive_analysis':
    case 'practice_consultation':
      return basePrompt + `

TASK: Provide data-driven business intelligence and strategic recommendations based on actual practice data.

CRITICAL REQUIREMENTS:
1. ALWAYS ground responses in the specific practice data provided (referral patterns, patient volumes, geographic distribution, seasonal trends)
2. NEVER use placeholder text like "Types may include" or "example data"
3. Structure each response with:
   - **Executive Summary** (bold, 1-2 sentences with the main takeaway)
   - **Data Analysis** (specific numbers, percentages, comparisons from actual data)
   - **Key Insights** (interpret what the data means for the practice)
   - **Recommended Actions** (specific, actionable recommendations with priorities)
4. Use actual numbers from the provided data - no generic examples
5. Focus on actionable insights that can improve practice performance
6. Include risk factors and opportunities based on actual patterns
7. Compare current performance to trends and benchmarks when possible

DATA INTERPRETATION GUIDELINES:
- Convert data into meaningful business insights
- Identify patterns, trends, and anomalies in the actual data
- Provide context for what the numbers mean for practice growth
- Highlight both strengths to leverage and weaknesses to address
- Give specific recommendations with clear next steps`;

    default:
      return basePrompt + `

TASK: Provide professional assistance with healthcare practice communications.`;
  }
}

function buildUserPrompt(taskType: string, context: any, prompt?: string, parameters?: any): string {
  switch (taskType) {
    case 'email_generation':
      return `Generate a professional referral relationship email using this structured data:

OfficeName: ${context.office_name}
OwnerName: ${context.owner_name || context.extracted_owner_name || 'Dr. [Owner]'}
OwnerRole: ${context.owner_role || context.office_type || 'Healthcare Professional'}
OwnerDegrees: ${context.owner_degrees || 'DDS'}
ReferralCountPast12Months: ${context.recent_referrals_6months || 0}
ReferralFrequency: ${context.referral_frequency || (context.average_monthly_referrals > 2 ? 'High' : context.average_monthly_referrals > 1 ? 'Moderate' : 'Low')}
TreatmentTypesReferred: ${context.treatment_types || 'various dental procedures'}
LastReferralDate: ${context.last_referral_month ? new Date(context.last_referral_month + '-01').toLocaleDateString() : 'N/A'}
RelationshipScore: ${context.relationship_strength === 'VIP Partner' ? 'VIP' : 
                   context.relationship_strength === 'Strong Partner' ? 'Warm' :
                   context.relationship_strength === 'Active Partner' ? 'Warm' :
                   context.relationship_strength === 'Growing Partner' ? 'Sporadic' : 'Cold'}
ExtraNotes: ${context.office_notes || context.additional_info || ''}

Generate the email following the established structure and requirements. Return ONLY the email content, no JSON wrapper.

${prompt || ''}`;

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

    case 'comprehensive_analysis':
      const analysisData = context.analysis_data;
      
      return `CRITICAL INSTRUCTION: You MUST use ONLY the real data provided below. Do NOT create fictional examples, sample names, or placeholder data.

ACTUAL PRACTICE DATA TO ANALYZE:

BUSINESS METRICS (Real Numbers):
- Total Sources: ${analysisData?.metrics?.total_sources || 0}
- Active Sources: ${analysisData?.metrics?.active_sources || 0}
- Total Lifetime Referrals: ${analysisData?.metrics?.total_lifetime_referrals || 0}
- Current Month Referrals: ${analysisData?.metrics?.current_month_referrals || 0}
- Last 6 Months Referrals: ${analysisData?.metrics?.last_6_months_referrals || 0}

ACTUAL TOP PERFORMING SOURCES:
${analysisData?.top_performers?.map((s: any, i: number) => 
  `${i+1}. "${s.name}" - ${s.total_patients} total patients (Type: ${s.type}${s.address ? `, Located: ${s.address}` : ''})`
).join('\n') || 'No top performers data available'}

ACTUAL SOURCE TYPE DISTRIBUTION:
${Object.entries(analysisData?.source_types_distribution || {}).map(([type, count]) => 
  `- ${type}: ${count} sources (${analysisData?.metrics?.total_sources ? Math.round((count as number)/analysisData.metrics.total_sources*100) : 0}%)`
).join('\n') || 'No source type data available'}

ACTUAL MONTHLY PERFORMANCE TRENDS:
${Object.entries(analysisData?.monthly_trends || {}).map(([month, count]) => 
  `- ${month}: ${count} referrals`
).join('\n') || 'No monthly trend data available'}

ACTUAL UNDERPERFORMING SOURCES:
${analysisData?.underperformers?.slice(0, 5).map((s: any) => 
  `- "${s.name}" (${s.type}): ${s.total_patients} total referrals, ${s.recent_patients} recent referrals`
).join('\n') || 'No underperformer data available'}

ACTUAL GEOGRAPHIC DISTRIBUTION:
${analysisData?.geographic_distribution?.slice(0, 5).map((g: any) => 
  `- "${g.name}": ${g.patients} patients from ${g.address}`
).join('\n') || 'No geographic data available'}

MANDATORY REQUIREMENTS:
1. Use ONLY the actual source names, numbers, and addresses listed above
2. Calculate percentages from the real data provided (do not estimate)
3. Reference specific source names in quotes when mentioned
4. If data is missing or zero, state that clearly instead of making up numbers
5. Structure each insight: Executive Summary (bold), Supporting Data (real numbers), Key Insight (interpretation), Recommended Action
6. Do NOT use ** in section titles - use clean headers like "Source Concentration Risk Analysis"
7. Provide 4-6 insights based on the actual data patterns shown above

USER QUESTION: ${prompt}

REMEMBER: Every number, name, and percentage MUST come from the data provided above. Do not create examples.`;

    case 'practice_consultation':
      const practiceData = context.practice_data;
      const conversationHistory = context.conversation_history || [];
      
      return `Based on this specific practice data, provide a detailed consultation response:

CURRENT PRACTICE METRICS:
- Active Sources: ${practiceData?.analytics?.total_sources || 0}
- Total Lifetime Referrals: ${practiceData?.analytics?.total_referrals || 0}  
- Active Sources This Month: ${practiceData?.analytics?.active_sources_this_month || 0}
- Recent Marketing Visits: ${practiceData?.analytics?.recent_visits || 0}

SOURCE BREAKDOWN BY TYPE:
${Object.entries(practiceData?.analytics?.source_types_distribution || {}).map(([type, count]) => `- ${type}: ${count} sources (${Math.round((count as number) / (practiceData?.analytics?.total_sources || 1) * 100)}%)`).join('\n')}

PERFORMANCE TRENDS (Last 6 Months):
${practiceData?.analytics?.last_6_months_trend?.map((month: any) => 
  `- ${month.year_month}: ${month.patient_count} patients`
).join('\n') || 'Limited trend data available'}

RECENT ACTIVITY:
- Sources: ${practiceData?.sources?.length || 0} total referral sources
- Monthly Data Points: ${practiceData?.monthly_data?.length || 0} records
- Marketing Visits: ${practiceData?.visits?.length || 0} visits logged
- Campaign History: ${practiceData?.campaigns?.length || 0} campaigns

USER QUESTION: ${prompt}

RESPONSE REQUIREMENTS:
1. **Executive Summary**: Start with a bold 1-2 sentence takeaway
2. **Data Analysis**: Use the specific numbers provided above
3. **Key Insights**: Interpret what these numbers mean for practice growth
4. **Recommended Actions**: Give specific, prioritized recommendations

Use ONLY the actual data provided - no generic advice or placeholder examples.`;

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