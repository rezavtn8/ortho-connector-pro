import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIRequest {
  task_type: 'email_generation' | 'review_response' | 'content_creation' | 'analysis' | 'comprehensive_analysis' | 'business_intelligence' | 'structured_report' | 'practice_consultation' | 'quick_consultation';
  context: any;
  prompt?: string;
  parameters?: {
    tone?: string;
    length?: 'short' | 'medium' | 'long';
    style?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    console.log(`AI Assistant request for user: ${user.id}`);

    const { task_type, context, prompt, parameters } = await req.json();
    
    if (!task_type) {
      throw new Error('task_type is required');
    }

    console.log('AI Request:', {
      task_type: task_type,
      user_id: user.id
    });

    const startTime = Date.now();

    // For comprehensive analysis, fetch fresh data
    if (task_type === 'comprehensive_analysis') {
      console.log('Fetching comprehensive practice data...');
      
      // Fetch all relevant data in parallel
      const [
        sourcesResult,
        monthlyResult, 
        visitsResult,
        campaignsResult,
        deliveriesResult,
        discoveredResult,
        reviewsResult,
        userProfileResult,
        clinicResult
      ] = await Promise.all([
        supabaseClient.from('patient_sources').select('*').eq('created_by', user.id),
        supabaseClient.from('monthly_patients').select('*').eq('user_id', user.id),
        supabaseClient.from('marketing_visits').select('*').eq('user_id', user.id),
        supabaseClient.from('campaigns').select('*').eq('created_by', user.id),
        supabaseClient.from('campaign_deliveries').select('*').eq('created_by', user.id),
        supabaseClient.from('discovered_offices').select('*').eq('discovered_by', user.id),
        supabaseClient.from('review_status').select('*').eq('user_id', user.id),
        supabaseClient.from('user_profiles').select('*').eq('user_id', user.id).single(),
        supabaseClient.from('clinics').select('*').eq('owner_id', user.id).maybeSingle()
      ]);

      // Extract data with error handling
      const sources = sourcesResult.data || [];
      const monthlyData = monthlyResult.data || [];
      const visits = visitsResult.data || [];
      const campaigns = campaignsResult.data || [];
      const deliveries = deliveriesResult.data || [];
      const discoveredOffices = discoveredResult.data || [];
      const reviews = reviewsResult.data || [];
      const userProfile = userProfileResult.data;
      const clinic = clinicResult.data;

      console.log(`Data fetched: ${sources.length} sources, ${monthlyData.length} monthly records, ${visits.length} visits, ${campaigns.length} campaigns`);

      // Calculate analytics
      const currentMonth = new Date().toISOString().slice(0, 7);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Compute real analytics from data
      const totalReferrals = monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0);
      const activeSources = monthlyData.filter(m => 
        m.year_month === currentMonth && m.patient_count > 0
      ).length;
      
      const sourceTypes = sources.reduce((acc, s) => {
        acc[s.source_type] = (acc[s.source_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const recentVisits = visits.filter(v => {
        const visitDate = new Date(v.visit_date);
        return visitDate >= thirtyDaysAgo;
      }).length;

      const last6MonthsTrend = monthlyData.filter(m => {
        const monthDate = new Date(m.year_month + '-01');
        return monthDate >= sixMonthsAgo;
      });

      const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;
      const campaignSuccessRate = deliveries.length > 0 ? 
        Math.round((deliveries.filter(d => d.delivery_status === 'Completed').length / deliveries.length) * 100) : 0;

      // Build comprehensive context for AI
      const comprehensiveContext = {
        practice_info: {
          name: userProfile?.clinic_name || clinic?.name || 'Practice',
          owner: userProfile?.full_name || userProfile?.first_name || 'Owner'
        },
        analytics: {
          total_sources: sources.length,
          total_referrals: totalReferrals,
          active_sources_this_month: activeSources,
          source_types_distribution: sourceTypes,
          recent_visits: recentVisits,
          last_6_months_trend: last6MonthsTrend,
          discovered_offices_count: discoveredOffices.length,
          imported_offices: discoveredOffices.filter(d => d.imported).length,
          pending_reviews: reviews.filter(r => r.needs_attention).length,
          campaign_delivery_success_rate: campaignSuccessRate,
          active_campaigns: activeCampaigns
        },
        detailed_data: {
          sources: sources.slice(0, 10), // Sample for context
          monthly_summary: last6MonthsTrend.slice(0, 12),
          recent_visits: visits.slice(0, 5),
          campaigns: campaigns.slice(0, 5)
        }
      };

      // Update context with comprehensive data
      context.unified_data = comprehensiveContext;
    }

    // Generate appropriate system prompt
    const systemPrompt = generateSystemPrompt(task_type, context.unified_data?.practice_info);
    const userPrompt = generateUserPrompt(task_type, context, prompt, parameters);
    
    console.log('System Prompt:', systemPrompt);
    console.log('User Prompt:', userPrompt.slice(0, 500));

    // Call OpenAI API
    const { content: generatedContent, tokensUsed, modelUsed } = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    const estimatedCost = calculateCost(tokensUsed, modelUsed);

    // Track usage (with error handling for database issues)
    try {
      await supabaseClient
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
    } catch (trackingError) {
      console.warn('Failed to track AI usage:', trackingError);
      // Continue without tracking
    }

    // Store generated content (with error handling)
    try {
      await supabaseClient
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: task_type,
          reference_id: context.reference_id || null,
          generated_text: generatedContent,
          metadata: {
            model_used: modelUsed,
            tokens_used: tokensUsed,
            execution_time_ms: Date.now() - startTime,
            analytics_summary: context.unified_data?.analytics
          },
          status: 'generated'
        });
    } catch (storageError) {
      console.warn('Failed to store generated content:', storageError);
      // Continue without storage
    }

    console.log('AI response generated successfully');

    return new Response(JSON.stringify({
      content: generatedContent,
      usage: {
        tokens_used: tokensUsed,
        estimated_cost: estimatedCost,
        execution_time_ms: Date.now() - startTime
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI assistant function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to process AI request'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// OpenAI API call function
async function callOpenAI(messages: any[]): Promise<{ content: string; tokensUsed: number; modelUsed: string }> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  let generatedContent = '';
  let tokensUsed = 0;
  let modelUsed = 'gpt-4.1-2025-04-14';

  // Primary model call (GPT-4.1)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelUsed,
      messages: messages,
      max_completion_tokens: 1500,
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

  // Fallback: if primary failed or returned empty, retry with legacy gpt-4o-mini
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
        messages: messages,
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

  return { content: generatedContent, tokensUsed, modelUsed };
}

// Calculate estimated cost
function calculateCost(tokens: number, model: string): number {
  const rates = {
    'gpt-4.1-2025-04-14': 0.01,
    'gpt-4o-mini': 0.002,
    'gpt-4o': 0.03
  };
  return (tokens / 1000) * (rates[model as keyof typeof rates] || 0.01);
}

function generateSystemPrompt(taskType: string, practiceInfo: any): string {
  const practiceName = practiceInfo?.name || 'Healthcare Practice';
  const ownerName = practiceInfo?.owner || 'Practice Owner';

  switch(taskType) {
    case 'email_generation':
      return `You are a professional healthcare marketing assistant specialized in creating effective referral relationship emails.

TASK: Generate professional, personalized emails for dental/medical referral relationship building.

REQUIREMENTS:
1. Professional medical/dental tone
2. Focus on patient care and clinical excellence
3. Include clear value propositions
4. Personalize based on recipient office details
5. Include appropriate calls to action
6. Maintain HIPAA-appropriate language`;

    case 'review_response':
      return `You are a professional healthcare communication specialist focused on patient review responses.

TASK: Generate thoughtful, professional responses to patient reviews.

REQUIREMENTS:
1. Professional and empathetic tone
2. Address specific concerns mentioned in reviews
3. Thank patients for feedback
4. Maintain patient confidentiality (no specific details)
5. Demonstrate commitment to quality care
6. Invite further discussion when appropriate`;

    case 'content_creation':
      return `You are a healthcare marketing content specialist.

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

TASK: Analyze comprehensive practice data and provide actionable business insights for ${practiceName}.

ANALYSIS REQUIREMENTS:
1. Provide exactly 4-6 distinct insights as separate paragraphs
2. Each insight should start with a **bold summary** followed by detailed analysis
3. Focus on different aspects: referral patterns, marketing effectiveness, growth opportunities, operational efficiency
4. Use specific data points and percentages when available
5. Be concise but actionable - avoid generic advice
6. Prioritize insights by business impact and revenue potential

FORMAT REQUIREMENTS:
- Start each insight with **Bold Title:** then analysis
- Use natural paragraph breaks between insights
- Include specific numbers and trends where relevant
- End each insight with a clear, actionable recommendation
- Focus on realistic, implementable solutions

BUSINESS CONTEXT:
- Practice: ${practiceName}
- Owner: ${ownerName}
- Specialty: Endodontics (root canal treatments and related procedures)
- Focus: Referral source management, practice growth, and operational efficiency`;

    case 'quick_consultation':
      return `You are a healthcare practice management consultant providing quick, actionable advice for ${practiceName}.

TASK: Provide immediate, practical recommendations for practice improvement.

REQUIREMENTS:
1. Be direct and actionable
2. Focus on immediate impact solutions
3. Consider resource constraints
4. Provide 2-3 specific next steps
5. Keep responses concise but comprehensive`;

    default:
      return `You are a professional healthcare assistant helping ${practiceName} with practice management and communication.

TASK: Provide helpful, professional assistance based on the request.

REQUIREMENTS:
1. Maintain professional healthcare standards
2. Focus on practical, actionable advice
3. Consider patient care impact
4. Use appropriate medical/dental terminology
5. Provide clear, structured responses`;
  }
}

function generateUserPrompt(taskType: string, context: any, prompt: string, parameters: any): string {
  switch(taskType) {
    case 'email_generation':
      return `Generate an email based on this context:

OFFICE DETAILS:
${JSON.stringify(context.office_details || {}, null, 2)}

CAMPAIGN DETAILS:
${JSON.stringify(context.campaign_details || {}, null, 2)}

PERSONALIZATION:
${JSON.stringify(context.personalization || {}, null, 2)}

PARAMETERS:
- Length: ${parameters?.length || 'medium'}
- Style: ${parameters?.style || 'professional'}
- Tone: ${parameters?.tone || 'professional'}

SPECIFIC REQUEST: ${prompt || 'Create an effective referral relationship email.'}`;

    case 'review_response':
      return `Generate a response to this review:

REVIEW DETAILS:
${JSON.stringify(context.review_details || {}, null, 2)}

RESPONSE GUIDELINES:
${JSON.stringify(context.response_guidelines || {}, null, 2)}

PARAMETERS:
- Length: ${parameters?.length || 'medium'}
- Style: ${parameters?.style || 'professional'}
- Tone: ${parameters?.tone || 'empathetic'}

SPECIFIC REQUEST: ${prompt || 'Create a thoughtful, professional response to this review.'}`;

    case 'content_creation':
      return `Create content based on this context:

CONTENT TYPE: ${context.content_type || 'general'}
TARGET AUDIENCE: ${context.target_audience || 'healthcare professionals'}

CONTENT CONTEXT:
${JSON.stringify(context, null, 2)}

PARAMETERS:
- Length: ${parameters?.length || 'medium'}
- Style: ${parameters?.style || 'professional'}
- Tone: ${parameters?.tone || 'professional'}

PROMPT: ${prompt || 'Create appropriate content based on the context provided.'}`;

    case 'comprehensive_analysis':
    case 'business_intelligence':
      const unifiedData = context.unified_data || {};
      const analytics = unifiedData.analytics || {};
      const detailedData = unifiedData.detailed_data || {};
      
      return `Analyze this comprehensive practice data and provide 4-6 actionable business insights:

PRACTICE OVERVIEW:
Practice: ${unifiedData.practice_info?.name || 'Endodontic Practice'}
Owner: ${unifiedData.practice_info?.owner || 'Practice Owner'}
Analysis Date: ${new Date().toLocaleDateString()}

REFERRAL SOURCE ANALYSIS:
- Total Referral Sources: ${analytics.total_sources || 0}
- Total Referrals (All Time): ${analytics.total_referrals || 0}
- Active Sources This Month: ${analytics.active_sources_this_month || 0}
- Source Type Distribution: ${JSON.stringify(analytics.source_types_distribution || {})}

MONTHLY PERFORMANCE TRENDS:
${analytics.last_6_months_trend && analytics.last_6_months_trend.length > 0 
  ? analytics.last_6_months_trend
    .sort((a: any, b: any) => b.year_month.localeCompare(a.year_month))
    .slice(0, 6)
    .map((m: any) => `- ${m.year_month}: ${m.patient_count || 0} patients from source`)
    .join('\n')
  : '- No recent monthly data available'
}

MARKETING & OUTREACH STATUS:
- Total Marketing Visits Tracked: ${detailedData.recent_visits?.length || 0}
- Recent Visit Activity (30 days): ${analytics.recent_visits || 0}
- Active Campaigns: ${analytics.active_campaigns || 0}
- Campaign Delivery Success Rate: ${analytics.campaign_delivery_success_rate || 0}%

GROWTH OPPORTUNITIES:
- Discovered Potential Offices: ${analytics.discovered_offices_count || 0}
- Imported/Contacted Offices: ${analytics.imported_offices || 0}
- Reviews Needing Attention: ${analytics.pending_reviews || 0}

TOP PERFORMING SOURCES (Sample):
${detailedData.sources && detailedData.sources.length > 0
  ? detailedData.sources.slice(0, 5).map((s: any) => 
    `- ${s.name} (${s.source_type}): ${s.is_active ? 'Active' : 'Inactive'} | Rating: ${s.google_rating || 'N/A'}`
  ).join('\n')
  : '- No detailed source data available'
}

ANALYSIS INSTRUCTIONS:
1. Identify critical patterns in referral source performance and distribution
2. Highlight gaps in marketing outreach and campaign execution  
3. Assess concentration risk and diversification opportunities
4. Provide specific, actionable recommendations with clear next steps
5. Focus on revenue-generating activities and relationship building
6. Consider both short-term wins and long-term strategic growth

${prompt || 'Provide comprehensive analysis focusing on practice growth, referral optimization, and marketing effectiveness.'}

IMPORTANT: Return insights in clear, professional paragraphs with bold titles and specific recommendations.

FORMAT YOUR RESPONSE AS VALID JSON:
{
  "insights": [
    {
      "title": "Clear, Actionable Title",
      "analysis": "Detailed analysis with specific data points and implications...",
      "recommendation": "Specific, actionable recommendation with clear next steps..."
    }
  ]
}

Ensure each insight has a compelling title, thorough analysis using the provided data, and a concrete recommendation.`;

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
${context.analysis_data.visits.slice(0, 3).map((v: any) => 
  `- ${v.visit_date}: ${v.rep_name} visited (${v.visit_type})`
).join('\n')}` : 'No marketing visits data'}

REPORT REQUIREMENTS:
1. Executive Summary
2. Key Performance Indicators
3. Trend Analysis
4. Risk Assessment
5. Strategic Recommendations
6. Implementation Priorities

PROMPT: ${prompt || 'Generate a comprehensive structured report with actionable insights.'}`;

    case 'practice_consultation':
      return `Provide comprehensive practice consultation based on this data:

CONSULTATION CONTEXT:
${JSON.stringify(context, null, 2)}

CONSULTATION FOCUS AREAS:
1. Referral Source Management
2. Marketing Strategy Optimization
3. Operational Efficiency
4. Growth Opportunities
5. Risk Mitigation

SPECIFIC QUESTION/CONCERN: ${prompt || 'Provide general practice improvement recommendations.'}

Please provide detailed, actionable advice with specific next steps.`;

    case 'quick_consultation':
      return `Quick consultation request:

CONTEXT: ${JSON.stringify(context, null, 2)}

QUESTION: ${prompt || 'Provide quick practice improvement advice.'}

Provide 2-3 immediate, actionable recommendations.`;

    default:
      return `${prompt || 'Provide helpful assistance based on the provided context.'}

CONTEXT:
${JSON.stringify(context, null, 2)}`;
  }
}