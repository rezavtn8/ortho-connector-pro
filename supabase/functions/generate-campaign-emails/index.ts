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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
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
    const { offices, gift_bundle, campaign_name } = requestData;

    if (!offices || offices.length === 0) {
      throw new Error("At least one office is required");
    }

    console.log(`Generating emails for ${offices.length} offices:`, offices.map(o => o.name));

    // Collect ALL platform data for comprehensive AI context
    console.log('Collecting comprehensive platform data...');

    // 1. User Profile - Complete details
    const { data: userProfile } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // 2. Clinic Information - Practice details
    const { data: clinic } = await supabaseClient
      .from('clinics')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    // 3. AI Business Profile - Brand context
    const { data: businessProfile } = await supabaseClient
      .from('ai_business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // 4. All Patient Sources - Practice network
    const { data: allSources } = await supabaseClient
      .from('patient_sources')
      .select('*')
      .eq('created_by', user.id);

    // 5. Complete Referral History - All monthly data
    const { data: allReferralHistory } = await supabaseClient
      .from('monthly_patients')
      .select('*')
      .eq('user_id', user.id)
      .order('year_month', { ascending: false });

    // 6. Marketing Visit History - Relationship context
    const { data: allVisits } = await supabaseClient
      .from('marketing_visits')
      .select('*')
      .eq('user_id', user.id)
      .order('visit_date', { ascending: false });

    // 7. Campaign History - Previous interactions
    const { data: allCampaigns } = await supabaseClient
      .from('campaigns')
      .select(`
        *,
        campaign_deliveries(*)
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    // Process each office with ALL available data
    const comprehensiveOfficeData = await Promise.all(offices.map(async (office) => {
      console.log(`Processing comprehensive data for: ${office.name}`);

      // Office-specific referral history
      const officeReferrals = allReferralHistory?.filter(r => r.source_id === office.id) || [];
      
      // Office-specific visit history  
      const officeVisits = allVisits?.filter(v => v.office_id === office.id) || [];
      
      // Office-specific campaign history
      const officeCampaigns = allCampaigns?.filter(c => 
        c.campaign_deliveries?.some(d => d.office_id === office.id)
      ) || [];

      // Office details from sources
      const officeSource = allSources?.find(s => s.id === office.id);

      // Calculate comprehensive statistics
      const totalReferrals = officeReferrals.reduce((sum, r) => sum + (r.patient_count || 0), 0);
      const recentReferrals = officeReferrals.slice(0, 6).reduce((sum, r) => sum + (r.patient_count || 0), 0);
      const lastReferralMonth = officeReferrals.find(r => r.patient_count > 0)?.year_month;
      const monthsActive = officeReferrals.filter(r => r.patient_count > 0).length;
      const averageMonthly = monthsActive > 0 ? Math.round((totalReferrals / monthsActive) * 10) / 10 : 0;
      
      // Relationship strength
      let relationshipStrength = 'New Contact';
      if (totalReferrals >= 50) relationshipStrength = 'VIP Partner';
      else if (totalReferrals >= 20) relationshipStrength = 'Strong Partner';
      else if (totalReferrals >= 10) relationshipStrength = 'Active Partner';
      else if (totalReferrals >= 5) relationshipStrength = 'Growing Partner';
      else if (totalReferrals > 0) relationshipStrength = 'Occasional Partner';

      // Visit relationship context
      const lastVisit = officeVisits[0];
      const visitCount = officeVisits.length;
      const avgVisitRating = officeVisits.length > 0 
        ? officeVisits.reduce((sum, v) => sum + (v.star_rating || 0), 0) / officeVisits.length 
        : 0;

      return {
        ...office,
        officeSource,
        referralHistory: officeReferrals,
        visitHistory: officeVisits,
        campaignHistory: officeCampaigns,
        stats: {
          totalReferrals,
          recentReferrals,
          lastReferralMonth,
          monthsActive,
          averageMonthly,
          relationshipStrength,
          visitCount,
          lastVisit: lastVisit?.visit_date,
          avgVisitRating: Math.round(avgVisitRating * 10) / 10,
          campaignCount: officeCampaigns.length
        }
      };
    }));

    // Use AI Assistant for email generation with ALL data
    const generatedEmails = [];

    for (const office of comprehensiveOfficeData) {
      console.log(`Generating AI email for: ${office.name} with complete platform data`);

      // Extract owner name from office name (smart parsing)
      const ownerMatch = office.name.match(/:\s*([A-Za-z\s]+?)(?:\s*,|$)/);
      const extractedOwner = ownerMatch ? ownerMatch[1].trim() : office.name.split(':')[0];
      
      // Build comprehensive context for AI
      const comprehensiveContext = {
        task_type: 'email_generation',
        context: {
          // Recipient Information
          office_name: office.name,
          office_address: office.address,
          office_type: office.officeSource?.source_type || 'Healthcare Office',
          extracted_owner_name: extractedOwner,
          
          // Complete Referral Data
          total_referrals: office.stats.totalReferrals,
          recent_referrals_6months: office.stats.recentReferrals,
          last_referral_month: office.stats.lastReferralMonth,
          months_active: office.stats.monthsActive,
          average_monthly_referrals: office.stats.averageMonthly,
          relationship_strength: office.stats.relationshipStrength,
          
          // Visit History Context
          total_visits: office.stats.visitCount,
          last_visit_date: office.stats.lastVisit,
          average_visit_rating: office.stats.avgVisitRating,
          
          // Campaign History
          previous_campaigns: office.stats.campaignCount,
          campaign_details: office.campaignHistory.map(c => ({
            name: c.name,
            date: c.created_at,
            status: c.status
          })),
          
          // Office Details
          office_phone: office.officeSource?.phone,
          office_email: office.officeSource?.email,
          office_website: office.officeSource?.website,
          google_rating: office.officeSource?.google_rating,
          office_notes: office.officeSource?.notes,
          
          // Current Campaign Context
          current_campaign: campaign_name,
          gift_bundle: gift_bundle,
          
          // Practice Context (from user profile & clinic)
          sender_name: `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim(),
          sender_degrees: userProfile?.degrees,
          sender_title: userProfile?.job_title,
          practice_name: clinic?.name || userProfile?.clinic_name || 'Healthcare Practice',
          practice_address: clinic?.address,
          practice_phone: userProfile?.phone,
          practice_email: userProfile?.email,
          
          // Business Profile Context
          communication_style: businessProfile?.communication_style || 'professional',
          brand_voice: businessProfile?.brand_voice || { tone: 'professional' },
          specialties: businessProfile?.specialties || [],
          practice_values: businessProfile?.practice_values || [],
          
          // Platform Statistics for Context
          total_practice_sources: allSources?.length || 0,
          total_practice_referrals: allReferralHistory?.reduce((sum, r) => sum + (r.patient_count || 0), 0) || 0,
          active_referral_relationships: allSources?.filter(s => 
            allReferralHistory?.some(r => r.source_id === s.id && r.patient_count > 0)
          ).length || 0
        },
        parameters: {
          tone: office.stats.relationshipStrength.includes('VIP') || office.stats.relationshipStrength.includes('Strong') 
            ? 'warm_appreciative' : 'professional_welcoming',
          style: 'personalized',
          include_data: true
        }
      };

      console.log('Sending comprehensive data to AI Assistant for:', office.name);

      // Call AI Assistant with complete platform data
      const aiResponse = await supabaseClient.functions.invoke('ai-assistant', {
        body: comprehensiveContext
      });

      if (aiResponse.error) {
        console.error(`AI Assistant error for ${office.name}:`, aiResponse.error);
        throw new Error(`AI generation failed for ${office.name}: ${aiResponse.error.message}`);
      }

      const aiContent = aiResponse.data?.content;
      if (!aiContent) {
        throw new Error(`No content generated for ${office.name}`);
      }

      console.log(`AI generated content for ${office.name}:`, aiContent.substring(0, 200) + '...');

      // Parse AI response (should be structured)
      let emailSubject = `Partnership Update from ${userProfile?.first_name || 'Dr.'} ${userProfile?.last_name || 'Doctor'}`;
      let emailBody = aiContent;

      try {
        const parsed = JSON.parse(aiContent);
        if (parsed.subject && parsed.body) {
          emailSubject = parsed.subject;
          emailBody = parsed.body;
        }
      } catch (parseError) {
        console.log('Using AI content as-is (not JSON formatted)');
        // If not JSON, treat as email body and create subject
        emailSubject = `${campaign_name} - ${userProfile?.first_name || 'Dr.'} ${userProfile?.last_name || 'Doctor'}`;
      }

      generatedEmails.push({
        office_id: office.id,
        office_name: office.name,
        subject: emailSubject,
        body: emailBody,
        referral_tier: office.stats.relationshipStrength
      });

      console.log(`Generated comprehensive email for ${office.name}`);
    }

    console.log(`Successfully generated ${generatedEmails.length} emails with complete platform data`);

    return new Response(JSON.stringify({ 
      success: true,
      emails: generatedEmails,
      total_generated: generatedEmails.length,
      data_sources_used: [
        'user_profiles', 'clinics', 'ai_business_profiles', 'patient_sources',
        'monthly_patients', 'marketing_visits', 'campaigns', 'campaign_deliveries'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in comprehensive email generation:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});