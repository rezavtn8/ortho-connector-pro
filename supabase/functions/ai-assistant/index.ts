import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIRequest {
  task_type: 'email_generation' | 'review_response' | 'content_creation' | 'analysis' | 'comprehensive_analysis' | 'business_intelligence' | 'structured_report' | 'practice_consultation';
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

    // Use gpt-4o-mini for fast chat responses
    let modelUsed = 'gpt-4o-mini';
    let generatedContent = '';
    let tokensUsed = 0;

    // Add timeout for faster responses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

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
        max_tokens: task_type === 'practice_consultation' ? 300 : 800, // Limit chat responses
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('OpenAI Response Status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    generatedContent = (data.choices?.[0]?.message?.content || '').toString();
    tokensUsed = data.usage?.total_tokens || 0;
    console.log('Generated Content (gpt-4o-mini):', generatedContent?.slice(0, 150));

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
    case 'business_intelligence':
      return `You are a business intelligence AI analyst specializing in healthcare practice management and referral analytics.

TASK: Analyze comprehensive practice data and provide actionable business insights.

ANALYSIS REQUIREMENTS:
1. Provide exactly 4-6 distinct insights as separate paragraphs
2. Each insight should start with a **bold summary** followed by detailed analysis
3. Focus on different aspects: distribution, trends, risks, opportunities, recommendations
4. Use specific data points and percentages when available
5. Be concise but actionable - avoid generic advice
6. Prioritize insights by business impact

FORMAT REQUIREMENTS:
- Start each insight with **Bold Title:** then analysis
- Use natural paragraph breaks between insights
- Include specific numbers and trends where relevant
- End each insight with a clear recommendation

BUSINESS CONTEXT:
- Practice: ${business_persona?.practice_name || 'Healthcare Practice'}
- Owner: ${business_persona?.owner_name || 'Healthcare Professional'}
- Focus on referral source management and practice growth`;

    case 'structured_report':
      return `You are a business intelligence AI analyst creating structured reports for healthcare practices.

TASK: Generate a comprehensive business intelligence report with six specific sections.

REPORT STRUCTURE REQUIREMENTS:
You must provide content for exactly these 6 sections in JSON format:

{
  "source_distribution": {
    "summary": "1-2 sentence overview",
    "priority": "high|medium|low",
    "full_analysis": "detailed analysis with data points"
  },
  "performance_trends": {
    "summary": "1-2 sentence overview", 
    "priority": "high|medium|low",
    "full_analysis": "detailed analysis with trends"
  },
  "geographic_distribution": {
    "summary": "1-2 sentence overview",
    "priority": "high|medium|low", 
    "full_analysis": "detailed geographic insights"
  },
  "source_quality": {
    "summary": "1-2 sentence overview",
    "priority": "high|medium|low",
    "full_analysis": "reliability and quality assessment"
  },
  "strategic_recommendations": {
    "summary": "1-2 sentence overview",
    "priority": "high|medium|low",
    "full_analysis": "actionable strategic recommendations"
  },
  "emerging_patterns": {
    "summary": "1-2 sentence overview", 
    "priority": "high|medium|low",
    "full_analysis": "new trends and patterns identified"
  }
}

CONTENT REQUIREMENTS:
- Summary: 1-2 concise sentences highlighting key finding
- Priority: Based on business impact (high/medium/low)
- Full Analysis: 3-4 sentences with specific data points and actionable insights
- Use real data from the practice when available
- Be specific and avoid generic recommendations

BUSINESS CONTEXT:
- Practice: ${business_persona?.practice_name || 'Healthcare Practice'}
- Owner: ${business_persona?.owner_name || 'Healthcare Professional'}
- Focus: Data-driven insights for referral source optimization`;

    case 'practice_consultation':
      return `You are an AI practice management consultant specializing in healthcare referral optimization and business intelligence.

CRITICAL RESPONSE REQUIREMENTS:
- MAXIMUM 200 words total (increased for deeper analysis)
- Provide deep, data-driven insights with specific numbers and patterns
- First paragraph: Comprehensive analysis with specific metrics and trends (3-4 sentences)
- Second paragraph: Strategic recommendations with measurable outcomes (2-3 sentences)
- Third paragraph: Implementation tactics with timeframes (1-2 sentences)
- Use **bold** for key insights and metrics only
- Be analytical but conversational
- Focus on actionable business intelligence

ANALYSIS DEPTH REQUIREMENTS:
- Always reference specific data points when available
- Identify patterns, trends, and correlations in the data
- Compare performance across different dimensions (time, geography, source type)
- Quantify opportunities and risks with estimated impact
- Provide context by comparing to industry benchmarks when relevant

BUSINESS CONTEXT:
- Practice: ${business_persona?.practice_name || 'Healthcare Practice'}
- Owner: ${business_persona?.owner_name || 'Healthcare Professional'}
- Communication Style: ${communication_style || 'professional'}
- Focus: Deep analytical insights from real practice data with strategic recommendations`;

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
    case 'business_intelligence':
      return `Analyze this comprehensive practice data and provide 4-6 actionable business insights:

PRACTICE DATA SUMMARY:
- Total Referral Sources: ${context.analysis_data?.total_sources || 0}
- Total Referrals (All Time): ${context.analysis_data?.total_referrals || 0}
- Active Recent Sources: ${context.analysis_data?.last_6_months?.length || 0}
- Source Type Distribution: ${JSON.stringify(context.analysis_data?.source_types || {})}

MONTHLY TRENDS:
${context.analysis_data?.last_6_months?.map((m: any) => 
  `${m.year_month}: ${m.patient_count} patients`
).join('\n') || 'No recent data available'}

MARKETING VISITS DATA:
- Total Visits Tracked: ${context.analysis_data?.visits?.length || 0}
- Recent Visit Activity: ${context.analysis_data?.visits?.filter((v: any) => v.visited)?.length || 0}

ANALYSIS INSTRUCTION:
${prompt || `Analyze referral source distribution, performance trends, geographic patterns, and provide specific actionable recommendations. Focus on concentration risk, growth opportunities, and operational improvements.`}

RETURN FORMAT: Return only the JSON structure specified in the system prompt.`;

    case 'structured_report':
      return `Generate a structured business intelligence report analyzing this practice data:

PRACTICE DATA SUMMARY:
- Total Referral Sources: ${context.analysis_data?.total_sources || 0}
- Total Referrals (All Time): ${context.analysis_data?.total_referrals || 0}
- Active Sources (6mo): ${context.analysis_data?.last_6_months?.length || 0}
- Source Types: ${JSON.stringify(context.analysis_data?.source_types || {})}

DETAILED DATA:
${context.analysis_data?.sources?.length ? `
Sources Sample:
${context.analysis_data.sources.slice(0, 5).map((s: any) => 
  `- ${s.name}: ${s.source_type}, Active: ${s.is_active}`
).join('\n')}` : 'No sources data'}

${context.analysis_data?.last_6_months?.length ? `
Monthly Trends:
${context.analysis_data.last_6_months.map((m: any) => 
  `${m.year_month}: ${m.patient_count || 0} patients`
).join('\n')}` : 'No monthly trends data'}

${context.analysis_data?.visits?.length ? `
Marketing Activity:
- Total Visits: ${context.analysis_data.visits.length}
- Completed: ${context.analysis_data.visits.filter((v: any) => v.visited).length}
- Success Rate: ${Math.round((context.analysis_data.visits.filter((v: any) => v.visited).length / context.analysis_data.visits.length) * 100)}%` : 'No visits data'}

INSTRUCTION: Generate the exact JSON structure for all 6 sections as specified. Use real data from above to create specific, actionable insights.

${prompt || ''}`;

    case 'practice_consultation':
      return `You are answering this question about the practice: "${prompt}"

COMPREHENSIVE PRACTICE DATA AVAILABLE:

REFERRAL SOURCES (${context.practice_data?.sources?.length || 0} total):
${context.practice_data?.sources?.slice(0, 10).map((s: any) => 
  `- ${s.name} (${s.source_type}): ${s.is_active ? 'Active' : 'Inactive'}, Location: ${s.address || 'N/A'}${s.latitude && s.longitude ? `, Coordinates: ${s.latitude}, ${s.longitude}` : ''}`
).join('\n') || 'No sources data'}

MONTHLY PERFORMANCE:
${context.practice_data?.monthly_data?.slice(0, 12).map((m: any) => 
  `${m.year_month}: ${m.patient_count || 0} referrals from ${m.source_id ? 'tracked source' : 'unknown'}`
).join('\n') || 'No monthly data'}

MARKETING VISITS (${context.practice_data?.visits?.length || 0} total):
${context.practice_data?.visits?.slice(0, 8).map((v: any) => 
  `- ${new Date(v.visit_date).toLocaleDateString()}: ${v.visited ? 'Completed' : 'Planned'} visit, Rating: ${v.star_rating || 'N/A'}`
).join('\n') || 'No visit data'}

CAMPAIGNS (${context.practice_data?.campaigns?.length || 0} total):
${context.practice_data?.campaigns?.slice(0, 5).map((c: any) => 
  `- "${c.name}" (${c.status}): ${c.campaign_type} campaign, ${c.delivery_method}`
).join('\n') || 'No campaign data'}

DISCOVERED OFFICES (${context.practice_data?.discovered_offices?.length || 0} total):
${context.practice_data?.discovered_offices?.slice(0, 5).map((d: any) => 
  `- ${d.name}: ${d.office_type}, Rating: ${d.rating || 'N/A'}, ${d.imported ? 'Imported' : 'Not imported'}`
).join('\n') || 'No discovered offices'}

REVIEWS (${context.practice_data?.reviews?.length || 0} total):
${context.practice_data?.reviews?.slice(0, 5).map((r: any) => 
  `- ${r.status} review, Attention needed: ${r.needs_attention ? 'Yes' : 'No'}`
).join('\n') || 'No review data'}

ANALYTICS SUMMARY:
- Total Active Sources: ${context.practice_data?.analytics?.total_sources || 0}
- Total Referrals: ${context.practice_data?.analytics?.total_referrals || 0}
- Sources Active This Month: ${context.practice_data?.analytics?.active_sources_this_month || 0}
- Recent Marketing Visits: ${context.practice_data?.analytics?.recent_visits || 0}
- Source Distribution: ${JSON.stringify(context.practice_data?.analytics?.source_types_distribution || {})}

USER PROFILE:
${context.practice_data?.user_profile ? `
- Name: ${context.practice_data.user_profile.first_name} ${context.practice_data.user_profile.last_name}
- Role: ${context.practice_data.user_profile.role}
- Clinic: ${context.practice_data.user_profile.clinic_name || 'N/A'}` : 'Profile data not available'}

CLINIC LOCATION:
${context.practice_data?.clinic_info ? `
- Name: ${context.practice_data.clinic_info.name}
- Address: ${context.practice_data.clinic_info.address || 'N/A'}
- Coordinates: ${context.practice_data.clinic_info.latitude && context.practice_data.clinic_info.longitude ? `${context.practice_data.clinic_info.latitude}, ${context.practice_data.clinic_info.longitude}` : 'Not set'}` : 'Clinic data not available'}

AI BUSINESS PROFILE & SETTINGS:
${context.business_profile ? `
- Practice Style: ${context.business_profile.communication_style || 'professional'}
- Specialties: ${context.business_profile.specialties?.join(', ') || 'General healthcare'}
- Target Audience: ${context.business_profile.target_audience || 'Not specified'}
- Brand Voice: ${JSON.stringify(context.business_profile.brand_voice || {})}
- Competitive Advantages: ${context.business_profile.competitive_advantages?.join(', ') || 'Not specified'}
- Practice Values: ${context.business_profile.practice_values?.join(', ') || 'Not specified'}` : 'AI business profile not configured'}

AI TEMPLATES & CONTENT HISTORY:
- Active Templates: ${context.practice_data?.ai_templates?.length || 0}
- Recent AI Content Generated: ${context.practice_data?.ai_content?.length || 0}
- AI Usage (Last 30 Days): ${context.practice_data?.analytics?.ai_usage_last_30_days || 0}

IMPORTANT: Respond in exactly 2-3 paragraphs, maximum 300 words total. Use specific data points from above to support your analysis and recommendations.

USER QUESTION: ${prompt}

Provide exactly 4-6 insights, each starting with **Bold Summary:** followed by detailed analysis and specific recommendations.`;

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