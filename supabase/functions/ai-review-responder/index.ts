import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { handleCorsPreflightRequest, createCorsResponse, validateOrigin, createOriginErrorResponse } from "../_shared/cors-config.ts";

interface ReviewResponseRequest {
  google_review_id: string;
  action: 'generate' | 'save' | 'approve';
  response_text?: string;
  quality_rating?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['POST']);
  }

  try {
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

    const { google_review_id, action, response_text, quality_rating }: ReviewResponseRequest = await req.json();

    if (action === 'generate') {
      // Get review details from Reviews page context
      // For now, we'll call the main AI assistant
      const aiResponse = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'review_response',
          context: {
            google_review_id,
            // Review details would be passed from frontend
          },
          parameters: {
            tone: 'professional and appreciative',
          }
        },
        headers: {
          Authorization: req.headers.get('Authorization')!,
        },
      });

      if (aiResponse.error) {
        throw new Error(aiResponse.error.message);
      }

      const aiData = await aiResponse.data;
      
      // Store the generated response
      const { data: savedResponse } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'review_response',
          reference_id: google_review_id,
          generated_text: aiData.content,
          status: 'generated',
          metadata: { google_review_id, task_type: 'review_response' },
        })
        .select()
        .single();

      return createCorsResponse(JSON.stringify({
        response_text: aiData.content,
        content_id: savedResponse?.id,
        usage: aiData.usage,
      }), {
        headers: { 'Content-Type': 'application/json' },
      }, req);
    }

    if (action === 'save' && response_text) {
      // Save user-edited response
      const { data: savedResponse } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'review_response',
          reference_id: google_review_id,
          generated_text: response_text,
          status: 'user_edited',
          metadata: { google_review_id, user_edited: true },
        })
        .select()
        .single();

      return createCorsResponse(JSON.stringify({
        content_id: savedResponse?.id,
        status: 'saved',
      }), {
        headers: { 'Content-Type': 'application/json' },
      }, req);
    }

    if (action === 'approve' && quality_rating) {
      // Update quality rating for the response
      const { error } = await supabase
        .from('ai_generated_content')
        .update({
          status: 'approved',
          quality_score: quality_rating,
          used: true,
        })
        .eq('reference_id', google_review_id)
        .eq('user_id', user.id)
        .eq('content_type', 'review_response');

      if (error) throw error;

      // Also update the AI usage tracking with quality rating
      await supabase
        .from('ai_usage_tracking')
        .update({ quality_rating })
        .eq('user_id', user.id)
        .eq('task_type', 'review_response')
        .order('created_at', { ascending: false })
        .limit(1);

      return createCorsResponse(JSON.stringify({
        status: 'approved',
        quality_rating,
      }), {
        headers: { 'Content-Type': 'application/json' },
      }, req);
    }

    return createCorsResponse(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }, req);

  } catch (error: any) {
    console.error('Error in ai-review-responder:', error);
    return createCorsResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }, req);
  }
};

serve(handler);