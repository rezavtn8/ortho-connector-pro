import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { handleCorsPreflightRequest, createCorsResponse, validateOrigin, createOriginErrorResponse } from "../_shared/cors-config.ts";

interface AIRequest {
  task_type: 'chat' | 'analysis' | 'content' | 'email';
  prompt: string;
  context?: any;
  parameters?: {
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
  };
  cache_key?: string;
}

interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
  usage?: {
    tokens_used: number;
    execution_time_ms: number;
    estimated_cost: number;
  };
}

// Request deduplication map
const activeRequests = new Map<string, Promise<AIResponse>>();

// Task configuration
const TASK_CONFIG = {
  chat: { max_tokens: 500, temperature: 0.7, timeout: 15000 },
  analysis: { max_tokens: 1000, temperature: 0.3, timeout: 25000 },
  content: { max_tokens: 800, temperature: 0.5, timeout: 20000 },
  email: { max_tokens: 600, temperature: 0.4, timeout: 18000 }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['POST']);
  }

  // Validate origin
  const { isValid: originValid, origin } = validateOrigin(req);
  if (!originValid) {
    return createOriginErrorResponse(origin);
  }

  const startTime = Date.now();

  try {
    // Check required environment variables
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return createCorsResponse(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }, req);
    }

    // Parse request
    const aiRequest: AIRequest = await req.json();
    const { task_type, prompt, context, parameters = {}, cache_key } = aiRequest;

    console.log(`Unified AI Service: ${task_type} request from user ${user.id}`);

    // Validate task type
    if (!TASK_CONFIG[task_type]) {
      throw new Error(`Invalid task type: ${task_type}`);
    }

    // Generate deduplication key
    const dedupeKey = cache_key || `${user.id}-${task_type}-${JSON.stringify({ prompt, context })}`;
    
    // Check for active identical request
    if (activeRequests.has(dedupeKey)) {
      console.log('Deduplicating request:', dedupeKey);
      const result = await activeRequests.get(dedupeKey)!;
      return createCorsResponse(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      }, req);
    }

    // Create request promise and store for deduplication
    const requestPromise = processAIRequest(supabase, user.id, aiRequest, startTime);
    activeRequests.set(dedupeKey, requestPromise);

    try {
      const result = await requestPromise;
      return createCorsResponse(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      }, req);
    } finally {
      // Clean up deduplication map
      activeRequests.delete(dedupeKey);
    }

  } catch (error: any) {
    console.error('Unified AI Service Error:', error);

    // Log error to usage tracking
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token).catch(() => ({ data: { user: null } }));
      
      if (user) {
        try {
          await supabase.from('ai_usage_tracking').insert({
            user_id: user.id,
            task_type: 'error',
            tokens_used: 0,
            estimated_cost: 0,
            execution_time_ms: Date.now() - startTime,
            model_used: 'gpt-4o-mini',
            success: false,
            error_message: error.message,
          });
        } catch (logError) {
          console.error('Failed to log error:', logError);
        }
      }
    }

    const userFriendlyMessage = getUserFriendlyError(error.message);
    
    return createCorsResponse(JSON.stringify({
      success: false,
      error: userFriendlyMessage,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }, req);
  }
};

async function processAIRequest(
  supabase: any,
  userId: string,
  aiRequest: AIRequest,
  startTime: number
): Promise<AIResponse> {
  const { task_type, prompt, context, parameters = {} } = aiRequest;
  const config = TASK_CONFIG[task_type];

  // Check cache first
  const cacheResult = await checkCache(supabase, userId, task_type, prompt, context);
  if (cacheResult) {
    console.log('Cache hit for request');
    return {
      success: true,
      data: cacheResult,
      usage: {
        tokens_used: 0,
        execution_time_ms: Date.now() - startTime,
        estimated_cost: 0
      }
    };
  }

  // Get or build business profile
  const businessProfile = await getOrBuildBusinessProfile(supabase, userId);

  // Build messages based on task type
  const messages = await buildMessages(task_type, prompt, context, businessProfile);

  // Prepare OpenAI request with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: parameters.max_tokens || config.max_tokens,
        temperature: parameters.temperature || config.temperature,
        stream: parameters.stream || false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;
    const estimatedCost = (tokensUsed * 0.0015) / 1000; // gpt-4o-mini pricing

    // Cache the response
    await cacheResponse(supabase, userId, task_type, prompt, context, content);

    // Log usage
    try {
      await supabase.from('ai_usage_tracking').insert({
        user_id: userId,
        task_type,
        tokens_used: tokensUsed,
        estimated_cost: estimatedCost,
        execution_time_ms: Date.now() - startTime,
        model_used: 'gpt-4o-mini',
        success: true,
      });
    } catch (error) {
      console.error('Failed to log usage:', error);
    }

    return {
      success: true,
      data: content,
      usage: {
        tokens_used: tokensUsed,
        execution_time_ms: Date.now() - startTime,
        estimated_cost: estimatedCost
      }
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again with a shorter prompt.');
    }
    
    // Try fallback response
    const fallbackContent = getFallbackResponse(task_type);
    if (fallbackContent) {
      console.log('Using fallback response for task:', task_type);
      return {
        success: true,
        data: fallbackContent,
        usage: {
          tokens_used: 0,
          execution_time_ms: Date.now() - startTime,
          estimated_cost: 0
        }
      };
    }
    
    throw error;
  }
}

async function checkCache(
  supabase: any,
  userId: string,
  taskType: string,
  prompt: string,
  context: any
): Promise<string | null> {
  const cacheKey = generateCacheKey(taskType, prompt, context);
  
  const { data } = await supabase
    .from('ai_generated_content')
    .select('generated_text')
    .eq('user_id', userId)
    .eq('content_type', taskType)
    .eq('metadata->cache_key', cacheKey)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24 hours
    .single();

  return data?.generated_text || null;
}

async function cacheResponse(
  supabase: any,
  userId: string,
  taskType: string,
  prompt: string,
  context: any,
  content: string
): Promise<void> {
  const cacheKey = generateCacheKey(taskType, prompt, context);
  
  try {
    await supabase.from('ai_generated_content').insert({
      user_id: userId,
      content_type: taskType,
      generated_text: content,
      metadata: {
        cache_key: cacheKey,
        prompt: prompt.substring(0, 200), // Store truncated prompt for reference
        cached_at: new Date().toISOString(),
      },
      status: 'generated',
    });
  } catch (error) {
    console.error('Failed to cache response:', error);
  }
}

function generateCacheKey(taskType: string, prompt: string, context: any): string {
  const hash = btoa(JSON.stringify({ taskType, prompt, context })).replace(/[^a-zA-Z0-9]/g, '').substring(0, 50);
  return `${taskType}-${hash}`;
}

async function getOrBuildBusinessProfile(supabase: any, userId: string): Promise<any> {
  // Try to get existing business profile
  const { data: profile } = await supabase
    .from('ai_business_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profile) {
    return profile;
  }

  // Auto-build profile from user data
  console.log('Auto-building business profile for user:', userId);
  
  const [userProfileResult, sourcesResult, clinicResult] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('patient_sources').select('*').eq('created_by', userId).limit(10),
    supabase.from('clinics').select('*').eq('owner_id', userId).single(),
  ]);

  const userProfile = userProfileResult.data;
  const sources = sourcesResult.data || [];
  const clinic = clinicResult.data;

  const businessPersona = {
    practice_type: 'Healthcare Practice',
    role: userProfile?.role || 'Healthcare Professional',
    specialties: ['General Healthcare'],
    communication_style: 'professional',
    brand_voice: {
      tone: 'professional',
      style: 'caring',
      personality: 'trustworthy'
    }
  };

  // Create the profile
  const { data: newProfile } = await supabase
    .from('ai_business_profiles')
    .insert({
      user_id: userId,
      clinic_id: clinic?.id,
      business_persona: businessPersona,
      communication_style: 'professional',
      specialties: businessPersona.specialties,
      practice_values: ['Patient Care', 'Quality Service', 'Trust'],
      target_audience: 'Healthcare Professionals and Patients',
      competitive_advantages: ['Quality Care', 'Professional Service'],
      brand_voice: businessPersona.brand_voice,
    })
    .select()
    .single();

  return newProfile || businessPersona;
}

async function buildMessages(
  taskType: 'chat' | 'analysis' | 'content' | 'email',
  prompt: string,
  context: any,
  businessProfile: any
): Promise<Array<{ role: string; content: string }>> {
  const systemPrompts: Record<'chat' | 'analysis' | 'content' | 'email', string> = {
    chat: `You are a helpful AI assistant for a healthcare practice. Be conversational, helpful, and professional. Keep responses concise and friendly.`,
    
    analysis: `You are a healthcare business analyst. Provide data-driven insights and actionable recommendations. Focus on practical business improvements and growth opportunities.`,
    
    content: `You are a healthcare marketing content creator. Create engaging, professional content that builds trust and attracts patients. Follow healthcare marketing best practices.`,
    
    email: `You are a professional email writer for healthcare practices. Create personalized, engaging emails that maintain professionalism while building relationships.`
  };

  const messages = [
    {
      role: 'system',
      content: systemPrompts[taskType] + ` Practice context: ${JSON.stringify(businessProfile?.business_persona || {})}`
    },
    {
      role: 'user',
      content: context ? `Context: ${JSON.stringify(context)}\n\nRequest: ${prompt}` : prompt
    }
  ];

  return messages;
}

function getFallbackResponse(taskType: 'chat' | 'analysis' | 'content' | 'email'): string {
  const fallbacks: Record<'chat' | 'analysis' | 'content' | 'email', string> = {
    chat: "I'm here to help! Could you please rephrase your question or provide more details?",
    
    analysis: "I'm currently experiencing high demand. Please try your analysis request again in a few moments for detailed insights.",
    
    content: "Thank you for your interest in our services. We're committed to providing exceptional healthcare and building lasting relationships with our patients.",
    
    email: "Thank you for your continued partnership. We value our relationship and look forward to working together to provide excellent patient care."
  };

  return fallbacks[taskType] || "I'm currently experiencing high demand. Please try again in a few moments.";
}

function getUserFriendlyError(errorMessage: string): string {
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'Request timed out. Please try again with a shorter prompt.';
  }
  
  if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return 'AI service is currently at capacity. Please try again in a few minutes.';
  }
  
  if (errorMessage.includes('authentication') || errorMessage.includes('auth')) {
    return 'Authentication error. Please log in again.';
  }
  
  if (errorMessage.includes('OpenAI')) {
    return 'AI service temporarily unavailable. Please try again shortly.';
  }
  
  return 'Something went wrong. Please try again or contact support if the issue persists.';
}

serve(handler);