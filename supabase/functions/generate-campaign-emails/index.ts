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
  user_profile?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    job_title?: string;
    company_name?: string;
    email?: string;
  };
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

    // Get user profile info for email generation
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('first_name, last_name, phone, job_title, email, degrees, clinic_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    }

    console.log('User profile fetched:', userProfile);

    // Get clinic information if available
    let clinicInfo = null;
    if (userProfile?.clinic_id) {
      const { data: clinic } = await supabaseClient
        .from('clinics')
        .select('name, address')
        .eq('id', userProfile.clinic_id)
        .maybeSingle();
      clinicInfo = clinic;
      console.log('Clinic info fetched:', clinicInfo);
    }

    const requestData: EmailRequest = await req.json();
    const { offices, gift_bundle, campaign_name, user_name, clinic_name } = requestData;

    if (!offices || offices.length === 0) {
      console.error('No offices provided to generate-campaign-emails function');
      throw new Error("At least one office is required");
    }

    console.log(`Generating emails for ${offices.length} offices:`, offices.map(o => o.name));

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Enhanced sender information from user profile
    const firstName = userProfile?.first_name || '';
    const lastName = userProfile?.last_name || '';
    const fullName = firstName && lastName ? `${firstName} ${lastName}` : user_name || 'Healthcare Professional';
    
    // Format name with degrees if available
    const nameWithDegrees = userProfile?.degrees 
      ? `Dr. ${fullName}, ${userProfile.degrees}`
      : userProfile?.first_name ? `Dr. ${fullName}` : fullName;
    
    const jobTitle = userProfile?.job_title || 'Healthcare Professional';
    const clinicName = clinicInfo?.name || clinic_name || 'our practice';
    const phone = userProfile?.phone || '';
    const email = userProfile?.email || user.email || '';

    const senderInfo = {
      name: nameWithDegrees,
      firstName: firstName,
      jobTitle: jobTitle,
      clinic: clinicName,
      phone: phone,
      email: email
    };

    console.log('Sender info prepared:', senderInfo);

    const generatedEmails = [];

    // Generate personalized email for each office
    for (const office of offices) {
      const systemPrompt = `You are writing a professional, warm, and personalized email from ${senderInfo.name}, ${senderInfo.jobTitle} at ${senderInfo.clinic}.

The email should be:
- Professional yet warm in tone
- Specifically tailored to each office and their referral history
- Concise but engaging (2-3 paragraphs max)
- Include a proper signature with sender's credentials and contact info
- Focus on building relationships and partnership opportunities
${gift_bundle ? '- Mention the gift bundle naturally as a token of appreciation' : ''}

The subject line should be:
- Personal and relationship-focused
- Include the sender's first name for familiarity
- Reference the practice name when relevant
- Under 60 characters for optimal email client display

Always return ONLY a valid JSON object with "subject" and "body" fields.`;

      const userPrompt = `Generate a personalized email for:

Office: ${office.name}
${office.address ? `Address: ${office.address}` : ''}
Referral Relationship: ${office.referral_tier || 'New Contact'}
${office.last_referral_date ? `Last Referral: ${office.last_referral_date}` : ''}

Campaign: ${campaign_name}

Sender Information:
- Name: ${senderInfo.name}
- Title: ${senderInfo.jobTitle}
- Practice: ${senderInfo.clinic}
${senderInfo.phone ? `- Phone: ${senderInfo.phone}` : ''}
- Email: ${senderInfo.email}

${gift_bundle ? `Gift Being Delivered: ${gift_bundle.name} - ${gift_bundle.description}
Items included: ${gift_bundle.items.join(', ')}` : 'This is a relationship-building outreach without physical gifts.'}

Create a professional email that:
1. Has a personal, warm subject line including sender's first name
2. Acknowledges any existing referral relationship
3. ${gift_bundle ? 'Mentions the gift as a gesture of appreciation' : 'Focuses on partnership and collaboration opportunities'}
4. Includes a complete professional signature with:
   - Full name with degrees
   - Job title
   - Practice name
   - Phone number (if provided)
   - Email address

Subject line examples: "${senderInfo.firstName} from ${senderInfo.clinic} - Partnership Opportunity" or "${senderInfo.firstName} - Thank You from ${senderInfo.clinic}"`;

      console.log('Generating email for office:', office.name);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API error:', errorData);
        throw new Error(`Failed to generate email for ${office.name}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      let emailContent = data.choices[0].message.content;

      // Try to parse as JSON, if it fails, create a structured response
      let emailSubject = `${senderInfo.firstName} from ${senderInfo.clinic} - ${campaign_name}`;
      let emailBody = emailContent;

      try {
        const parsedEmail = JSON.parse(emailContent);
        if (parsedEmail.subject && parsedEmail.body) {
          emailSubject = parsedEmail.subject;
          emailBody = parsedEmail.body;
        }
      } catch (parseError) {
        console.warn('Failed to parse AI response as JSON, using fallback');
        // If parsing fails, ensure we have a proper signature
        if (!emailContent.includes(senderInfo.name)) {
          emailBody += `\n\nBest regards,\n\n${senderInfo.name}\n${senderInfo.jobTitle}\n${senderInfo.clinic}`;
          if (senderInfo.phone) emailBody += `\n${senderInfo.phone}`;
          emailBody += `\n${senderInfo.email}`;
        }
      }

      generatedEmails.push({
        office_id: office.id,
        office_name: office.name,
        subject: emailSubject,
        body: emailBody,
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