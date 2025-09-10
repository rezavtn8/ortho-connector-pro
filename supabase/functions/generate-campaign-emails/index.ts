import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  offices: Array<{
    id: string;
    name: string;
    address?: string;
    source_type: string;
    referral_tier?: string;
    last_referral_date?: string;
  }>;
  gift_bundle?: {
    name: string;
    description: string;
    items: string[];
  };
  campaign_name: string;
  user_name?: string;
  clinic_name?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    console.log('User authenticated:', user.id);

    const requestData: EmailRequest = await req.json();
    const { offices, gift_bundle, campaign_name, user_name, clinic_name } = requestData;

    if (!offices || offices.length === 0) {
      throw new Error("At least one office is required");
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const generatedEmails = [];

    // Generate personalized email for each office
    for (const office of offices) {
      const systemPrompt = `You are a professional dental practice outreach specialist. Generate a personalized, respectful, and professional email for outreach to dental offices. The email should be:
- Short and concise (2-3 paragraphs max)
- Professional but warm in tone  
- Focused on building relationships, not being salesy
- Specific to the office and referral history
- Include mention of gift if provided
- Always end with a clear but soft call-to-action`;

      const userPrompt = `Generate a personalized email for:

Office: ${office.name}
${office.address ? `Address: ${office.address}` : ''}
Referral Tier: ${office.referral_tier || 'New Contact'}
${office.last_referral_date ? `Last Referral: ${office.last_referral_date}` : ''}

Campaign: ${campaign_name}
${user_name ? `From: ${user_name}` : ''}
${clinic_name ? `Clinic: ${clinic_name}` : ''}

${gift_bundle ? `Gift Bundle: ${gift_bundle.name} - ${gift_bundle.description}
Items included: ${gift_bundle.items.join(', ')}` : 'No physical gift included.'}

Create a professional email that acknowledges their referral history (if any), mentions the gift (if included), and focuses on relationship building. Keep it under 150 words.`;

      console.log('Generating email for office:', office.name);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API error:', errorData);
        throw new Error(`Failed to generate email for ${office.name}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const generatedEmail = data.choices[0].message.content;

      // Generate subject line
      const subjectResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: 'Generate a professional, concise email subject line (under 60 characters) for a dental office outreach email. Focus on relationship building, not sales.' 
            },
            { 
              role: 'user', 
              content: `Office: ${office.name}, Campaign: ${campaign_name}, Has Gift: ${!!gift_bundle}` 
            }
          ],
          max_tokens: 50,
          temperature: 0.5,
        }),
      });

      let emailSubject = `Partnership Opportunity - ${campaign_name}`;
      if (subjectResponse.ok) {
        const subjectData = await subjectResponse.json();
        emailSubject = subjectData.choices[0].message.content.replace(/"/g, '').trim();
      }

      generatedEmails.push({
        office_id: office.id,
        office_name: office.name,
        subject: emailSubject,
        body: generatedEmail,
        referral_tier: office.referral_tier || 'New Contact'
      });
    }

    console.log(`Generated ${generatedEmails.length} emails successfully`);

    return new Response(JSON.stringify({ 
      success: true,
      emails: generatedEmails,
      total_generated: generatedEmails.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-campaign-emails function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});