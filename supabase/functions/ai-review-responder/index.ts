import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewResponseRequest {
  google_review_id: string;
  action: 'generate' | 'save' | 'approve';
  response_text?: string;
  quality_rating?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { google_review_id, action, response_text, quality_rating, review_context }: ReviewResponseRequest & { review_context?: any } = await req.json();

    if (action === 'generate') {
      // Fetch AI settings for personalized response
      const { data: aiSettings, error: aiSettingsError } = await supabase
        .from('ai_business_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (aiSettingsError) {
        console.error('Error fetching AI settings:', aiSettingsError);
      }

      // Get user profile with clinic data for practice context
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          *,
          clinics!inner(name, address)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
      }

      // Extract clinic data
      const clinicData = userProfile?.clinics as any;
      const practiceName = clinicData?.name || userProfile?.clinic_name || 'your practice';
      const practiceAddress = clinicData?.address || userProfile?.clinic_address;
      
      console.log('Practice context:', {
        practiceName,
        practiceAddress,
        hasClinic: !!clinicData,
        userId: user.id
      });
      
      // Build comprehensive business context
      const businessContext = {
        practice_name: practiceName,
        practice_address: practiceAddress,
        specialties: aiSettings?.specialties || [],
        practice_values: aiSettings?.practice_values || [],
        communication_style: aiSettings?.communication_style || 'professional',
        competitive_advantages: aiSettings?.competitive_advantages || [],
        target_audience: aiSettings?.target_audience,
        doctor_name: userProfile?.full_name || `${userProfile?.first_name} ${userProfile?.last_name}`.trim() || '',
        degrees: userProfile?.degrees,
        job_title: userProfile?.job_title,
      };

      console.log('Business context for AI:', businessContext);

      // Call AI assistant with settings
      const aiResponse = await supabase.functions.invoke('ai-assistant', {
        body: {
          task_type: 'review_response',
          ai_settings: aiSettings,
          business_context: businessContext,
          context: {
            google_review_id,
            review_text: review_context?.text || '',
            reviewer_name: review_context?.author_name || 'Valued Patient',
            rating: review_context?.rating || 5,
            ...review_context
          },
          parameters: {
            tone: aiSettings?.communication_style || 'professional',
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

      return new Response(JSON.stringify({
        response_text: aiData.content,
        content_id: savedResponse?.id,
        usage: aiData.usage,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
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

      return new Response(JSON.stringify({
        content_id: savedResponse?.id,
        status: 'saved',
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
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

      return new Response(JSON.stringify({
        status: 'approved',
        quality_rating,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in ai-review-responder:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);