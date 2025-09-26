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

    // Get fresh business data with accurate counts
    const [
      sourcesCountRes,
      activeSourcesCountRes,
      sourcesSampleRes,
      patientsRes,
      campaignsCountRes,
      campaignsStatusesRes,
      reviewsCountRes,
      reviewsAttentionCountRes,
      emailsRes,
      profileRes
    ] = await Promise.all([
      supabase.from('patient_sources').select('*', { count: 'exact', head: true }).eq('created_by', user.id),
      supabase.from('patient_sources').select('*', { count: 'exact', head: true }).eq('created_by', user.id).eq('is_active', true),
      supabase.from('patient_sources').select('name, source_type, is_active').eq('created_by', user.id).order('name').limit(25),
      supabase.from('monthly_patients').select('year_month, patient_count').eq('user_id', user.id).order('year_month', { ascending: false }).limit(24),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('created_by', user.id),
      supabase.from('campaigns').select('status, campaign_type').eq('created_by', user.id).limit(1000),
      supabase.from('review_status').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('review_status').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('needs_attention', true),
      supabase.from('campaign_deliveries').select('email_status, delivered_at, campaign_id, office_id').eq('created_by', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('ai_business_profiles').select('communication_style, competitive_advantages, practice_values').eq('user_id', user.id).maybeSingle()
    ]);

    // Aggregate and build business context
    const totalSources = sourcesCountRes.count ?? 0;
    const activeSources = activeSourcesCountRes.count ?? 0;

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

    const campaignsByStatus: Record<string, number> = {};
    (campaignsStatusesRes.data || []).forEach((c: any) => {
      const s = c.status || 'Unknown';
      campaignsByStatus[s] = (campaignsByStatus[s] ?? 0) + 1;
    });

    const totalCampaigns = campaignsCountRes.count ?? 0;
    const totalReviews = reviewsCountRes.count ?? 0;
    const reviewsNeedingAttention = reviewsAttentionCountRes.count ?? 0;

    const businessContext = {
      totals: {
        patientSources: totalSources,
        activeSources,
        campaigns: totalCampaigns,
        reviews: totalReviews,
        reviewsNeedingAttention
      },
      patients: {
        currentMonth: currentYM,
        currentMonthTotal,
        lastMonth: lastYM,
        lastMonthTotal,
        last12Total
      },
      campaignsByStatus,
      sample: {
        sources: (sourcesSampleRes.data || []).slice(0, 5),
        recentPatients: patients.slice(0, 6),
        recentEmails: emailsRes.data || []
      },
      profile: (profileRes as any)?.data ?? profileRes ?? null
    };

    // Build conversation messages grounded on the JSON business context
    const tone = businessContext.profile?.communication_style || 'professional';
    const highlights = businessContext.profile?.competitive_advantages || [];
    const systemContent = [
      'You are a helpful AI assistant for a healthcare practice management platform.',
      `Communication tone: ${tone}`,
      `Practice highlights: ${Array.isArray(highlights) && highlights.length ? highlights.join(', ') : 'Standard healthcare practice'}`,
      'Use the JSON businessContext below to ground all numbers. Never guess; if a value is missing, say "no data".',
      `businessContext: ${JSON.stringify(businessContext)}`
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