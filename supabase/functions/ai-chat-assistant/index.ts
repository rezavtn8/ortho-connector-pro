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

    // Get fresh business data for context
    const [sourcesRes, patientsRes, campaignsRes, profileRes] = await Promise.all([
      supabase.from('patient_sources').select('name, source_type, is_active').eq('created_by', user.id).limit(20),
      supabase.from('monthly_patients').select('year_month, patient_count').eq('user_id', user.id).order('year_month', { ascending: false }).limit(6),
      supabase.from('campaigns').select('name, status, campaign_type').eq('created_by', user.id).limit(10),
      supabase.from('ai_business_profiles').select('communication_style, competitive_advantages, practice_values').eq('user_id', user.id).single()
    ]);

    const businessContext = {
      sources: sourcesRes.data || [],
      patients: patientsRes.data || [],
      campaigns: campaignsRes.data || [],
      profile: profileRes.data || null
    };

    const tone = businessContext.profile?.communication_style || 'professional';
    const highlights = businessContext.profile?.competitive_advantages || [];

    // Build conversation messages
    const messages = [
      {
        role: 'system',
        content: `You are a helpful AI assistant for a healthcare practice management platform. 
        
Communication tone: ${tone}
Practice highlights: ${highlights.join(', ') || 'Standard healthcare practice'}

Current business context:
- ${businessContext.sources.length} patient sources
- Latest patient data: ${businessContext.patients.slice(0, 3).map(p => `${p.year_month}: ${p.patient_count}`).join(', ')}  
- ${businessContext.campaigns.length} campaigns

Provide helpful, medium-length responses (2-4 sentences). Focus on actionable insights based on their actual data. Be conversational but professional.`
      },
      ...conversation_history.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
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