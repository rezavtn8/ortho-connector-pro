import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisContext {
  sources: any[];
  patients: any[];
  visits: any[];
  analysis_timestamp: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
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

    const { context }: { context: AnalysisContext } = await req.json();

    // Optimize data processing to prevent memory issues
    const processedData = processDataEfficiently(context);
    
    console.log('Processing optimized analysis for user:', user.id);
    console.log('Data summary:', {
      sources_count: processedData.sources.length,
      patients_count: processedData.patients.length,
      visits_count: processedData.visits.length
    });

    // Build optimized prompt that focuses on key insights
    const systemPrompt = buildOptimizedSystemPrompt();
    const userPrompt = buildOptimizedUserPrompt(processedData);

    console.log('System prompt length:', systemPrompt.length);
    console.log('User prompt length:', userPrompt.length);

    // Use gpt-4o-mini for better memory efficiency
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
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

    console.log('Analysis generated successfully');
    console.log('Tokens used:', tokensUsed);
    console.log('Execution time:', Date.now() - startTime, 'ms');

    // Track usage
    await supabase
      .from('ai_usage_tracking')
      .insert({
        user_id: user.id,
        task_type: 'business_intelligence',
        tokens_used: tokensUsed,
        estimated_cost: calculateCost(tokensUsed, 'gpt-4o-mini'),
        execution_time_ms: Date.now() - startTime,
        model_used: 'gpt-4o-mini',
        request_data: { 
          analysis_type: 'optimized_business_intelligence',
          data_summary: {
            sources_count: processedData.sources.length,
            patients_count: processedData.patients.length,
            visits_count: processedData.visits.length
          }
        },
        response_data: { content: generatedContent },
        success: true,
      });

    // Store generated content
    const { data: contentRecord } = await supabase
      .from('ai_generated_content')
      .insert({
        user_id: user.id,
        content_type: 'business_intelligence',
        generated_text: generatedContent,
        status: 'generated',
        metadata: { 
          analysis_type: 'optimized',
          execution_time_ms: Date.now() - startTime,
          tokens_used: tokensUsed,
          data_summary: {
            sources_count: processedData.sources.length,
            patients_count: processedData.patients.length,
            visits_count: processedData.visits.length
          }
        },
      })
      .select()
      .single();

    return new Response(JSON.stringify({
      content: generatedContent,
      content_id: contentRecord?.id,
      usage: {
        tokens_used: tokensUsed,
        estimated_cost: calculateCost(tokensUsed, 'gpt-4o-mini'),
        execution_time_ms: Date.now() - startTime,
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in optimized-ai-analysis:', error);

    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Analysis failed - please try again'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

function processDataEfficiently(context: AnalysisContext) {
  // Optimize data to prevent memory issues
  const sources = context.sources.slice(0, 50).map(s => ({
    name: s.name,
    source_type: s.source_type,
    is_active: s.is_active,
    created_at: s.created_at
  }));

  const patients = context.patients.slice(0, 200).map(p => ({
    year_month: p.year_month,
    patient_count: p.patient_count,
    source_name: p.patient_sources?.name,
    source_type: p.patient_sources?.source_type
  }));

  const visits = context.visits.slice(0, 100).map(v => ({
    visit_date: v.visit_date,
    visited: v.visited,
    visit_type: v.visit_type,
    star_rating: v.star_rating
  }));

  return { sources, patients, visits };
}

function buildOptimizedSystemPrompt(): string {
  return `You are a business intelligence AI analyst specializing in healthcare practice management.

TASK: Analyze practice data and provide 4-5 key business insights in a concise, actionable format.

REQUIREMENTS:
1. Provide exactly 4-5 distinct insights as separate sections
2. Each insight should be 2-3 sentences maximum  
3. Focus on: performance trends, source distribution, opportunities, risks
4. Use specific data points when available
5. Be actionable - avoid generic advice
6. Format as structured JSON with these fields for each insight:
   - "title": Brief descriptive title
   - "priority": "high", "medium", or "low" 
   - "summary": 1-2 sentence key finding
   - "recommendation": Specific actionable step

RESPONSE FORMAT:
Return a JSON object with an "insights" array containing 4-5 insight objects.

Example structure:
{
  "insights": [
    {
      "title": "Source Performance Analysis",
      "priority": "high",
      "summary": "Top 3 sources generate 70% of referrals but show declining trend.",
      "recommendation": "Schedule quarterly check-ins with key referring practices."
    }
  ]
}`;
}

function buildOptimizedUserPrompt(data: any): string {
  const totalSources = data.sources.length;
  const activeSources = data.sources.filter((s: any) => s.is_active).length;
  const totalPatients = data.patients.reduce((sum: number, p: any) => sum + (p.patient_count || 0), 0);
  const totalVisits = data.visits.length;
  const completedVisits = data.visits.filter((v: any) => v.visited).length;

  // Calculate recent trends (last 6 months)
  const recentPatients = data.patients
    .filter((p: any) => {
      const monthDate = new Date(p.year_month + '-01');
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return monthDate >= sixMonthsAgo;
    })
    .reduce((sum: number, p: any) => sum + (p.patient_count || 0), 0);

  // Source type distribution
  const sourceTypes = data.sources.reduce((acc: any, s: any) => {
    acc[s.source_type] = (acc[s.source_type] || 0) + 1;
    return acc;
  }, {});

  return `Analyze this healthcare practice data and provide business intelligence insights:

PRACTICE OVERVIEW:
- Total Sources: ${totalSources} (${activeSources} active)
- Total Patients (all time): ${totalPatients}
- Recent Patients (6 months): ${recentPatients}
- Marketing Visits: ${totalVisits} (${completedVisits} completed)

SOURCE DISTRIBUTION:
${Object.entries(sourceTypes).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

KEY METRICS TO ANALYZE:
1. Source performance and distribution patterns
2. Patient volume trends (recent vs historical)
3. Marketing visit effectiveness
4. Source diversification and risk factors
5. Growth opportunities and recommendations

Provide 4-5 actionable insights based on this data in the required JSON format.`;
}

function calculateCost(tokens: number, model: string): number {
  // Pricing for gpt-4o-mini (per 1000 tokens)
  const inputRate = 0.00015;  // $0.15 per 1M tokens
  const outputRate = 0.0006;  // $0.60 per 1M tokens
  
  // Rough estimate (assuming 70% input, 30% output)
  const inputTokens = Math.floor(tokens * 0.7);
  const outputTokens = Math.floor(tokens * 0.3);
  
  return ((inputTokens * inputRate) + (outputTokens * outputRate)) / 1000;
}

serve(handler);