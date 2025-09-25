import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log('Comprehensive AI Insights function called for user:', user.id);

    const body = await req.json();
    const { context } = body;
    console.log('Processing comprehensive analysis with data:', {
      sources: context.sources?.length || 0,
      monthly_data: context.monthly_data?.length || 0,
      visits: context.visits?.length || 0,
      campaigns: context.campaigns?.length || 0,
      discovered_offices: context.discovered_offices?.length || 0,
      reviews: context.reviews?.length || 0,
      ai_usage_history: context.ai_usage_history?.length || 0
    });

    // Build comprehensive analysis prompt
    const prompt = buildComprehensivePrompt(context);
    console.log('Prompt prepared, calling GPT-5...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are an expert healthcare business consultant and data analyst with 20+ years of experience helping medical practices optimize their referral networks, patient acquisition, and operational efficiency. You have deep expertise in healthcare marketing, practice management, and data-driven decision making.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 2000,
        response_format: { type: "json_object" }
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status} ${errorText}`);
    }

    const openAIData = await openAIResponse.json();
    console.log('GPT-5 response received');

    const content = openAIData.choices[0].message.content;
    console.log('Content preview:', content.substring(0, 100) + '...');

    // Parse the JSON response
    let insights;
    try {
      insights = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      throw new Error('Invalid AI response format');
    }

    // Track AI usage
    await supabaseClient
      .from('ai_usage_tracking')
      .insert({
        user_id: user.id,
        task_type: 'comprehensive_business_analysis',
        model_used: 'gpt-5-2025-08-07',
        tokens_used: openAIData.usage?.total_tokens || 0,
        estimated_cost: (openAIData.usage?.total_tokens || 0) * 0.00002,
        success: true,
        request_data: { context_summary: 'comprehensive_platform_data' },
        response_data: { insights_count: insights.insights?.length || 0 }
      });

    return new Response(JSON.stringify({
      insights: insights.insights || [],
      metadata: {
        generated_at: new Date().toISOString(),
        model_used: 'gpt-5-2025-08-07',
        tokens_used: openAIData.usage?.total_tokens || 0,
        data_points: {
          sources: context.sources?.length || 0,
          monthly_data: context.monthly_data?.length || 0,
          visits: context.visits?.length || 0,
          campaigns: context.campaigns?.length || 0,
          discovered_offices: context.discovered_offices?.length || 0,
          reviews: context.reviews?.length || 0
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in comprehensive-ai-insights function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate insights',
      fallback: true 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildComprehensivePrompt(context: any): string {
  const {
    sources = [],
    monthly_data = [],
    visits = [],
    campaigns = [],
    discovered_offices = [],
    reviews = [],
    campaign_deliveries = [],
    ai_usage_history = [],
    user_profile = {},
    clinic_info = {},
    business_profile = {},
    analytics = {}
  } = context;

  // Calculate key metrics for context
  const totalSources = sources.length;
  const activeSources = sources.filter((s: any) => s.is_active).length;
  const totalPatients = monthly_data.reduce((sum: number, m: any) => sum + (m.patient_count || 0), 0);
  const recentMonths = monthly_data.filter((m: any) => {
    const monthDate = new Date(m.year_month + '-01');
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return monthDate >= threeMonthsAgo;
  });
  const recentPatients = recentMonths.reduce((sum: number, m: any) => sum + (m.patient_count || 0), 0);
  
  const completedVisits = visits.filter((v: any) => v.visited).length;
  const pendingVisits = visits.length - completedVisits;
  
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'Active').length;
  const completedDeliveries = campaign_deliveries.filter((d: any) => d.delivery_status === 'Completed').length;
  
  const discoveredNotImported = discovered_offices.filter((d: any) => !d.imported).length;
  const needsAttentionReviews = reviews.filter((r: any) => r.needs_attention).length;

  return `Analyze this comprehensive healthcare practice data and identify the 3-5 most critical business insights. Be specific, actionable, and focus on problems, opportunities, and strategic recommendations.

**PRACTICE OVERVIEW:**
- Practice: ${clinic_info?.name || 'Healthcare Practice'}
- Business Profile: ${business_profile?.specialties?.join(', ') || 'General Practice'}
- Communication Style: ${business_profile?.communication_style || 'Professional'}

**KEY METRICS:**
- Total Referral Sources: ${totalSources} (${activeSources} active)
- Total Patients: ${totalPatients} (${recentPatients} in last 3 months)
- Marketing Visits: ${completedVisits}/${visits.length} completed (${pendingVisits} pending)
- Campaigns: ${activeCampaigns} active, ${completedDeliveries}/${campaign_deliveries.length} deliveries completed
- Discovered Offices: ${discovered_offices.length} found, ${discoveredNotImported} not imported
- Reviews: ${reviews.length} tracked, ${needsAttentionReviews} need attention
- AI Usage: ${ai_usage_history.length} recent uses

**DETAILED DATA FOR ANALYSIS:**

Referral Sources (${sources.length}):
${sources.slice(0, 10).map((s: any) => 
  `- ${s.name} (${s.source_type}): ${s.is_active ? 'Active' : 'Inactive'}, Rating: ${s.google_rating || 'N/A'}`
).join('\n')}

Monthly Patient Data (${monthly_data.length} records):
${monthly_data.slice(-6).map((m: any) => 
  `- ${m.year_month}: ${m.patient_count} patients`
).join('\n')}

Recent Marketing Visits (${visits.length}):
${visits.slice(-5).map((v: any) => 
  `- ${v.visit_date}: ${v.visited ? 'Completed' : 'Pending'}, Type: ${v.visit_type}, Rating: ${v.star_rating || 'N/A'}`
).join('\n')}

Campaign Performance (${campaigns.length}):
${campaigns.slice(-3).map((c: any) => 
  `- ${c.name}: Status ${c.status}, Type: ${c.campaign_type}, Deliveries: ${campaign_deliveries.filter((d: any) => d.campaign_id === c.id).length}`
).join('\n')}

Discovered Opportunities (${discovered_offices.length}):
${discovered_offices.slice(0, 5).map((d: any) => 
  `- ${d.name}: ${d.office_type}, Rating: ${d.rating || 'N/A'}, ${d.imported ? 'Imported' : 'Not Imported'}`
).join('\n')}

Reviews Status (${reviews.length}):
${reviews.slice(-3).map((r: any) => 
  `- Status: ${r.status}, Needs Attention: ${r.needs_attention ? 'Yes' : 'No'}`
).join('\n')}

**ANALYSIS REQUIREMENTS:**
1. Identify 3-5 critical business insights based on patterns, problems, and opportunities in the data
2. Each insight must be SPECIFIC to this practice's data - not generic advice
3. Focus on actionable problems that need immediate attention
4. Look for cross-platform patterns (e.g., high discovery but low imports, campaign issues, referral drops)
5. Provide specific recommendations with measurable outcomes
6. Prioritize insights by business impact (high/medium/low)

**RESPONSE FORMAT (JSON only):**
{
  "insights": [
    {
      "title": "Specific Problem/Opportunity Title",
      "priority": "high|medium|low",
      "summary": "One sentence specific problem statement with key numbers",
      "recommendation": "Specific action to take with expected outcome",
      "detailedAnalysis": "Detailed explanation of the issue, why it matters, and supporting data points from the analysis",
      "keyMetrics": ["Metric 1", "Metric 2", "Metric 3", "Metric 4"],
      "actionItems": ["Specific action 1", "Specific action 2", "Specific action 3"]
    }
  ]
}

Focus on real problems like: referral source concentration risk, declining patient volumes, poor campaign conversion, missed opportunities from discoveries, review management issues, inefficient visit completion, etc. Make each insight unique and data-driven.`;
}