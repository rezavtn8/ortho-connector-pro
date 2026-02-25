import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { tiers, campaign_type, campaign_name } = await req.json();
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      throw new Error("At least one tier is required");
    }

    console.log(`Generating letter templates for tiers: ${tiers.join(', ')}`);

    // Fetch context data
    const [profileRes, clinicRes, businessProfileRes] = await Promise.all([
      supabaseClient.from('user_profiles').select('*').eq('user_id', user.id).single(),
      supabaseClient.from('clinics').select('*').eq('owner_id', user.id).maybeSingle(),
      supabaseClient.from('ai_business_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    const userProfile = profileRes.data;
    const clinic = clinicRes.data;
    const businessProfile = businessProfileRes.data;

    const senderName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'Doctor';
    const senderDegrees = userProfile?.degrees || '';
    const senderTitle = userProfile?.job_title || '';
    const clinicName = clinic?.name || 'Our Practice';
    const clinicAddress = clinic?.address || '';

    const communicationStyle = businessProfile?.communication_style || 'professional';
    const specialties = businessProfile?.specialties?.join(', ') || 'comprehensive dental care';
    const values = businessProfile?.practice_values?.join(', ') || 'patient care, quality, trust';
    const advantages = businessProfile?.competitive_advantages?.join(', ') || '';

    // Build the prompt
    const tierDescriptions = tiers.map((tier: string) => {
      switch (tier.toLowerCase()) {
        case 'vip':
          return `**VIP**: These are our most valued referral partners who send many patients regularly. Tone: deeply appreciative, warm, personal. Acknowledge their significant contribution. Express gratitude for the trust they place in us. Mention looking forward to continued partnership.`;
        case 'warm':
          return `**Warm**: Active referral sources who send patients somewhat regularly. Tone: appreciative, friendly, encouraging. Thank them for their referrals. Reinforce the relationship and express desire to support their patients even better.`;
        case 'cold':
          return `**Cold**: Offices that rarely or never refer patients. Tone: professional, introductory, value-focused. Introduce or reintroduce the practice. Highlight what makes the practice special. Offer to make referrals easy. Include a gentle call-to-action.`;
        case 'dormant':
          return `**Dormant**: Previously active referral sources who have stopped sending patients. Tone: warm but re-engaging. Acknowledge the past relationship. Express interest in reconnecting. Ask if there's anything that can be improved.`;
        default:
          return `**${tier}**: A general referral source. Tone: professional and friendly. Introduce the practice and express interest in building a referral relationship.`;
      }
    }).join('\n\n');

    const systemPrompt = `You are a professional letter writer for a dental/healthcare practice. You write formal printed letters (not emails) that will be mailed to referring offices.

Practice context:
- Practice: ${clinicName}
- Address: ${clinicAddress}
- Sender: ${senderName}${senderDegrees ? `, ${senderDegrees}` : ''}${senderTitle ? ` - ${senderTitle}` : ''}
- Specialties: ${specialties}
- Values: ${values}
${advantages ? `- Competitive advantages: ${advantages}` : ''}
- Communication style: ${communicationStyle}
- Campaign type: ${campaign_type?.replace(/_/g, ' ') || 'general outreach'}

IMPORTANT RULES:
- Use these merge placeholders in the letter body: {{doctor_name}}, {{office_name}}, {{clinic_name}}, {{sender_name}}
- Do NOT include date, address blocks, or salutation in the body - those are added by the system
- Start the body directly with the first paragraph (after "Dear Dr. X," which is added automatically)
- End with a warm closing paragraph but do NOT include "Sincerely" or signature - those are added by the system
- Write 2-3 substantial paragraphs per tier
- The letters should feel genuine and personal, not templated or generic
- Vary the language and structure between tiers significantly`;

    const userPrompt = `Generate letter body templates for the following tiers. Each letter will be personalized with the merge fields.

${tierDescriptions}

Return the results using the generate_letters tool.`;

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) throw new Error('OPENAI_API_KEY not configured');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_letters',
            description: 'Return letter body templates for each tier',
            parameters: {
              type: 'object',
              properties: {
                letters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tier: { type: 'string', description: 'The tier name (e.g. VIP, Warm, Cold, Dormant)' },
                      body: { type: 'string', description: 'The letter body with merge placeholders. No salutation or signature.' },
                    },
                    required: ['tier', 'body'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['letters'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'generate_letters' } },
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OpenAI error:', errText);
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in AI response');

    const parsed = JSON.parse(toolCall.function.arguments);
    const letters = parsed.letters;

    console.log(`Generated ${letters.length} tier templates`);

    return new Response(JSON.stringify({
      success: true,
      letters,
      context: {
        sender_name: senderName,
        sender_degrees: senderDegrees,
        sender_title: senderTitle,
        clinic_name: clinicName,
        clinic_address: clinicAddress,
        logo_url: null, // Will be fetched by frontend from clinic_brand_settings
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-campaign-letters error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
