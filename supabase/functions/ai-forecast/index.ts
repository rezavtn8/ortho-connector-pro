import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const { refresh } = await req.json().catch(() => ({ refresh: false }));

    // Check cache first (unless refresh requested)
    if (!refresh) {
      const { data: cached } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', userId)
        .eq('content_type', 'forecast')
        .eq('status', 'generated')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const cacheAge = Date.now() - new Date(cached.created_at).getTime();
        if (cacheAge < 12 * 60 * 60 * 1000) {
          console.log('Returning cached forecast');
          return new Response(JSON.stringify({
            success: true,
            forecast: JSON.parse(cached.generated_text),
            cached: true,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // Fetch historical data
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
    const startYearMonth = startDate.toISOString().slice(0, 7);

    const [sourcesRes, patientsRes, visitsRes, campaignsRes] = await Promise.all([
      supabase.from('patient_sources').select('id, name, source_type, is_active').eq('created_by', userId),
      supabase.from('monthly_patients').select('source_id, year_month, patient_count').eq('user_id', userId).gte('year_month', startYearMonth).order('year_month'),
      supabase.from('marketing_visits').select('office_id, visit_date, visited, star_rating').eq('user_id', userId),
      supabase.from('campaigns').select('id, name, status, campaign_type, created_at').eq('created_by', userId),
    ]);

    const sources = sourcesRes.data || [];
    const patients = patientsRes.data || [];
    const visits = visitsRes.data || [];
    const campaigns = campaignsRes.data || [];

    // Compute server-side trend metrics
    const monthlyTotals: Record<string, number> = {};
    patients.forEach((p: any) => {
      monthlyTotals[p.year_month] = (monthlyTotals[p.year_month] || 0) + (p.patient_count || 0);
    });
    const sortedMonths = Object.keys(monthlyTotals).sort();

    // Per-source trends
    const sourceMap: Record<string, { name: string; type: string; months: Record<string, number> }> = {};
    sources.forEach((s: any) => { sourceMap[s.id] = { name: s.name, type: s.source_type, months: {} }; });
    patients.forEach((p: any) => {
      if (sourceMap[p.source_id]) {
        sourceMap[p.source_id].months[p.year_month] = (sourceMap[p.source_id].months[p.year_month] || 0) + (p.patient_count || 0);
      }
    });

    // Build per-source summaries
    const sourceSummaries = Object.entries(sourceMap).map(([id, s]) => {
      const months = Object.entries(s.months).sort(([a], [b]) => a.localeCompare(b));
      const last3 = months.slice(-3).reduce((sum, [, c]) => sum + c, 0);
      const prev3 = months.slice(-6, -3).reduce((sum, [, c]) => sum + c, 0);
      const changePercent = prev3 > 0 ? Math.round(((last3 - prev3) / prev3) * 100) : (last3 > 0 ? 100 : 0);
      return { id, name: s.name, type: s.type, last3, prev3, changePercent, monthlyData: months.slice(-6).map(([m, c]) => `${m}:${c}`).join(', ') };
    }).filter(s => s.last3 > 0 || s.prev3 > 0);

    const prompt = `You are an AI forecasting analyst for a dental referral network. Analyze the following data and produce a 3-month referral forecast.

MONTHLY PATIENT TOTALS (last 12 months):
${sortedMonths.map(m => `${m}: ${monthlyTotals[m]}`).join('\n')}

TOP SOURCES WITH TRENDS:
${sourceSummaries.sort((a, b) => b.last3 - a.last3).slice(0, 15).map(s => `${s.name} (${s.type}): Last 3mo=${s.last3}, Prev 3mo=${s.prev3}, Change=${s.changePercent}%, Monthly=[${s.monthlyData}]`).join('\n')}

MARKETING ACTIVITY:
• Total visits: ${visits.length}, Completed: ${visits.filter((v: any) => v.visited).length}
• Active campaigns: ${campaigns.filter((c: any) => c.status === 'Active' || c.status === 'active').length}
• Total campaigns: ${campaigns.length}

TOTAL ACTIVE SOURCES: ${sources.filter((s: any) => s.is_active).length}

Based on this data, call the emit_forecast tool with your predictions.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a dental referral forecasting AI. You analyze historical referral data and produce actionable predictions. Be specific about office names when making recommendations. Call the emit_forecast tool with your analysis.'
          },
          { role: 'user', content: prompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'emit_forecast',
            description: 'Return structured forecast data',
            parameters: {
              type: 'object',
              properties: {
                overall_forecast: {
                  type: 'object',
                  properties: {
                    next_month_predicted: { type: 'number', description: 'Predicted total patients next month' },
                    month2_predicted: { type: 'number', description: 'Predicted total patients in 2 months' },
                    month3_predicted: { type: 'number', description: 'Predicted total patients in 3 months' },
                    growth_rate_percent: { type: 'number', description: 'Projected monthly growth rate as percentage' },
                    growth_phase: { type: 'string', enum: ['expansion', 'plateau', 'decline'] },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                    summary: { type: 'string', description: 'One-paragraph forecast narrative' }
                  },
                  required: ['next_month_predicted', 'month2_predicted', 'month3_predicted', 'growth_rate_percent', 'growth_phase', 'confidence', 'summary'],
                  additionalProperties: false
                },
                source_forecasts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      source_name: { type: 'string' },
                      predicted_next_month: { type: 'number' },
                      trend: { type: 'string', enum: ['growing', 'stable', 'declining', 'at_risk'] },
                      risk_level: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
                      note: { type: 'string' }
                    },
                    required: ['source_name', 'predicted_next_month', 'trend', 'risk_level', 'note'],
                    additionalProperties: false
                  }
                },
                strategic_actions: {
                  type: 'array',
                  minItems: 3,
                  maxItems: 5,
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      category: { type: 'string', enum: ['retain', 'grow', 'reactivate', 'optimize'] }
                    },
                    required: ['title', 'description', 'priority', 'category'],
                    additionalProperties: false
                  }
                },
                risk_alerts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      source_name: { type: 'string' },
                      alert_type: { type: 'string', enum: ['declining_volume', 'gone_cold', 'inconsistent', 'new_risk'] },
                      message: { type: 'string' }
                    },
                    required: ['source_name', 'alert_type', 'message'],
                    additionalProperties: false
                  }
                },
                historical_totals: {
                  type: 'array',
                  description: 'Last 6 months of actual totals for chart',
                  items: {
                    type: 'object',
                    properties: {
                      month: { type: 'string' },
                      total: { type: 'number' }
                    },
                    required: ['month', 'total'],
                    additionalProperties: false
                  }
                }
              },
              required: ['overall_forecast', 'source_forecasts', 'strategic_actions', 'risk_alerts', 'historical_totals'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'emit_forecast' } },
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('OpenAI error:', response.status, errText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolArgs = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    
    let forecast: any;
    if (toolArgs) {
      forecast = JSON.parse(toolArgs);
    } else {
      throw new Error('No tool call response from AI');
    }

    // Ensure historical_totals is populated from actual data if AI didn't include it
    if (!forecast.historical_totals || forecast.historical_totals.length === 0) {
      forecast.historical_totals = sortedMonths.slice(-6).map(m => ({ month: m, total: monthlyTotals[m] || 0 }));
    }

    // Cache the forecast
    await supabase.from('ai_generated_content').insert({
      user_id: userId,
      content_type: 'forecast',
      generated_text: JSON.stringify(forecast),
      status: 'generated',
      metadata: { tokens_used: aiData.usage?.total_tokens || 0 }
    });

    console.log('Forecast generated successfully');

    return new Response(JSON.stringify({ success: true, forecast, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in ai-forecast:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
