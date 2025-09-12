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

    // Fetch comprehensive relationship data for each office
    const officesWithData = await Promise.all(offices.map(async (office) => {
      console.log(`Fetching comprehensive data for office: ${office.name}`);
      
      // Get patient referral history from monthly_patients
      const { data: referralHistory } = await supabaseClient
        .from('monthly_patients')
        .select('year_month, patient_count')
        .eq('source_id', office.id)
        .eq('user_id', user.id)
        .order('year_month', { ascending: false });

      // Get office details from patient_sources
      const { data: officeDetails } = await supabaseClient
        .from('patient_sources')
        .select('*')
        .eq('id', office.id)
        .eq('created_by', user.id)
        .maybeSingle();

      // Get previous campaign history
      const { data: campaignHistory } = await supabaseClient
        .from('campaign_deliveries')
        .select('delivered_at, delivery_status, campaign_id, campaigns(name)')
        .eq('office_id', office.id)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Calculate referral statistics
      const totalReferrals = referralHistory?.reduce((sum, record) => sum + (record.patient_count || 0), 0) || 0;
      const recentReferrals = referralHistory?.slice(0, 6).reduce((sum, record) => sum + (record.patient_count || 0), 0) || 0;
      const lastReferralMonth = referralHistory?.find(r => r.patient_count > 0)?.year_month;
      
      // Determine relationship strength
      let relationshipStrength = 'New';
      if (totalReferrals > 20) relationshipStrength = 'Strong Partner';
      else if (totalReferrals > 10) relationshipStrength = 'Active Partner';
      else if (totalReferrals > 5) relationshipStrength = 'Growing Partner';
      else if (totalReferrals > 0) relationshipStrength = 'Occasional Partner';

      console.log(`Office ${office.name} stats:`, {
        totalReferrals,
        recentReferrals,
        lastReferralMonth,
        relationshipStrength,
        campaignCount: campaignHistory?.length || 0
      });

      return {
        ...office,
        officeDetails,
        referralHistory: referralHistory || [],
        campaignHistory: campaignHistory || [],
        stats: {
          totalReferrals,
          recentReferrals,
          lastReferralMonth,
          relationshipStrength,
          monthsActive: referralHistory?.filter(r => r.patient_count > 0).length || 0,
          averageMonthlyReferrals: referralHistory?.length > 0 ? Math.round(totalReferrals / referralHistory.length * 10) / 10 : 0
        }
      };
    }));

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
    
    const jobTitle = userProfile?.job_title || 'Healthcare Professional';
    const clinicName = clinicInfo?.name || clinic_name || 'our practice';
    const phone = userProfile?.phone || '';
    const email = userProfile?.email || user.email || '';

    const senderInfo = {
      name: fullName,
      firstName: firstName,
      lastName: lastName,
      jobTitle: jobTitle,
      clinic: clinicName,
      phone: phone,
      email: email,
      degrees: userProfile?.degrees || '',
      hasFullProfile: !!(userProfile?.first_name && userProfile?.last_name && userProfile?.job_title)
    };

    console.log('Final sender info:', JSON.stringify(senderInfo, null, 2));

    const generatedEmails = [];

    // Generate personalized email for each office with comprehensive data
    for (const office of officesWithData) {
      console.log(`Generating email for office: ${office.name} with complete relationship data`);
      console.log(`Office stats:`, office.stats);
      
      const systemPrompt = `You are an expert healthcare professional writing formal, professional, and respectful emails to referring offices. 

Write a warm and appreciative email that feels personal, not robotic. Keep it 2-4 short paragraphs.

SENDER PROFILE:
- Owner Name: ${senderInfo.firstName} ${senderInfo.lastName}
- Degrees: ${senderInfo.degrees || 'DDS'}
- Role: ${senderInfo.jobTitle}
- Practice: ${senderInfo.clinic}

EMAIL STRUCTURE RULES:
1. SALUTATION: Address recipient by last name only (no degrees). Extract likely owner name from office name. Example: "Dear Dr. [LastName],"
2. BODY: Mention their role naturally if relevant. Tailor tone based on office type:
   - VIP/Warm Office (high referrals): Express sincere gratitude, highlight past year referrals, invite feedback
   - Stable Office: Acknowledge steady collaboration, thank for reliability, offer continued partnership  
   - Declining Office: Gently note change without negativity, reassure support, invite discussion
   - Cold Office: Keep polite/professional, introduce practice value, offer resources, extend collaboration invitation
3. Use referral stats naturally, don't overload with numbers
4. Maintain warm professional tone (formal but friendly with gratitude)
5. SIGNATURE: Always include sender's full name WITH degrees, role, practice name, and end with mention of recipient office name

${gift_bundle ? `GIFT CONTEXT: Mention the thoughtful gift delivery as appreciation for partnership.` : `RELATIONSHIP FOCUS: Focus on strengthening professional partnerships.`}

OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "subject": "Professional subject line under 60 characters",
  "body": "Complete email with proper salutation and signature"
}`;

      const comprehensiveContext = `
RECIPIENT OFFICE: ${office.name}
${office.address ? `Location: ${office.address}` : ''}
Office Type: ${office.officeDetails?.source_type || 'Healthcare Office'}

REFERRAL RELATIONSHIP DATA:
- Relationship Strength: ${office.stats.relationshipStrength}
- Total Patients Referred: ${office.stats.totalReferrals}
- Recent Referrals (6 months): ${office.stats.recentReferrals}
- Months Active: ${office.stats.monthsActive}
- Average Monthly Referrals: ${office.stats.averageMonthlyReferrals}
- Last Referral Month: ${office.stats.lastReferralMonth || 'No previous referrals'}
- Previous Campaign Interactions: ${office.campaignHistory.length}

CAMPAIGN CONTEXT: ${campaign_name}

${gift_bundle ? `GIFT BEING DELIVERED:
- Package: ${gift_bundle.name}
- Description: ${gift_bundle.description}
- Contents: ${gift_bundle.items.join(', ')}
- Purpose: Token of appreciation for partnership and referrals` : ''}

REQUIRED SIGNATURE FORMAT:
${senderInfo.name}
${senderInfo.jobTitle}
${senderInfo.clinic}
${senderInfo.phone ? senderInfo.phone + '\n' : ''}${senderInfo.email}`;

      const intelligentPrompt = `Create a formal, professional, and respectful email following the exact structure specified.

RECIPIENT OFFICE DETAILS:
- Office Name: ${office.name}
- Owner/Contact: [Determine from office name - extract likely owner name]
- Office Type: ${office.stats.relationshipStrength}
- Total Referrals: ${office.stats.totalReferrals}
- Recent Referrals (6 months): ${office.stats.recentReferrals}
- Last Referral: ${office.stats.lastReferralMonth || 'No recent referrals'}
${office.address ? `- Location: ${office.address}` : ''}

CAMPAIGN: ${campaign_name}
${gift_bundle ? `GIFT DELIVERY: ${gift_bundle.name} - ${gift_bundle.description}` : ''}

EMAIL REQUIREMENTS:
1. Salutation: "Dear Dr. [LastName]," (name only, no degrees)
2. Body (2-4 short paragraphs):
   ${office.stats.relationshipStrength === 'Strong Partner' || office.stats.relationshipStrength === 'Active Partner' ? 
     '- Express sincere gratitude for their ' + office.stats.totalReferrals + ' referrals' :
   office.stats.relationshipStrength === 'Growing Partner' ? 
     '- Acknowledge steady collaboration and reliability' :
   office.stats.relationshipStrength === 'Occasional Partner' ? 
     '- Gently note change in referral pattern, offer support' :
     '- Professional introduction, offer practice value and resources'}
   - Use referral data naturally (don't overwhelm with numbers)
   - ${gift_bundle ? 'Mention gift delivery as appreciation' : 'Focus on partnership strengthening'}
3. Signature: 
   ${senderInfo.name}${senderInfo.degrees ? ', ' + senderInfo.degrees : ''}
   ${senderInfo.jobTitle}
   ${senderInfo.clinic}
   ${senderInfo.phone ? senderInfo.phone : ''}
   ${senderInfo.email}
   
   "We look forward to continuing our partnership with ${office.name}."

Write this as a polished, personal letter for this specific office. Avoid generic phrasing.`;

      console.log('Sending prompt to OpenAI for:', office.name);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-2025-08-07',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: intelligentPrompt }
          ],
          max_completion_tokens: 1000,
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
          emailBody += `\n\nBest regards,\n\n${senderInfo.name}${senderInfo.degrees ? ', ' + senderInfo.degrees : ''}\n${senderInfo.jobTitle}\n${senderInfo.clinic}`;
          if (senderInfo.phone) emailBody += `\n${senderInfo.phone}`;
          emailBody += `\n${senderInfo.email}`;
          emailBody += `\n\nWe look forward to continuing our partnership with ${office.name}.`;
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