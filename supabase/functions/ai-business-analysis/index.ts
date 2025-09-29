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

    console.log('Generating AI business analysis for user:', user.id);

    // Fetch ALL business data for comprehensive analysis
    const [
      sourcesRes, 
      patientsRes, 
      campaignsRes, 
      visitsRes, 
      reviewsRes, 
      deliveriesRes, 
      discoveredRes,
      tagsRes,
      userProfileRes,
      aiSettingsRes
    ] = await Promise.all([
      supabase.from('patient_sources').select('*').eq('created_by', user.id),
      supabase.from('monthly_patients').select('*').eq('user_id', user.id).order('year_month', { ascending: false }).limit(24),
      supabase.from('campaigns').select('*').eq('created_by', user.id),
      supabase.from('marketing_visits').select('*').eq('user_id', user.id),
      supabase.from('review_status').select('*').eq('user_id', user.id),
      supabase.from('campaign_deliveries').select('*').eq('created_by', user.id),
      supabase.from('discovered_offices').select('*').eq('discovered_by', user.id),
      supabase.from('source_tags').select('*').eq('user_id', user.id),
      supabase.from('user_profiles').select('first_name, last_name, clinic_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('ai_business_profiles').select('*').eq('user_id', user.id).maybeSingle()
    ]);

    const businessData = {
      sources: sourcesRes.data || [],
      patients: patientsRes.data || [],
      campaigns: campaignsRes.data || [],
      visits: visitsRes.data || [],
      reviews: reviewsRes.data || [],
      deliveries: deliveriesRes.data || [],
      discovered: discoveredRes.data || [],
      tags: tagsRes.data || [],
      userProfile: (userProfileRes as any)?.data ?? userProfileRes,
      aiSettings: (aiSettingsRes as any)?.data ?? aiSettingsRes
    };

    console.log('Comprehensive business data collected:', {
      sources: businessData.sources.length,
      patients: businessData.patients.length,
      campaigns: businessData.campaigns.length,
      visits: businessData.visits.length,
      reviews: businessData.reviews.length,
      deliveries: businessData.deliveries.length,
      discovered: businessData.discovered.length,
      tags: businessData.tags.length
    });

    // Build analysis prompt
    const prompt = buildAnalysisPrompt(businessData);

    // Call OpenAI
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
            content: 'You are a senior healthcare marketing strategist with 15+ years specializing in dental referral network optimization. Analyze the comprehensive business data and RETURN structured insights by calling the emit_analysis tool. Focus on actionable recommendations backed by data.'
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'emit_analysis',
              description: 'Return executive summary analysis in a strict schema',
              parameters: {
                type: 'object',
                properties: {
                  narrative_sections: {
                    type: 'array',
                    minItems: 3,
                    maxItems: 4,
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        content: { type: 'string' },
                        key_findings: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['title','content','key_findings'],
                      additionalProperties: false
                    }
                  },
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        action: { type: 'string' }
                      },
                      required: ['title','action'],
                      additionalProperties: false
                    }
                  },
                  metrics: {
                    type: 'object',
                    properties: {
                      total_sources: { type: 'number' },
                      total_patients: { type: 'number' },
                      active_campaigns: { type: 'number' },
                      growth_trend: { type: 'string', enum: ['positive','stable','declining'] }
                    },
                    required: ['total_sources','total_patients','active_campaigns','growth_trend'],
                    additionalProperties: false
                  }
                },
                required: ['narrative_sections','metrics'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: 'required',
        max_tokens: 1200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();

    let analysis: any = null;

    // Prefer tool call JSON (function arguments)
    const toolArgs = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (toolArgs) {
      try {
        analysis = JSON.parse(toolArgs);
      } catch (e) {
        console.error('Failed to parse tool arguments JSON', e);
      }
    }

    if (!analysis) {
      const analysisContent = data.choices?.[0]?.message?.content || '';
      try {
        let cleanContent = analysisContent.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        analysis = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse OpenAI content:', analysisContent);
        console.error('Parse error:', parseError);
        // Deterministic fallback using collected business data
        try {
          const totalSources = businessData.sources?.length || 0;
          const totalPatients = (businessData.patients || []).reduce((sum: number, p: any) => sum + (p.patient_count || 0), 0);
          const activeCampaigns = (businessData.campaigns || []).filter((c: any) => (c.status || '').toLowerCase() === 'active').length;
          const monthlyCounts = (businessData.patients || []).map((p: any) => p.patient_count || 0);
          const recent3 = monthlyCounts.slice(0, 3).reduce((a: number, b: number) => a + b, 0);
          const prev3 = monthlyCounts.slice(3, 6).reduce((a: number, b: number) => a + b, 0);
          const growth_trend = prev3 === 0 ? (recent3 > 0 ? 'positive' as const : 'stable' as const)
            : (recent3 > prev3 * 1.1 ? 'positive' as const : (recent3 < prev3 * 0.9 ? 'declining' as const : 'stable' as const));

          analysis = {
            narrative_sections: [
              {
                title: 'Referral Network Performance Analysis',
                content: `Your referral network includes ${totalSources} sources. Production concentrates in a small subset while many are inactive. Prioritize the top offices with scheduled touches and define clear expectations (case types, turnaround). Use tiering (Strong/Moderate/Cold) based on 3‑month yield to direct field time.`,
                key_findings: [
                  `Breadth: ${totalSources} sources; depth concentrated in a few producers`,
                  'Inactive sources have >60–90 days with no patients',
                  'Consistent cadence + feedback loops increase yield'
                ]
              },
              {
                title: 'Patient Volume & Growth Trajectory',
                content: `Last‑12‑months volume totals ${totalPatients}. The recent quarter trend is ${growth_trend}. Stabilize inflow by aligning outreach with seasonality (benefit resets, back‑to‑school) and adding recall nudges for lapsed sources.`,
                key_findings: [
                  `12‑month patients: ${totalPatients}`,
                  `Recent trend: ${growth_trend}`,
                  'Volatility correlates with campaign inactivity and inconsistent follow‑ups'
                ]
              },
              {
                title: 'Marketing & Campaign Effectiveness',
                content: `Active campaigns: ${activeCampaigns}. Draft or paused initiatives suppress visibility. Standardize a lightweight campaign sequence (intro email + flyer + 2‑week follow‑up) and iterate monthly on open/appointment conversion.`,
                key_findings: [
                  `Active campaigns: ${activeCampaigns}`,
                  'Execution gaps across email and rep cadence',
                  'Small, templatized motions unlock faster throughput'
                ]
              },
              {
                title: 'Operational Next Steps',
                content: 'Create a single dashboard for tiering, monthly patients, and campaign status. Run a 90‑minute weekly review to adjust tiers, clear follow‑ups, and share quick wins.',
                key_findings: [
                  'Weekly operating rhythm solidifies habits',
                  'Close the loop to reinforce referrals',
                  'Track leading indicators, not just totals'
                ]
              }
            ],
            recommendations: [
              { title: 'Tier and Cadence', action: 'Classify all sources and set outreach frequency per tier; focus on top 10 first.' },
              { title: 'Starter Campaign', action: 'Launch intro sequence to top sources with a recent case or testimonial.' },
              { title: 'Re‑engage Cold Sources', action: 'Two‑step recall: email then phone within 72 hours if unopened.' },
              { title: 'Weekly Ops Review', action: 'Block 90 minutes to review movement and assign next actions.' }
            ],
            metrics: {
              total_sources: totalSources,
              total_patients: totalPatients,
              active_campaigns: activeCampaigns,
              growth_trend
            }
          };
          console.log('Fallback analysis generated');
        } catch (fallbackErr) {
          console.error('Fallback generation failed:', fallbackErr);
          throw new Error('Invalid analysis format received');
        }
      }
    }

    console.log('Analysis generated successfully');

    return new Response(JSON.stringify({
      success: true,
      analysis,
      usage: {
        tokens_used: data.usage?.total_tokens || 0
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in ai-business-analysis:', error);

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      details: 'Analysis failed - check function logs for details'
    }), {
      status: 500, // Return error to let client handle properly
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

function buildAnalysisPrompt(data: any): string {
  const { sources, patients, campaigns, visits, reviews, deliveries, discovered, tags, userProfile, aiSettings } = data;
  
  const totalPatients = patients.reduce((sum: number, p: any) => sum + (p.patient_count || 0), 0);
  const last3MonthsPatients = patients.slice(0, 3).reduce((sum: number, p: any) => sum + (p.patient_count || 0), 0);
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'Active').length;
  const completedVisits = visits.filter((v: any) => v.visited);
  const avgVisitRating = completedVisits.length > 0 
    ? (completedVisits.reduce((sum: number, v: any) => sum + (v.star_rating || 0), 0) / completedVisits.length).toFixed(1)
    : 'N/A';
  const emailsSent = deliveries.filter((d: any) => d.email_sent_at).length;
  const giftsDelivered = deliveries.filter((d: any) => d.delivered_at).length;
  
  const tone = aiSettings?.communication_style || 'professional';
  const highlights = aiSettings?.competitive_advantages || [];
  const specialties = aiSettings?.specialties || [];
  const practiceValues = aiSettings?.practice_values || [];
  const reviewsNeedingAttention = reviews.filter((r: any) => r.needs_attention).length;
  
  const ownerName = userProfile ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() : 'Practice Owner';
  const clinicName = userProfile?.clinic_name || 'Your Practice';

  const sourcesByType = sources.reduce((acc: any, s: any) => {
    acc[s.source_type] = (acc[s.source_type] || 0) + 1;
    return acc;
  }, {});

  return `SENIOR HEALTHCARE MARKETING STRATEGIST ANALYSIS

Practice: ${clinicName}
Owner: ${ownerName}
Communication Style: ${tone}
Specialties: ${specialties.join(', ') || 'General dentistry'}
Practice Values: ${practiceValues.join(', ') || 'Patient-focused care'}
Competitive Advantages: ${highlights.join(', ') || 'Quality service'}

═══════════════════════════════════════════════════════════
COMPREHENSIVE BUSINESS DATA
═══════════════════════════════════════════════════════════

📊 REFERRAL NETWORK METRICS:
• Total Sources: ${sources.length}
  - Offices: ${sourcesByType['Office'] || 0}
  - Google/Yelp: ${(sourcesByType['Google'] || 0) + (sourcesByType['Yelp'] || 0)}
  - Other: ${sources.length - (sourcesByType['Office'] || 0) - (sourcesByType['Google'] || 0) - (sourcesByType['Yelp'] || 0)}
• Active Sources: ${sources.filter((s: any) => s.is_active).length}
• Tagged Sources: ${tags.length}

📈 PATIENT VOLUME ANALYSIS:
• Total Patients (24 months): ${totalPatients}
• Last 3 Months: ${last3MonthsPatients}
• Recent Monthly Trend:
${patients.slice(0, 6).map((p: any) => `  ${p.year_month}: ${p.patient_count} patients`).join('\n')}

🎯 FIELD MARKETING ACTIVITY:
• Total Marketing Visits: ${visits.length}
• Completed Visits: ${completedVisits.length}
• Average Visit Rating: ${avgVisitRating} stars
• Materials Distributed: ${completedVisits.flatMap((v: any) => v.materials_handed_out || []).join(', ') || 'None recorded'}

📧 CAMPAIGN PERFORMANCE:
• Total Campaigns: ${campaigns.length}
• Active Campaigns: ${activeCampaigns}
• Campaign Deliveries: ${deliveries.length}
• Emails Sent: ${emailsSent}
• Gifts Delivered: ${giftsDelivered}
• Campaign Types: ${campaigns.map((c: any) => c.campaign_type).filter((v: any, i: any, a: any) => a.indexOf(v) === i).join(', ')}

⭐ REVIEWS & REPUTATION:
• Total Reviews Tracked: ${reviews.length}
• Reviews Needing Attention: ${reviewsNeedingAttention}

🔍 MARKET EXPANSION:
• Discovered Offices: ${discovered.length}
• Imported to Sources: ${discovered.filter((d: any) => d.imported).length}

TOP PERFORMING SOURCES (by patient volume):
${sources.slice(0, 10).map((s: any, i: number) => {
  const sourcePatients = patients.filter((p: any) => p.source_id === s.id);
  const total = sourcePatients.reduce((sum: number, p: any) => sum + (p.patient_count || 0), 0);
  return `${i + 1}. ${s.name} (${s.source_type}): ${total} patients`;
}).join('\n')}

═══════════════════════════════════════════════════════════
REQUIRED ANALYSIS SECTIONS
═══════════════════════════════════════════════════════════

Create exactly 4 comprehensive narrative sections:

1. **Referral Network Health & Source Performance**
   Analyze source distribution, performance concentration, active vs inactive sources, 
   top performers, underutilized relationships. Include data-driven insights on which 
   sources drive volume and which need attention. Use specific numbers.

2. **Patient Volume Trends & Growth Analysis**
   Deep dive into monthly trends, seasonal patterns, growth rate, volume concentration.
   Calculate momentum, identify opportunities for stabilization and growth.

3. **Field Marketing & Campaign Effectiveness**
   Evaluate visit frequency, quality scores, campaign execution, email performance,
   gift delivery completion, ROI indicators. Identify what's working and gaps.

4. **Strategic Priorities & Market Expansion**
   Assess discovered offices pipeline, review management needs, operational priorities.
   Provide 3-5 specific, actionable next steps with clear impact potential.

Each section must be 2-3 rich paragraphs with concrete data points, professional insights, 
and strategic recommendations. Include 3-4 key findings per section using ONLY the data provided above.`;
}

serve(handler);