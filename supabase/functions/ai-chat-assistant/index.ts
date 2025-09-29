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

    // Fetch ALL platform data for comprehensive analysis
    const [
      sourcesCountRes,
      activeSourcesCountRes,
      sourcesSampleRes,
      patientsRes,
      campaignsCountRes,
      campaignsStatusesRes,
      reviewsCountRes,
      reviewsAttentionCountRes,
      deliveriesRes,
      marketingVisitsRes,
      discoveredOfficesRes,
      userProfileRes,
      aiSettingsRes,
      tagsRes,
      activityRes
    ] = await Promise.all([
      supabase.from('patient_sources').select('*', { count: 'exact', head: true }).eq('created_by', user.id),
      supabase.from('patient_sources').select('*', { count: 'exact', head: true }).eq('created_by', user.id).eq('is_active', true),
      supabase.from('patient_sources').select('id, name, source_type, is_active').eq('created_by', user.id).order('name').limit(1000),
      supabase.from('monthly_patients').select('year_month, patient_count, source_id').eq('user_id', user.id).order('year_month', { ascending: false }).limit(24),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('created_by', user.id),
      supabase.from('campaigns').select('status, campaign_type').eq('created_by', user.id).limit(1000),
      supabase.from('review_status').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('review_status').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('needs_attention', true),
      supabase.from('campaign_deliveries').select('email_status, gift_status, delivered_at, email_sent_at').eq('created_by', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('marketing_visits').select('visited, visit_date, star_rating, materials_handed_out').eq('user_id', user.id).order('visit_date', { ascending: false }).limit(100),
      supabase.from('discovered_offices').select('*', { count: 'exact', head: true }).eq('discovered_by', user.id),
      supabase.from('user_profiles').select('first_name, last_name, clinic_id, clinic_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('ai_business_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('source_tags').select('tag_name, source_id').eq('user_id', user.id).limit(100),
      supabase.from('activity_log').select('action_type, resource_type, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
    ]);

    // Aggregate comprehensive business context
    const totalSources = sourcesCountRes.count ?? 0;
    const activeSources = activeSourcesCountRes.count ?? 0;
    const totalDiscovered = discoveredOfficesRes.count ?? 0;

    const patients = patientsRes.data || [];
    const byMonth: Record<string, number> = {};
    for (const p of patients) {
      const ym = (p as any).year_month as string;
      const count = ((p as any).patient_count ?? 0) as number;
      byMonth[ym] = (byMonth[ym] ?? 0) + count;
    }

    const now = new Date();
    const ymStr = (d: Date) => d.toISOString().slice(0,7);
    const currentYM = ymStr(now);
    const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const lastYM = ymStr(prevMonthDate);
    const currentMonthTotal = byMonth[currentYM] ?? 0;
    const lastMonthTotal = byMonth[lastYM] ?? 0;

    const last12Months: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      last12Months.push(ymStr(d));
    }
    const last12Total = last12Months.reduce((sum, key) => sum + (byMonth[key] ?? 0), 0);
    const last3Total = [currentYM, lastYM, ymStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)))]
      .reduce((sum, key) => sum + (byMonth[key] ?? 0), 0);

    const campaignsByStatus: Record<string, number> = {};
    (campaignsStatusesRes.data || []).forEach((c: any) => {
      const s = c.status || 'Unknown';
      campaignsByStatus[s] = (campaignsByStatus[s] ?? 0) + 1;
    });

    const totalCampaigns = campaignsCountRes.count ?? 0;
    const totalReviews = reviewsCountRes.count ?? 0;
    const reviewsNeedingAttention = reviewsAttentionCountRes.count ?? 0;

    const deliveries = deliveriesRes.data || [];
    const emailsSent = deliveries.filter((d: any) => d.email_sent_at).length;
    const giftsDelivered = deliveries.filter((d: any) => d.delivered_at).length;

    const visits = marketingVisitsRes.data || [];
    const completedVisits = visits.filter((v: any) => v.visited);
    const avgRating = completedVisits.length > 0 
      ? completedVisits.reduce((sum: number, v: any) => sum + (v.star_rating || 0), 0) / completedVisits.length 
      : 0;
    const last30DaysVisits = visits.filter((v: any) => {
      const vDate = new Date(v.visit_date);
      const daysDiff = (now.getTime() - vDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    }).length;

    const userProfile = (userProfileRes as any)?.data ?? userProfileRes;
    const aiSettings = (aiSettingsRes as any)?.data ?? aiSettingsRes;
    const tags = tagsRes.data || [];
    const activities = activityRes.data || [];

    // Aggregate patient counts by source across available months
    const sourcePatientCounts = new Map<string, number>();
    patients.forEach((p: any) => {
      const sid = p.source_id as string | null;
      if (!sid) return;
      sourcePatientCounts.set(sid, (sourcePatientCounts.get(sid) || 0) + (p.patient_count || 0));
    });

    // Determine top source ids and fetch their names
    const topIds = Array.from(sourcePatientCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([sid]) => sid);

    // Build a quick map from the preloaded sources list
    const preloadMap = new Map<string, string>();
    (sourcesSampleRes.data || []).forEach((s: any) => {
      if (s.id) preloadMap.set(s.id, s.name || '');
    });

    // Fetch any missing names that weren't in the preload
    const missingIds = topIds.filter((id) => !preloadMap.has(id));
    let fetchedMap = new Map<string, string>();
    if (missingIds.length) {
      const fetchRes = await supabase
        .from('patient_sources')
        .select('id, name')
        .in('id', missingIds)
        .eq('created_by', user.id);
      fetchedMap = new Map((fetchRes.data || []).map((s: any) => [s.id, s.name]));
    }

    const nameFor = (id: string) => preloadMap.get(id) || fetchedMap.get(id) || `Source ${id.slice(0, 4)}…`;

    // Compose top performers with names
    const topPerformersData = Array.from(sourcePatientCounts.entries())
      .map(([sourceId, count]) => ({ sourceName: nameFor(sourceId), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const businessContext = {
      dataTimestamp: new Date().toISOString(),
      practice: {
        owner: userProfile ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() : 'Owner',
        clinicName: userProfile?.clinic_name || 'Your Practice',
        communicationStyle: aiSettings?.communication_style || 'professional',
        competitiveAdvantages: aiSettings?.competitive_advantages || [],
        practiceValues: aiSettings?.practice_values || [],
        specialties: aiSettings?.specialties || [],
        targetAudience: aiSettings?.target_audience || 'General dentistry',
        brandVoice: aiSettings?.brand_voice || {}
      },
      sources: {
        total: totalSources,
        active: activeSources,
        byType: (sourcesSampleRes.data || []).reduce((acc: any, s: any) => {
          acc[s.source_type] = (acc[s.source_type] || 0) + 1;
          return acc;
        }, {}),
        topPerformers: topPerformersData,
        tags: tags.slice(0, 20)
      },
      patients: {
        total: patients.reduce((sum: number, p: any) => sum + (p.patient_count || 0), 0),
        last12Months: last12Total,
        last3Months: last3Total,
        currentMonth: currentMonthTotal,
        previousMonth: lastMonthTotal,
        growthRate: lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1) + '%' : 'N/A',
        monthlyTrends: last12Months.map(ym => ({ month: ym, count: byMonth[ym] || 0 }))
      },
      campaigns: {
        total: totalCampaigns,
        byStatus: campaignsByStatus,
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
          averageRating: avgRating.toFixed(1),
          materialsDistributed: completedVisits.flatMap((v: any) => v.materials_handed_out || [])
        }
      },
      reviews: {
        total: totalReviews,
        needingAttention: reviewsNeedingAttention
      },
      discovery: {
        officesDiscovered: totalDiscovered,
        recentActivity: activities.slice(0, 10)
      }
    };

    // Build conversation messages with comprehensive business context
    const systemContent = [
      'You are an expert healthcare referral network consultant and AI assistant.',
      `Practice: ${businessContext.practice.clinicName}`,
      `Owner: ${businessContext.practice.owner}`,
      `Communication style: ${businessContext.practice.communicationStyle}`,
      `Specialties: ${businessContext.practice.specialties.join(', ') || 'General practice'}`,
      '',
      'CRITICAL: Use ONLY the data in businessContext below. Never guess or hallucinate numbers.',
      'When asked about top sources, use businessContext.sources.topPerformers and display sourceName and count only (no raw IDs).',
      'When referencing time series, use patients.monthlyTrends.',
      'Provide actionable insights based on the comprehensive data available.',
      `Data last updated: ${businessContext.dataTimestamp}`,
      '',
      `BUSINESS CONTEXT (JSON):`,
      JSON.stringify(businessContext, null, 2)
    ].join('\n');

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