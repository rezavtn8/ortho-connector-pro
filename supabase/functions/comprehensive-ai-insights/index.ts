import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCorsPreflightRequest, createCorsResponse, validateOrigin, createOriginErrorResponse } from "../_shared/cors-config.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['POST']);
  }

  // Validate origin for browser requests
  const { isValid: originValid, origin } = validateOrigin(req);
  if (!originValid) {
    return createOriginErrorResponse(origin);
  }
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['POST']);
  }

  let supabaseClient;
  let user;

  try {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user: authUser } } = await supabaseClient.auth.getUser();
    if (!authUser) {
      throw new Error('Unauthorized');
    }
    user = authUser;

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
    console.log('Prompt prepared, calling OpenAI...');

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

    let openAIData;
    let insights;

    try {
      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Use faster model for better reliability
          messages: [
            {
              role: 'system',
              content: 'You are an expert healthcare business consultant. Analyze the provided practice data and return ONLY valid JSON with insights. No additional text, explanations, or formatting - just pure JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.7,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        console.error('OpenAI API error:', openAIResponse.status, errorText);
        throw new Error(`OpenAI API error: ${openAIResponse.status}`);
      }

      openAIData = await openAIResponse.json();
      console.log('OpenAI response received successfully');

      const content = openAIData.choices?.[0]?.message?.content;
      if (!content) {
        console.error('No content in OpenAI response:', openAIData);
        throw new Error('No content received from OpenAI');
      }

      console.log('Content length:', content.length);
      console.log('Content preview:', content.substring(0, 200) + '...');

      // Parse the JSON response with better error handling
      try {
        insights = JSON.parse(content.trim());
        console.log('JSON parsed successfully, insights count:', insights.insights?.length || 0);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Raw content:', content);
        
        // Try to extract JSON from potentially malformed response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            insights = JSON.parse(jsonMatch[0]);
            console.log('Recovered JSON from match, insights count:', insights.insights?.length || 0);
          } catch (secondParseError) {
            console.error('Failed to parse recovered JSON:', secondParseError);
            throw new Error('Unable to parse AI response as valid JSON');
          }
        } else {
          throw new Error('No valid JSON found in AI response');
        }
      }

      if (!insights.insights || !Array.isArray(insights.insights)) {
        console.error('Invalid insights structure:', insights);
        throw new Error('AI response missing required insights array');
      }

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('OpenAI request timed out');
        throw new Error('AI analysis timed out - please try again');
      }
      throw fetchError;
    }

    // Track AI usage
    await supabaseClient
      .from('ai_usage_tracking')
      .insert({
        user_id: user.id,
        task_type: 'comprehensive_business_analysis',
        model_used: 'gpt-4o-mini',
        tokens_used: openAIData.usage?.total_tokens || 0,
        estimated_cost: (openAIData.usage?.total_tokens || 0) * 0.000005, // gpt-4o-mini pricing
        success: true,
        request_data: { context_summary: 'comprehensive_platform_data' },
        response_data: { insights_count: insights.insights?.length || 0 }
      });

    return new Response(JSON.stringify({
      insights: insights.insights || [],
      metadata: {
        generated_at: new Date().toISOString(),
        model_used: 'gpt-4o-mini',
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
    return createCorsResponse(JSON.stringify({
      insights,
      trends,
      segments,
      scores,
      recommendations,
      summary,
      risk_analysis,
      benchmarks: {
        averages: {
          referrals_per_source: segments.length > 0 ? totalPatients / segments.length : 0,
          sources_active_monthly: segments.filter(s => s.value > 0).length
        }
      },
      meta: {
        generated_at: new Date().toISOString(),
        data_points: monthlyData.length,
        total_sources: segments.length,
        analysis_period: `${getStartOfRange(monthYear)} to ${monthYear}`
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    }, req);

  } catch (error: any) {
    console.error('Error in comprehensive-ai-insights function:', error);
    
    // Track failed usage
    try {
      if (supabaseClient && user) {
        await supabaseClient
          .from('ai_usage_tracking')
          .insert({
            user_id: user.id,
            task_type: 'comprehensive_business_analysis',
            model_used: 'gpt-4o-mini',
            tokens_used: 0,
            estimated_cost: 0,
            success: false,
            error_message: error.message,
            request_data: { error: 'analysis_failed' },
            response_data: null
          });
      }
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
    
    return createCorsResponse(JSON.stringify({ 
      error: error.message || 'Failed to generate insights',
      fallback: true 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }, req);
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
- Practice: ${clinic_info?.name || business_profile?.business_persona?.practice_name || 'Healthcare Practice'}
- Specialties: ${business_profile?.specialties?.join(', ') || 'General Practice'}
- Communication Style: ${business_profile?.communication_style || 'Professional'}

**KEY METRICS:**
- Total Referral Sources: ${totalSources} (${activeSources} active)
- Total Patients: ${totalPatients} (${recentPatients} in last 3 months)
- Marketing Visits: ${completedVisits}/${visits.length} completed (${pendingVisits} pending)
- Campaigns: ${activeCampaigns} active, ${completedDeliveries}/${campaign_deliveries.length} deliveries completed
- Discovered Offices: ${discovered_offices.length} found, ${discoveredNotImported} not imported
- Reviews: ${reviews.length} tracked, ${needsAttentionReviews} need attention
- AI Usage: ${ai_usage_history.length} recent uses

**ANALYSIS REQUIREMENTS:**
1. Identify 3-5 critical business insights based on patterns, problems, and opportunities in the data
2. Each insight must be SPECIFIC to this practice's data - not generic advice
3. Focus on actionable problems that need immediate attention
4. Look for cross-platform patterns (e.g., high discovery but low imports, campaign issues, referral drops)
5. Provide specific recommendations with measurable outcomes
6. Prioritize insights by business impact (high/medium/low)

**CRITICAL: Return ONLY valid JSON. No explanations, no markdown, no additional text.**

{
  "insights": [
    {
      "title": "Specific Problem/Opportunity Title",
      "priority": "high",
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