import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIRequest {
  task: 'generate_emails' | 'generate_insights' | 'analyze_data';
  data: any;
}

interface EmailGenerationRequest {
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

    console.log('Unified AI Service - User authenticated:', user.id);

    const requestData: AIRequest = await req.json();
    const { task, data: taskData } = requestData;

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Get comprehensive user and platform context
    const platformContext = await getPlatformContext(supabaseClient, user.id);
    
    console.log('Platform context loaded:', {
      hasUserProfile: !!platformContext.userProfile,
      hasClinicInfo: !!platformContext.clinicInfo,
      officeCount: platformContext.totalOffices,
      campaignCount: platformContext.totalCampaigns
    });

    let response;
    
    switch (task) {
      case 'generate_emails':
        response = await generateEmails(openAIApiKey, supabaseClient, user.id, taskData as EmailGenerationRequest, platformContext);
        break;
      case 'generate_insights':
        response = await generateInsights(openAIApiKey, supabaseClient, user.id, taskData, platformContext);
        break;
      case 'analyze_data':
        response = await analyzeData(openAIApiKey, supabaseClient, user.id, taskData, platformContext);
        break;
      default:
        throw new Error(`Unknown task: ${task}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in unified AI service:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getPlatformContext(supabaseClient: any, userId: string) {
  console.log('Loading comprehensive platform context for user:', userId);

  // Get user profile with complete information
  const { data: userProfile } = await supabaseClient
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Get clinic information
  let clinicInfo = null;
  if (userProfile?.clinic_id) {
    const { data: clinic } = await supabaseClient
      .from('clinics')
      .select('*')
      .eq('id', userProfile.clinic_id)
      .maybeSingle();
    clinicInfo = clinic;
  }

  // Get all offices/sources with relationship data
  const { data: allOffices } = await supabaseClient
    .from('patient_sources')
    .select('*')
    .eq('created_by', userId);

  // Get campaign history
  const { data: campaigns } = await supabaseClient
    .from('campaigns')
    .select('*')
    .eq('created_by', userId);

  // Get recent patient data trends
  const { data: recentPatientData } = await supabaseClient
    .from('monthly_patients')
    .select('*')
    .eq('user_id', userId)
    .gte('year_month', new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7))
    .order('year_month', { ascending: false });

  return {
    userProfile,
    clinicInfo,
    allOffices: allOffices || [],
    campaigns: campaigns || [],
    recentPatientData: recentPatientData || [],
    totalOffices: allOffices?.length || 0,
    totalCampaigns: campaigns?.length || 0,
    totalPatients: recentPatientData?.reduce((sum, record) => sum + (record.patient_count || 0), 0) || 0
  };
}

async function generateEmails(
  apiKey: string, 
  supabaseClient: any, 
  userId: string, 
  emailRequest: EmailGenerationRequest, 
  platformContext: any
) {
  console.log('Generating emails with comprehensive platform data');
  
  const { offices, gift_bundle, campaign_name } = emailRequest;
  
  if (!offices || offices.length === 0) {
    throw new Error("At least one office is required");
  }

  // Get detailed relationship data for each office
  const officesWithData = await Promise.all(offices.map(async (office) => {
    // Get complete referral history
    const { data: referralHistory } = await supabaseClient
      .from('monthly_patients')
      .select('year_month, patient_count')
      .eq('source_id', office.id)
      .eq('user_id', userId)
      .order('year_month', { ascending: false });

    // Get office details
    const { data: officeDetails } = await supabaseClient
      .from('patient_sources')
      .select('*')
      .eq('id', office.id)
      .eq('created_by', userId)
      .maybeSingle();

    // Get campaign history with this office
    const { data: campaignHistory } = await supabaseClient
      .from('campaign_deliveries')
      .select('*, campaigns(name)')
      .eq('office_id', office.id)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate comprehensive relationship metrics
    const totalReferrals = referralHistory?.reduce((sum, r) => sum + (r.patient_count || 0), 0) || 0;
    const recentReferrals = referralHistory?.slice(0, 6).reduce((sum, r) => sum + (r.patient_count || 0), 0) || 0;
    const lastReferralMonth = referralHistory?.find(r => r.patient_count > 0)?.year_month;
    const monthsActive = referralHistory?.filter(r => r.patient_count > 0).length || 0;
    const avgMonthlyReferrals = monthsActive > 0 ? Math.round((totalReferrals / monthsActive) * 10) / 10 : 0;
    
    // Determine relationship strength
    let relationshipStrength = 'New Contact';
    if (totalReferrals > 50) relationshipStrength = 'Premier Partner';
    else if (totalReferrals > 25) relationshipStrength = 'Strong Partner';
    else if (totalReferrals > 15) relationshipStrength = 'Active Partner';
    else if (totalReferrals > 5) relationshipStrength = 'Growing Partner';
    else if (totalReferrals > 0) relationshipStrength = 'Occasional Partner';

    // Calculate growth trends
    const recent3Months = referralHistory?.slice(0, 3).reduce((sum, r) => sum + (r.patient_count || 0), 0) || 0;
    const previous3Months = referralHistory?.slice(3, 6).reduce((sum, r) => sum + (r.patient_count || 0), 0) || 0;
    const growthTrend = previous3Months > 0 ? ((recent3Months - previous3Months) / previous3Months * 100) : 0;

    return {
      ...office,
      officeDetails,
      referralHistory: referralHistory || [],
      campaignHistory: campaignHistory || [],
      relationshipMetrics: {
        totalReferrals,
        recentReferrals,
        lastReferralMonth,
        monthsActive,
        avgMonthlyReferrals,
        relationshipStrength,
        growthTrend: Math.round(growthTrend),
        recent3Months,
        previous3Months,
        hasGrowth: growthTrend > 0,
        isDecline: growthTrend < -10
      }
    };
  }));

  // Build comprehensive sender profile
  const senderProfile = buildSenderProfile(platformContext.userProfile, platformContext.clinicInfo);
  
  console.log('Sender profile built:', senderProfile);

  // Generate emails using GPT-5 with comprehensive context
  const generatedEmails = [];
  
  for (const office of officesWithData) {
    console.log(`Generating email for ${office.name} with relationship strength: ${office.relationshipMetrics.relationshipStrength}`);
    
    const emailContent = await callGPT5ForEmailGeneration(
      apiKey,
      office,
      senderProfile,
      platformContext,
      gift_bundle,
      campaign_name
    );
    
    generatedEmails.push({
      office_id: office.id,
      office_name: office.name,
      subject: emailContent.subject,
      body: emailContent.body,
      referral_tier: office.relationshipMetrics.relationshipStrength
    });
  }

  console.log(`Generated ${generatedEmails.length} personalized emails with comprehensive data`);

  return {
    success: true,
    emails: generatedEmails,
    total_generated: generatedEmails.length,
    platform_context_used: true
  };
}

async function callGPT5ForEmailGeneration(
  apiKey: string,
  office: any,
  senderProfile: any,
  platformContext: any,
  giftBundle: any,
  campaignName: string
) {
  const systemPrompt = `You are the unified AI assistant for a healthcare practice management platform. You have comprehensive access to all platform data including patient referrals, relationship history, and practice metrics.

SENDER PROFILE:
- Name: ${senderProfile.fullNameWithCredentials}
- Title: ${senderProfile.jobTitle}
- Practice: ${senderProfile.practiceName}
- Credentials: ${senderProfile.credentials || 'Healthcare Professional'}
- Contact: ${senderProfile.phone} | ${senderProfile.email}

PLATFORM INTELLIGENCE:
- Total Active Referral Sources: ${platformContext.totalOffices}
- Total Campaigns Run: ${platformContext.totalCampaigns}
- Recent Patient Volume: ${platformContext.totalPatients} patients (12 months)

CRITICAL DIRECTIVES:
1. Write with the authority of someone who actively manages patient referrals and relationships
2. Use specific data points naturally - actual numbers show genuine partnership tracking
3. Reference growth trends, partnership milestones, and collaboration patterns
4. Maintain professional healthcare communication standards
5. Demonstrate understanding of the office's role in patient care continuity
6. Write as a practice leader who values each referral source individually

RELATIONSHIP DATA USAGE:
- Always reference specific referral numbers when relevant (e.g., "the 23 patients you've referred")
- Acknowledge growth trends ("15% increase in referrals over recent months")
- Mention partnership milestones ("celebrating 2 years of collaboration")
- Reference seasonal patterns or collaboration consistency

OUTPUT: Return ONLY valid JSON with "subject" and "body" fields.`;

  const officeAnalysis = `
TARGET OFFICE: ${office.name}
Location: ${office.address || 'Address on file'}
Office Type: ${office.officeDetails?.source_type || 'Healthcare Practice'}

COMPREHENSIVE RELATIONSHIP DATA:
- Partnership Level: ${office.relationshipMetrics.relationshipStrength}
- Total Patients Referred: ${office.relationshipMetrics.totalReferrals}
- Recent Activity (6 months): ${office.relationshipMetrics.recentReferrals} patients
- Partnership Duration: ${office.relationshipMetrics.monthsActive} active months
- Average Monthly Referrals: ${office.relationshipMetrics.avgMonthlyReferrals}
- Last Referral: ${office.relationshipMetrics.lastReferralMonth || 'No recent activity'}
- Growth Trend: ${office.relationshipMetrics.growthTrend}% (recent vs previous quarter)
- Recent Performance: ${office.relationshipMetrics.recent3Months} patients (last 3 months)
- Historical Comparison: ${office.relationshipMetrics.previous3Months} patients (previous 3 months)
- Partnership Status: ${office.relationshipMetrics.hasGrowth ? 'Growing' : office.relationshipMetrics.isDecline ? 'Declining' : 'Stable'}
- Campaign Interactions: ${office.campaignHistory.length} previous campaigns

CAMPAIGN CONTEXT: ${campaignName}
${giftBundle ? `Gift Package: ${giftBundle.name} - ${giftBundle.description} (${giftBundle.items.join(', ')})` : 'Relationship-focused outreach'}`;

  const intelligentPrompt = `Create a highly personalized email that demonstrates deep understanding of our professional relationship with this office.

${officeAnalysis}

RELATIONSHIP-SPECIFIC APPROACH:
${office.relationshipMetrics.relationshipStrength === 'Premier Partner' ? 'Write as a deeply valued, long-term partner - express ongoing appreciation and discuss future growth opportunities' :
  office.relationshipMetrics.relationshipStrength === 'Strong Partner' ? 'Write as an established, trusted colleague - acknowledge consistent collaboration and suggest strengthening partnership' :
  office.relationshipMetrics.relationshipStrength === 'Active Partner' ? 'Write as an appreciative partner - reference specific contributions and growth together' :
  office.relationshipMetrics.relationshipStrength === 'Growing Partner' ? 'Write encouragingly about developing partnership - mention positive trends and future potential' :
  office.relationshipMetrics.relationshipStrength === 'Occasional Partner' ? 'Write to re-engage and strengthen collaboration - acknowledge past referrals and suggest more regular partnership' :
  'Write as professional introduction - focus on building new referral relationship and mutual benefit'}

EMAIL REQUIREMENTS:
1. Subject line: Personal, data-informed, includes sender's first name (under 60 chars)
2. Opening: Specific acknowledgment of relationship and recent collaboration patterns
3. Body: ${office.relationshipMetrics.totalReferrals > 0 ? 
   `Reference their ${office.relationshipMetrics.totalReferrals} patient referrals and ${office.relationshipMetrics.growthTrend > 0 ? 'positive growth trend' : 'consistent partnership'}` : 
   'Focus on introducing practice and establishing referral relationship'}
4. ${giftBundle ? 'Gift mention: Natural appreciation gesture tied to their specific partnership level' : 'Partnership focus: Strengthen collaboration and discuss mutual patient care goals'}
5. Next steps: Specific, appropriate action based on relationship strength
6. Signature: Complete professional signature with credentials

Make this sound like it comes from a practice leader who genuinely tracks and values this specific professional relationship.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07', // Using GPT-5 as the unified model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: intelligentPrompt }
      ],
      max_completion_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('GPT-5 API error:', errorData);
    throw new Error(`Failed to generate email for ${office.name}: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  let emailContent = data.choices[0].message.content;

  try {
    const parsedEmail = JSON.parse(emailContent);
    if (parsedEmail.subject && parsedEmail.body) {
      console.log(`Successfully generated email for ${office.name}`);
      return parsedEmail;
    }
  } catch (parseError) {
    console.warn(`Failed to parse GPT-5 response for ${office.name}:`, parseError);
  }

  // Fallback if parsing fails
  return {
    subject: `${senderProfile.firstName} from ${senderProfile.practiceName}`,
    body: emailContent + `\n\n${senderProfile.fullNameWithCredentials}\n${senderProfile.jobTitle}\n${senderProfile.practiceName}\n${senderProfile.phone}\n${senderProfile.email}`
  };
}

function buildSenderProfile(userProfile: any, clinicInfo: any) {
  const firstName = userProfile?.first_name || 'Dr.';
  const lastName = userProfile?.last_name || '';
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : 'Healthcare Professional';
  const degrees = userProfile?.degrees || '';
  const jobTitle = userProfile?.job_title || 'Healthcare Professional';
  const practiceName = clinicInfo?.name || 'Our Practice';
  const phone = userProfile?.phone || '';
  const email = userProfile?.email || '';
  
  const fullNameWithCredentials = degrees ? 
    `Dr. ${fullName}, ${degrees}` : 
    `Dr. ${fullName}`;

  return {
    firstName,
    fullName,
    fullNameWithCredentials,
    credentials: degrees,
    jobTitle,
    practiceName,
    phone,
    email
  };
}

async function generateInsights(apiKey: string, supabaseClient: any, userId: string, data: any, platformContext: any) {
  // Placeholder for insights generation using GPT-5
  console.log('Generating insights with unified AI');
  return { success: true, insights: 'Insights feature coming soon with unified AI' };
}

async function analyzeData(apiKey: string, supabaseClient: any, userId: string, data: any, platformContext: any) {
  // Placeholder for data analysis using GPT-5
  console.log('Analyzing data with unified AI');
  return { success: true, analysis: 'Data analysis feature coming soon with unified AI' };
}