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

    // Establish time window for the last 12 months
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
    const startYearMonth = startDate.toISOString().slice(0, 7);

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
      supabase
        .from('monthly_patients')
        .select('*')
        .eq('user_id', user.id)
        .gte('year_month', startYearMonth)
        .order('year_month', { ascending: false }),
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
            content: `You are Nexora's in-house intelligence analyst. You interpret complex referral, campaign, and review data for dental specialists.

Your analysis must include these four narrative sections:

A. Referral Network Health
Review referral data. Write a dynamic insight that explains the story behind the numbers — which offices are driving growth, which ones are fading, and what that means for relationship health. Use confident, conversational business language. Avoid robotic repetition or bullet lists.

B. Marketing & Outreach
Analyze campaign and visit data. Instead of summarizing numbers, interpret why the marketing feels inactive or successful. Include what type of outreach seems most effective and where the team's energy should shift.

C. Growth & Forecast
Predict near-term momentum based on the last six months of activity. Mention whether the clinic seems to be in an expansion, plateau, or decline phase — and what actions could flip the trajectory.

D. Opportunity Radar
Identify underused assets or missed opportunities in the data — e.g., dormant offices, untagged sources, inactive campaigns, low review count, etc. Describe them as if you were advising the owner on "low-effort, high-impact" wins.

TONE REQUIREMENTS:
Write with an intelligent but conversational tone. Avoid corporate language and numbered "key findings." Each paragraph should feel like a natural observation from a marketing strategist who understands dentistry and referrals. Blend empathy, curiosity, and authority. Avoid lengthy repetitive words.

Analyze the comprehensive business data and RETURN structured insights by calling the emit_analysis tool.`
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'emit_analysis',
              description: 'Return executive summary analysis in a strict schema aligned to Nexora narrative style',
              parameters: {
                type: 'object',
                properties: {
                  narrative_sections: {
                    type: 'array',
                    minItems: 4,
                    maxItems: 4,
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', enum: ['Referral Network Health','Marketing & Outreach','Growth & Forecast','Opportunity Radar'] },
                        content: { type: 'string' }
                      },
                      required: ['title','content'],
                      additionalProperties: false
                    }
                  },
                  action_summary: {
                    type: 'array',
                    minItems: 3,
                    maxItems: 3,
                    items: { type: 'string' }
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
                required: ['narrative_sections','action_summary','metrics'],
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
          // Aggregate patient counts by month to avoid double-counting per-source rows
          const byMonth: Record<string, number> = {};
          (businessData.patients || []).forEach((p: any) => {
            const ym = p.year_month as string;
            const c = (p.patient_count || 0) as number;
            byMonth[ym] = (byMonth[ym] ?? 0) + c;
          });
          const monthsDesc = Object.keys(byMonth).sort().reverse();
          const last12 = monthsDesc.slice(0, 12);
          const totalPatients = last12.reduce((sum, m) => sum + (byMonth[m] || 0), 0);
          const recent3 = last12.slice(0, 3).reduce((a, m) => a + (byMonth[m] || 0), 0);
          const prev3 = last12.slice(3, 6).reduce((a, m) => a + (byMonth[m] || 0), 0);
          const growth_trend = prev3 === 0 ? (recent3 > 0 ? 'positive' as const : 'stable' as const)
            : (recent3 > prev3 * 1.1 ? 'positive' as const : (recent3 < prev3 * 0.9 ? 'declining' as const : 'stable' as const));

          analysis = {
            narrative_sections: [
              {
                title: 'Referral Network Health',
                content: `Your referral base spans ${totalSources} sources, but consistent production concentrates in a small cohort. A handful of relationships are still carrying growth while many have gone quiet. Treat this like relationship maintenance: protect the top offices with reliable touchpoints and expectations, and re‑warm lapsed partners with simple wins (case photos, turnarounds, gratitude).`
              },
              {
                title: 'Marketing & Outreach',
                content: `Campaign activity is ${((businessData.campaigns || []).filter((c: any) => (c.status || '').toLowerCase() === 'active').length > 0) ? 'present but inconsistent' : 'light'} and field visits are ${((businessData.visits || []).filter((v: any) => v.visited).length > 0) ? 'sporadic' : 'minimal'}. The efforts that move the needle pair a clear message with quick follow‑ups: a concise intro email, a helpful one‑pager, and a 2‑week check‑in tied to a case outcome. Focus energy on the 10 offices most likely to respond rather than broad, low‑touch blasts.`
              },
              {
                title: 'Growth & Forecast',
                content: `Last‑12‑months patients total ${totalPatients}. The recent quarter trend is ${growth_trend}. Momentum will improve fastest by concentrating outreach on proven believers while giving cold sources one clean re‑engagement cycle before you move on. This creates steadier month‑over‑month inflow without overextending the team.`
              },
              {
                title: 'Opportunity Radar',
                content: `Dormant or untagged sources, paused campaigns, and low review volume represent quick lifts. Tagging sources and standardizing a starter sequence surfaces who responds; a single review‑generation nudge each week compounds credibility. Remove energy sinks that don’t convert and redirect time toward the responsive middle.`
              }
            ],
            action_summary: [
              'Protect top referrers with a simple monthly cadence and fast feedback loops',
              'Run a 30‑day re‑engagement sprint on lapsed sources, then prune non‑responders',
              'Standardize one lightweight campaign and ship it to the 10 highest‑potential offices'
            ],
            metrics: {
              total_sources: totalSources,
              total_patients: totalPatients,
              active_campaigns: (businessData.campaigns || []).filter((c: any) => (c.status || '').toLowerCase() === 'active').length,
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
  
  // DEBUG LOGGING FOR PATIENT CALCULATIONS (aggregated by month)
  console.log('=== ANALYSIS PATIENT COUNT DEBUG ===');
  console.log('Total patient rows:', patients.length);
  const byMonth: Record<string, number> = {};
  (patients || []).forEach((p: any) => {
    const ym = p.year_month as string;
    const c = (p.patient_count || 0) as number;
    byMonth[ym] = (byMonth[ym] ?? 0) + c;
  });
  const monthsDesc = Object.keys(byMonth).sort().reverse();
  const last12 = monthsDesc.slice(0, 12);
  const totalPatients = last12.reduce((sum, m) => sum + (byMonth[m] || 0), 0);
  const last3MonthsPatients = last12.slice(0, 3).reduce((sum, m) => sum + (byMonth[m] || 0), 0);
  console.log('Months (desc):', monthsDesc.join(', '));
  console.log('Last 3 Months Keys:', last12.slice(0,3));
  console.log('Last 3 Months Values:', last12.slice(0,3).map(m => byMonth[m] || 0));
  console.log('Total Patients (last 12 months):', totalPatients);
  console.log('Last 3 Months Patients (aggregated):', last3MonthsPatients);
  console.log('=== END DEBUG ===');
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
• Total Patients (last 12 months): ${totalPatients}
• Last 3 Months: ${last3MonthsPatients}
• Recent Monthly Trend:
${last12.slice(0, 6).map((m: string) => `  ${m}: ${byMonth[m] || 0} patients`).join('\n')}

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
${(() => {
  const counts = new Map<string, number>();
  patients.forEach((p: any) => {
    if (p.source_id) counts.set(p.source_id, (counts.get(p.source_id) || 0) + (p.patient_count || 0));
  });
  const nameMap = new Map<string, string>(sources.map((s: any) => [s.id, s.name]));
  return Array.from(counts.entries())
    .map(([id, cnt]) => ({ id, cnt, name: nameMap.get(id) || `Source ${id.slice(0,4)}…` }))
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 10)
    .map((item, i) => `${i + 1}. ${item.name}: ${item.cnt} patients`)
    .join('\n');
})()}

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