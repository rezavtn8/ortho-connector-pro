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
    console.log('Fetching user profile for user:', user.id);
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    console.log('User profile fetched:', JSON.stringify(userProfile, null, 2));

    // Get clinic information if available
    let clinicInfo = null;
    if (userProfile?.clinic_id) {
      console.log('Fetching clinic info for clinic_id:', userProfile.clinic_id);
      const { data: clinic, error: clinicError } = await supabaseClient
        .from('clinics')
        .select('*')
        .eq('id', userProfile.clinic_id)
        .maybeSingle();
      
      if (clinicError) {
        console.error('Error fetching clinic:', clinicError);
      } else {
        clinicInfo = clinic;
        console.log('Clinic info fetched:', JSON.stringify(clinicInfo, null, 2));
      }
    } else {
      console.log('No clinic_id found in user profile');
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
    console.log('Building sender info from profile data...');
    
    // Handle case where profile might be missing
    if (!userProfile) {
      console.warn('No user profile found, using fallback data');
    }
    
    const firstName = userProfile?.first_name || '';
    const lastName = userProfile?.last_name || '';
    const fullName = firstName && lastName ? `${firstName} ${lastName}` : user_name || 'Healthcare Professional';
    
    // Format name with degrees if available
    let nameWithDegrees = fullName;
    if (userProfile?.degrees) {
      nameWithDegrees = firstName ? `Dr. ${firstName} ${lastName}, ${userProfile.degrees}` : `Dr. ${fullName}, ${userProfile.degrees}`;
    } else if (firstName) {
      nameWithDegrees = `Dr. ${fullName}`;
    }
    
    const jobTitle = userProfile?.job_title || 'Healthcare Professional';
    const clinicName = clinicInfo?.name || clinic_name || 'our practice';
    const phone = userProfile?.phone || '';
    const email = userProfile?.email || user.email || '';

    const senderInfo = {
      name: nameWithDegrees,
      firstName: firstName || 'Dr.',
      jobTitle: jobTitle,
      clinic: clinicName,
      phone: phone,
      email: email,
      hasFullProfile: !!(userProfile?.first_name && userProfile?.last_name && userProfile?.job_title)
    };

    console.log('Final sender info:', JSON.stringify(senderInfo, null, 2));

    const generatedEmails = [];

    // Generate personalized email for each office
    for (const office of offices) {
      console.log(`Generating email for office: ${office.name} with sender info:`, senderInfo);
      
      const systemPrompt = `You are an expert healthcare marketing professional writing personalized outreach emails. You must create professional, warm, and highly personalized emails that build genuine relationships.

SENDER PROFILE:
- Name: ${senderInfo.name}
- Position: ${senderInfo.jobTitle}
- Practice: ${senderInfo.clinic}
- Has Complete Profile: ${senderInfo.hasFullProfile}

WRITING GUIDELINES:
- Use a conversational, professional tone that feels authentic and personal
- Reference specific details about the recipient office when possible
- Make the email feel like it's from a real person who cares about building relationships
- Keep emails concise (2-3 paragraphs max) but warm and engaging
- Always include a complete professional signature
- Focus on mutual benefit and collaboration, not sales
- Use natural language that sounds human, not corporate
- Be specific about next steps or follow-up

PERSONALIZATION REQUIREMENTS:
- Tailor content to the office's referral history/tier
- Use the sender's first name in subject lines for familiarity
- Reference the specific practice/clinic name naturally
- Make each email feel individually crafted, not template-based

${gift_bundle ? `GIFT CONTEXT:
This outreach includes delivering a thoughtful gift package as a gesture of appreciation and relationship building. Mention this naturally within the email context.` : `RELATIONSHIP FOCUS:
This is purely relationship-building outreach. Focus on partnership opportunities, collaboration, and building professional connections.`}

OUTPUT FORMAT:
Return ONLY a valid JSON object with exactly these fields:
{
  "subject": "Personal, engaging subject line under 60 characters",
  "body": "Complete email body with proper signature including full credentials"
}`;

      const recipientContext = `
RECIPIENT OFFICE: ${office.name}
${office.address ? `Location: ${office.address}` : ''}
Referral Relationship: ${office.referral_tier || 'New Contact'}
${office.last_referral_date ? `Last Referral Date: ${office.last_referral_date}` : 'No previous referral history'}

CAMPAIGN CONTEXT: ${campaign_name}

${gift_bundle ? `GIFT BEING DELIVERED:
- Package: ${gift_bundle.name}
- Description: ${gift_bundle.description}
- Contents: ${gift_bundle.items.join(', ')}
- Purpose: Token of appreciation for partnership` : ''}

REQUIRED SIGNATURE FORMAT:
${senderInfo.name}
${senderInfo.jobTitle}
${senderInfo.clinic}
${senderInfo.phone ? senderInfo.phone + '\n' : ''}${senderInfo.email}`;

      const emailPrompt = `Create a personalized email for this healthcare office outreach. 

${recipientContext}

Write an email that:
1. Has a warm, personal subject line that includes "${senderInfo.firstName}" 
2. Opens with genuine connection and acknowledges any existing relationship
3. ${gift_bundle ? 'Naturally mentions the gift delivery as a thoughtful gesture' : 'Focuses on building a strong professional partnership'}
4. Suggests a specific next step (brief meeting, coffee, phone call)
5. Includes the complete signature as specified above
6. Feels authentic and personally written, not template-generated

Make this email sound like it's from a real healthcare professional who genuinely wants to build a relationship with this office.`;

      console.log('Sending prompt to OpenAI for:', office.name);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Using more capable model for better personalization
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: emailPrompt }
          ],
          max_tokens: 800,
          temperature: 0.8, // Higher creativity for more personalized content
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API error:', errorData);
        throw new Error(`Failed to generate email for ${office.name}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      let emailContent = data.choices[0].message.content;
      
      console.log('Raw AI response for', office.name, ':', emailContent);

      // Parse and validate the AI response
      let emailSubject = `${senderInfo.firstName} from ${senderInfo.clinic}`;
      let emailBody = emailContent;

      try {
        const parsedEmail = JSON.parse(emailContent);
        if (parsedEmail.subject && parsedEmail.body) {
          emailSubject = parsedEmail.subject;
          emailBody = parsedEmail.body;
          console.log('Successfully parsed AI response for:', office.name);
        } else {
          console.warn('AI response missing required fields for:', office.name);
        }
      } catch (parseError) {
        console.warn('Failed to parse AI response as JSON for:', office.name, parseError);
        // Ensure we have a proper signature if parsing failed
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

      console.log(`Email generated for ${office.name}:`, { subject: emailSubject, bodyLength: emailBody.length });
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