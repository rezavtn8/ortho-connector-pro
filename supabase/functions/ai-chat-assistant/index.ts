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

    const { message, conversation_history } = await req.json();

    console.log('Processing chat message for user:', user.id);

    // Establish time window for comprehensive data
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
    const startYearMonth = startDate.toISOString().slice(0, 7);

    // Fetch ALL business data for comprehensive chat responses
    const [
      sourcesRes,
      patientsRes,
      campaignsRes,
      visitsRes,
      reviewsRes,
      deliveriesRes,
      discoveredRes,
      tagsRes,
      activityRes,
      userProfileRes,
      aiSettingsRes
    ] = await Promise.all([
      supabase.from('patient_sources').select('*').eq('created_by', user.id),
      supabase.from('monthly_patients').select('*').eq('user_id', user.id).gte('year_month', startYearMonth).order('year_month', { ascending: false }),
      supabase.from('campaigns').select('*').eq('created_by', user.id),
      supabase.from('marketing_visits').select('*').eq('user_id', user.id),
      supabase.from('review_status').select('*').eq('user_id', user.id),
      supabase.from('campaign_deliveries').select('*').eq('created_by', user.id),
      supabase.from('discovered_offices').select('*').eq('discovered_by', user.id),
      supabase.from('source_tags').select('*').eq('user_id', user.id),
      supabase.from('activity_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('ai_business_profiles').select('*').eq('user_id', user.id).maybeSingle()
    ]);

    // Aggregate all business data
    const sources = sourcesRes.data || [];
    const patients = patientsRes.data || [];
    const campaigns = campaignsRes.data || [];
    const visits = visitsRes.data || [];
    const reviews = reviewsRes.data || [];
    const deliveries = deliveriesRes.data || [];
    const discovered = discoveredRes.data || [];
    const tags = tagsRes.data || [];
    const activities = activityRes.data || [];
    const userProfile = (userProfileRes as any)?.data ?? userProfileRes;
    const aiSettings = (aiSettingsRes as any)?.data ?? aiSettingsRes;

    // Aggregate patient counts by month
    const byMonth: Record<string, number> = {};
    patients.forEach((p: any) => {
      const ym = p.year_month as string;
      const c = (p.patient_count || 0) as number;
      byMonth[ym] = (byMonth[ym] ?? 0) + c;
    });
    
    const ymStr = (d: Date) => d.toISOString().slice(0, 7);
    const monthsDesc = Object.keys(byMonth).sort().reverse();
    const last12 = monthsDesc.slice(0, 12);
    const totalPatients = last12.reduce((sum, m) => sum + (byMonth[m] || 0), 0);
    const last3 = last12.slice(0, 3).reduce((sum, m) => sum + (byMonth[m] || 0), 0);
    const prev3 = last12.slice(3, 6).reduce((sum, m) => sum + (byMonth[m] || 0), 0);

    // Calculate top sources with names
    const sourcePatientCounts = new Map<string, number>();
    patients.forEach((p: any) => {
      const sid = p.source_id;
      if (!sid) return;
      sourcePatientCounts.set(sid, (sourcePatientCounts.get(sid) || 0) + (p.patient_count || 0));
    });
    
    const sourceMap = new Map(sources.map((s: any) => [s.id, s.name]));
    const topPerformers = Array.from(sourcePatientCounts.entries())
      .map(([id, count]) => ({ name: sourceMap.get(id) || 'Unknown', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Campaign stats
    const campaignsByStatus: Record<string, number> = {};
    campaigns.forEach((c: any) => {
      const s = c.status || 'Unknown';
      campaignsByStatus[s] = (campaignsByStatus[s] ?? 0) + 1;
    });

    const emailsSent = deliveries.filter((d: any) => d.email_sent_at).length;
    const giftsDelivered = deliveries.filter((d: any) => d.delivered_at).length;

    // Visit stats
    const completedVisits = visits.filter((v: any) => v.visited);
    const avgRating = completedVisits.length > 0
      ? (completedVisits.reduce((sum: number, v: any) => sum + (v.star_rating || 0), 0) / completedVisits.length).toFixed(1)
      : '0';

    const last30DaysVisits = visits.filter((v: any) => {
      const vDate = new Date(v.visit_date);
      const daysDiff = (now.getTime() - vDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    }).length;

    const businessContext = {
      dataTimestamp: now.toISOString(),
      practice: {
        owner: userProfile ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() : 'Owner',
        clinicName: userProfile?.clinic_name || 'Your Practice',
        communicationStyle: aiSettings?.communication_style || 'professional',
        specialties: aiSettings?.specialties || [],
        targetAudience: aiSettings?.target_audience || 'General',
        competitiveAdvantages: aiSettings?.competitive_advantages || [],
        practiceValues: aiSettings?.practice_values || []
      },
      sources: {
        total: sources.length,
        active: sources.filter((s: any) => s.is_active).length,
        byType: sources.reduce((acc: any, s: any) => {
          acc[s.source_type] = (acc[s.source_type] || 0) + 1;
          return acc;
        }, {}),
        topPerformers,
        tagsCount: tags.length
      },
      patients: {
        total: totalPatients,
        last12Months: totalPatients,
        last3Months: last3,
        recentTrend: prev3 > 0 ? (last3 > prev3 * 1.1 ? 'growing' : last3 < prev3 * 0.9 ? 'declining' : 'stable') : 'stable',
        monthlyBreakdown: last12.slice(0, 6).map(m => ({ month: m, count: byMonth[m] || 0 }))
      },
      campaigns: {
        total: campaigns.length,
        byStatus: campaignsByStatus,
        active: campaigns.filter((c: any) => c.status === 'Active').length,
        deliveries: {
          total: deliveries.length,
          emailsSent,
          giftsDelivered
        }
      },
      fieldActivity: {
        visits: {
          total: visits.length,
          completed: completedVisits.length,
          last30Days: last30DaysVisits,
          averageRating: avgRating
        }
      },
      reviews: {
        total: reviews.length,
        needingAttention: reviews.filter((r: any) => r.needs_attention).length
      },
      discovery: {
        officesDiscovered: discovered.length,
        recentActivity: activities.slice(0, 5).map((a: any) => `${a.action_type} on ${a.resource_type}`)
      }
    };

    // Build comprehensive system prompt
    const systemContent = `You are an expert healthcare referral network consultant and AI assistant.

PRACTICE OVERVIEW:
• Practice: ${businessContext.practice.clinicName}
• Owner: ${businessContext.practice.owner}
• Communication style: ${businessContext.practice.communicationStyle}
• Specialties: ${businessContext.practice.specialties.join(', ') || 'General practice'}

CRITICAL INSTRUCTIONS:
• Use ONLY the data provided in BUSINESS CONTEXT below
• Never guess or hallucinate numbers
• Cite specific metrics when making recommendations
• Provide actionable, concise advice
• When asked about trends, reference the monthly breakdown data
• Be conversational but professional
• Keep responses focused and under 250 words

BUSINESS CONTEXT (last updated ${businessContext.dataTimestamp}):

📊 SOURCES & REFERRAL NETWORK:
• Total Sources: ${businessContext.sources.total}
• Active Sources: ${businessContext.sources.active}
• Top 10 Performers:
${topPerformers.map((p: any, i: number) => `  ${i + 1}. ${p.name}: ${p.count} patients`).join('\n')}

📈 PATIENT VOLUME:
• Total Patients (12 months): ${businessContext.patients.total}
• Last 3 Months: ${businessContext.patients.last3Months}
• Trend: ${businessContext.patients.recentTrend}
• Monthly Breakdown:
${businessContext.patients.monthlyBreakdown.map((m: any) => `  ${m.month}: ${m.count} patients`).join('\n')}

🎯 CAMPAIGNS:
• Total Campaigns: ${businessContext.campaigns.total}
• Active: ${businessContext.campaigns.active}
• Status Distribution: ${JSON.stringify(businessContext.campaigns.byStatus)}
• Deliveries: ${businessContext.campaigns.deliveries.emailsSent} emails sent, ${businessContext.campaigns.deliveries.giftsDelivered} gifts delivered

🚗 FIELD ACTIVITY:
• Total Visits: ${businessContext.fieldActivity.visits.total}
• Completed: ${businessContext.fieldActivity.visits.completed}
• Last 30 Days: ${businessContext.fieldActivity.visits.last30Days}
• Avg Rating: ${businessContext.fieldActivity.visits.averageRating}/5

⭐ REVIEWS:
• Total: ${businessContext.reviews.total}
• Needs Attention: ${businessContext.reviews.needingAttention}

🔍 DISCOVERY:
• Offices Discovered: ${businessContext.discovery.officesDiscovered}`;

    const historyMessages = Array.isArray(conversation_history) ? conversation_history : [];
    const messages = [
      { role: 'system', content: systemContent },
      ...(historyMessages.length ? historyMessages : [{ role: 'user', content: message }])
    ];

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices?.[0]?.message?.content || 'I apologize, but I was unable to process your request.';

    console.log('Chat response generated successfully');

    return new Response(JSON.stringify({
      success: true,
      response: assistantResponse,
      usage: {
        tokens_used: data.usage?.total_tokens || 0
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in ai-chat-assistant:', error);

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      response: 'I apologize, but I encountered an error. Please try again.'
    }), {
      status: 200, // Always return 200 to avoid FunctionsHttpError
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);