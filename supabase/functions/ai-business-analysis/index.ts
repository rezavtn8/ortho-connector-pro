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

    // Fetch business data
    const [sourcesRes, patientsRes, campaignsRes, visitsRes, reviewsRes, emailsRes, profileRes] = await Promise.all([
      supabase.from('patient_sources').select('*').eq('created_by', user.id),
      supabase.from('monthly_patients').select('*').eq('user_id', user.id).order('year_month', { ascending: false }).limit(12),
      supabase.from('campaigns').select('*').eq('created_by', user.id),
      supabase.from('marketing_visits').select('*').eq('user_id', user.id),
      supabase.from('review_status').select('*').eq('user_id', user.id),
      supabase.from('campaign_deliveries').select('*').eq('created_by', user.id),
      supabase.from('ai_business_profiles').select('*').eq('user_id', user.id).single()
    ]);

    const businessData = {
      sources: sourcesRes.data || [],
      patients: patientsRes.data || [],
      campaigns: campaignsRes.data || [],
      visits: visitsRes.data || [],
      reviews: reviewsRes.data || [],
      emails: emailsRes.data || [],
      profile: profileRes.data || null
    };

    console.log('Business data collected:', {
      sources: businessData.sources.length,
      patients: businessData.patients.length,
      campaigns: businessData.campaigns.length,
      visits: businessData.visits.length,
      reviews: businessData.reviews.length,
      emails: businessData.emails.length
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
            content: `You are a senior healthcare business consultant providing executive-level analysis. Write a comprehensive consultant report with detailed sections, not brief summaries.

Response format:
{
  "narrative_sections": [
    {
      "title": "Section title",
      "content": "2-3 detailed paragraphs analyzing specific aspects with data insights, trends, and implications. Write like a consultant report - professional, detailed, and insightful.",
      "key_findings": ["bullet point finding 1", "bullet point finding 2", "bullet point finding 3"]
    }
  ],
  "recommendations": [
    {
      "title": "Recommendation title", 
      "action": "Specific actionable step with details on implementation"
    }
  ],
  "metrics": {
    "total_sources": number,
    "total_patients": number, 
    "active_campaigns": number,
    "growth_trend": "positive|stable|declining"
  }
}`
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisContent = data.choices?.[0]?.message?.content || '';
    
    let analysis;
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanContent = analysisContent.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', analysisContent);
      console.error('Parse error:', parseError);
      throw new Error('Invalid analysis format received');
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
      status: 200, // Always return 200 to avoid FunctionsHttpError
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

function buildAnalysisPrompt(data: any): string {
  const { sources, patients, campaigns, visits, reviews, emails, profile } = data;
  
  const totalPatients = patients.reduce((sum: number, p: any) => sum + (p.patient_count || 0), 0);
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'Active').length;
  const tone = profile?.communication_style || 'professional';
  const highlights = profile?.competitive_advantages || [];
  const reviewsNeedingAttention = (reviews || []).filter((r: any) => r.needs_attention).length;
  const recentEmailSends = (emails || []).filter((e: any) => e.email_status === 'sent').length;

  return `Analyze this healthcare practice data with a ${tone} tone:

PRACTICE OVERVIEW:
- Total Sources: ${sources.length}
- Total Patients (12 months): ${totalPatients}
- Active Campaigns: ${activeCampaigns}
- Marketing Visits: ${visits.length}
- Reviews (attention needed): ${reviewsNeedingAttention} of ${(reviews || []).length}
- Email deliveries (recent sent): ${recentEmailSends}

CLINIC HIGHLIGHTS: ${highlights.length > 0 ? highlights.join(', ') : 'None specified'}

PATIENT SOURCES:
${sources.slice(0, 10).map((s: any) => `- ${s.name} (${s.source_type})`).join('\n')}

PATIENT TRENDS (Recent months):
${patients.slice(0, 6).map((p: any) => `- ${p.year_month}: ${p.patient_count} patients`).join('\n')}

CAMPAIGN STATUS:
${campaigns.slice(0, 5).map((c: any) => `- ${c.name} (${c.status})`).join('\n')}

REVIEWS OVERVIEW (recent):
${(reviews || []).slice(0, 5).map((r: any) => `- ${r.status}${r.needs_attention ? ' (needs attention)' : ''}`).join('\n')}

EMAIL DELIVERY STATUS (recent):
${(emails || []).slice(0, 5).map((e: any) => `- ${e.email_status} ${e.delivered_at ? `at ${e.delivered_at}` : ''}`).join('\n')}

Write exactly 3-4 detailed narrative sections for an executive summary report covering:

1. **Referral Network Performance Analysis**: Deep dive into patient source effectiveness, identifying top performers, underperformers, and optimization opportunities with specific data points and trends.

2. **Patient Volume & Growth Trajectory**: Comprehensive analysis of patient flow patterns, seasonal variations, growth trends, and capacity utilization with strategic implications.

3. **Marketing & Campaign Effectiveness**: Detailed evaluation of current campaign performance, email delivery rates, ROI analysis, and strategic recommendations for improvement.

4. **Operational Excellence & Next Steps**: Review of overall practice performance, review management, operational efficiency, and priority action items for the next quarter.

Each section should be 2-3 paragraphs with specific data insights, professional analysis, and strategic thinking. Include 3-4 key findings per section. Write recommendations as specific, implementable actions.`;
}

serve(handler);