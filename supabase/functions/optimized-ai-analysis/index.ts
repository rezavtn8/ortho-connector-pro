import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { handleCorsPreflightRequest, createCorsResponse, validateOrigin, createOriginErrorResponse } from "../_shared/cors-config.ts";

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['POST']);
  }

  // Validate origin for browser requests
  const { isValid: originValid, origin } = validateOrigin(req);
  if (!originValid) {
    return createOriginErrorResponse(origin);
  }

  const startTime = Date.now();

  try {
    console.log('Optimized AI Analysis function called');

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
      return createCorsResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }, req);
    }

    const { context } = await req.json();
    console.log('Processing analysis for user:', user.id);
    console.log('Data received:', {
      sources: context?.sources?.length || 0,
      patients: context?.patients?.length || 0,
      visits: context?.visits?.length || 0
    });

    // Optimize data to prevent memory issues
    const optimizedContext = {
      sources: (context?.sources || []).slice(0, 15),
      patients: (context?.patients || []).slice(0, 30),
      visits: (context?.visits || []).slice(0, 20)
    };

    const prompt = buildAnalysisPrompt(optimizedContext);
    console.log('Prompt prepared, calling OpenAI...');

    // Use gpt-4o-mini for efficiency
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
            content: 'You are a business analyst specializing in healthcare practice management. Provide concise, actionable insights in JSON format.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    console.log('OpenAI response received');
    console.log('Content preview:', generatedContent.substring(0, 100));

    // Track usage
    await supabase
      .from('ai_usage_tracking')
      .insert({
        user_id: user.id,
        task_type: 'business_analysis',
        tokens_used: tokensUsed,
        estimated_cost: (tokensUsed * 0.0015) / 1000, // Rough estimate for gpt-4o-mini
        execution_time_ms: Date.now() - startTime,
        model_used: 'gpt-4o-mini',
        success: true,
      });

    return createCorsResponse(JSON.stringify({
      content: generatedContent,
      usage: {
        tokens_used: tokensUsed,
        execution_time_ms: Date.now() - startTime,
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    }, req);

  } catch (error: any) {
    console.error('Error in optimized-ai-analysis:', error);

    return createCorsResponse(JSON.stringify({ 
      error: error.message,
      details: 'Analysis failed - check function logs for details'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }, req);
  }
};

function buildAnalysisPrompt(context: any): string {
  const { sources, patients, visits } = context;
  
  const totalSources = sources.length;
  const totalPatients = patients.reduce((sum: number, p: any) => sum + (p.patient_count || 0), 0);
  const totalVisits = visits.length;
  const avgPatients = totalPatients / Math.max(patients.length, 1);

  return `You are a healthcare business consultant. Perform a CRITICAL ANALYSIS of this practice's referral network. Identify specific problems and actionable solutions.

Return exactly 4 insights in this JSON format:

{
  "insights": [
    {
      "title": "Critical Issue Title",
      "priority": "high|medium|low", 
      "summary": "Direct problem assessment with data",
      "recommendation": "Specific action plan with timeline"
    }
  ]
}

PRACTICE DATA:
- Sources: ${totalSources} referral sources
- Total Patients: ${totalPatients} (avg ${avgPatients.toFixed(1)} per month)
- Marketing Visits: ${totalVisits} planned visits

SOURCE BREAKDOWN:
${sources.map((s: any) => `- ${s.name} (${s.source_type})`).slice(0, 10).join('\n')}

PATIENT TRENDS:
${patients.slice(0, 6).map((p: any) => `- ${p.year_month}: ${p.patient_count} patients`).join('\n')}

Focus on identifying PROBLEMS, GAPS, and specific SOLUTIONS. Each recommendation should include actionable next steps and measurable outcomes. Be direct about what needs to change.`;
}

serve(handler);