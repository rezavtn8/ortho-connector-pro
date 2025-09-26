import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BusinessContextRequest {
  action: 'build' | 'get' | 'update';
  updates?: {
    communication_style?: string;
    specialties?: string[];
    brand_voice?: any;
    practice_values?: string[];
    target_audience?: string;
    competitive_advantages?: string[];
  };
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

    const { action, updates }: BusinessContextRequest = await req.json();

    if (action === 'get') {
      // Get existing business profile
      const { data: profile } = await supabase
        .from('ai_business_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return new Response(JSON.stringify({ profile }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (action === 'update' && updates) {
      // Update existing profile
      const { data, error } = await supabase
        .from('ai_business_profiles')
        .upsert({
          user_id: user.id,
          ...updates,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ profile: data }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (action === 'build') {
      // Build comprehensive business context
      console.log('Building business context for user:', user.id);

      // Get user profile
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Get clinic information
      const { data: clinic } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', userProfile?.clinic_id)
        .single();

      // Get patient sources to understand referral network
      const { data: patientSources } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('created_by', user.id)
        .limit(100);

      // Get recent monthly patient data
      const { data: monthlyData } = await supabase
        .from('monthly_patients')
        .select('*')
        .eq('user_id', user.id)
        .order('year_month', { ascending: false })
        .limit(12);

      // Build business persona
      const businessPersona = {
        practice_name: clinic?.name || 'Practice',
        owner_name: userProfile?.full_name || `${userProfile?.first_name} ${userProfile?.last_name}`,
        owner_title: userProfile?.job_title || 'Doctor',
        degrees: userProfile?.degrees || '',
        location: clinic?.address || 'Local area',
        practice_type: 'Healthcare Practice',
        referral_network_size: patientSources?.length || 0,
        active_sources: patientSources?.filter(s => s.is_active)?.length || 0,
        recent_activity: monthlyData?.length || 0,
      };

      // Determine communication style based on role and data
      const communication_style = userProfile?.role === 'Owner' ? 'professional-authoritative' : 'professional-friendly';

      // Determine specialties based on patient sources
      const specialties = [...new Set(patientSources?.map(s => s.source_type).filter(Boolean) || [])];

      // Build brand voice
      const brand_voice = {
        tone: 'professional, warm, appreciative',
        personality: 'knowledgeable, trustworthy, collaborative',
        values: ['quality patient care', 'professional relationships', 'mutual success'],
        approach: 'relationship-focused, data-informed, respectful'
      };

      // Practice values based on healthcare focus
      const practice_values = [
        'Excellent patient care',
        'Strong professional relationships',
        'Continuous improvement',
        'Community health'
      ];

      // Target audience
      const target_audience = 'Healthcare professionals and referring practices';

      // Competitive advantages
      const competitive_advantages = [
        'Established referral network',
        'Quality patient outcomes',
        'Professional collaboration',
        'Reliable service'
      ];

      // Create or update business profile
      const { data: profile, error } = await supabase
        .from('ai_business_profiles')
        .upsert({
          user_id: user.id,
          clinic_id: userProfile?.clinic_id,
          business_persona: businessPersona,
          communication_style,
          specialties,
          brand_voice,
          practice_values,
          target_audience,
          competitive_advantages,
          last_updated: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating business profile:', error);
        throw error;
      }

      console.log('Business context built successfully');
      return new Response(JSON.stringify({ profile, generated: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in ai-business-context:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);