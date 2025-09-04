import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserData {
  offices: any[];
  monthlyPatients: any[];
  campaigns: any[];
  marketingVisits: any[];
  userProfile: any;
  recentActivity: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    console.log(`Fetching data for user: ${user.id}`);

    const { question } = await req.json();
    if (!question) {
      throw new Error('Question is required');
    }

    // Fetch user's data in parallel
    const [
      { data: offices },
      { data: monthlyPatients },
      { data: campaigns },
      { data: marketingVisits },
      { data: userProfile },
      { data: recentActivity }
    ] = await Promise.all([
      supabaseClient
        .from('patient_sources')
        .select('*')
        .eq('created_by', user.id),
      
      supabaseClient
        .from('monthly_patients')
        .select('*')
        .eq('user_id', user.id)
        .order('year_month', { ascending: false })
        .limit(12),
      
      supabaseClient
        .from('campaigns')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      
      supabaseClient
        .from('marketing_visits')
        .select('*')
        .eq('user_id', user.id)
        .order('visit_date', { ascending: false })
        .limit(20),
      
      supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      
      supabaseClient
        .from('patient_changes_log')
        .select('*')
        .eq('user_id', user.id)
        .order('changed_at', { ascending: false })
        .limit(10)
    ]);

    // Package data for Gemini
    const userData: UserData = {
      offices: offices || [],
      monthlyPatients: monthlyPatients || [],
      campaigns: campaigns || [],
      marketingVisits: marketingVisits || [],
      userProfile: userProfile || {},
      recentActivity: recentActivity || []
    };

    console.log(`Packaging data: ${userData.offices.length} offices, ${userData.monthlyPatients.length} monthly records`);

    // Create context for Gemini
    const context = `
You are a healthcare marketing analytics assistant analyzing data for ${userProfile?.clinic_name || 'a medical practice'}. 

Current Data Overview:
- Patient Sources/Offices: ${userData.offices.length} referral sources
- Monthly Patient Data: ${userData.monthlyPatients.length} months of data
- Marketing Campaigns: ${userData.campaigns.length} active campaigns
- Recent Marketing Visits: ${userData.marketingVisits.length} visits

Patient Sources Summary:
${userData.offices.map(office => `- ${office.name} (${office.source_type}): ${office.address || 'No address'}`).join('\n')}

Recent Monthly Patient Counts (last 6 months):
${userData.monthlyPatients.slice(0, 6).map(mp => `- ${mp.year_month}: ${mp.patient_count} patients from source`).join('\n')}

Marketing Campaigns:
${userData.campaigns.map(c => `- ${c.name} (${c.status}): ${c.campaign_type}`).join('\n')}

Recent Marketing Activity:
${userData.marketingVisits.slice(0, 5).map(v => `- Visit to office on ${v.visit_date}: ${v.rep_name} - ${v.visit_type}`).join('\n')}

Please provide insights, analytics, and recommendations based on this data. Focus on:
1. Patient referral trends and patterns
2. Marketing effectiveness
3. Growth opportunities
4. Data-driven recommendations

User Question: ${question}
`;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: context
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 64,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received successfully');

    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

    return new Response(
      JSON.stringify({
        response: aiResponse,
        dataContext: {
          officesCount: userData.offices.length,
          monthlyRecords: userData.monthlyPatients.length,
          campaignsCount: userData.campaigns.length,
          visitsCount: userData.marketingVisits.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in gemini-insights function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to process AI insights request'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});