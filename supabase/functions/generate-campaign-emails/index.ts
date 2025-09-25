import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCorsPreflightRequest, createCorsResponse, validateOrigin, createOriginErrorResponse } from "../_shared/cors-config.ts";

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
    return handleCorsPreflightRequest(req, ['POST']);
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
        c.campaign_deliveries?.some((d: any) => d.office_id === office.id)
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

      // Smart owner name extraction with AI parsing if needed
      let extractedOwner = 'Doctor';
      let ownerRole = 'Healthcare Professional';
      let ownerDegrees = 'DDS';
      
      // Try multiple parsing approaches
      const colonSplit = office.name.includes(':') ? office.name.split(':') : [];
      if (colonSplit.length > 1) {
        // Format like "Practice Name: Dr. John Smith"
        const afterColon = colonSplit[1].trim();
        const drMatch = afterColon.match(/Dr\.?\s*([A-Za-z\s]+)/i);
        if (drMatch) {
          extractedOwner = `Dr. ${drMatch[1].trim()}`;
        } else {
          extractedOwner = afterColon;
        }
      } else {
        // Try to extract from practice name patterns
        const drMatch = office.name.match(/Dr\.?\s*([A-Za-z\s]+)/i);
        if (drMatch) {
          extractedOwner = `Dr. ${drMatch[1].trim()}`;
        } else {
          // Use first part of office name
          extractedOwner = office.name.split(/[,&-]/)[0].trim();
        }
      }
      
      // Determine role from office type
      if (office.officeSource?.source_type) {
        const sourceType = office.officeSource.source_type.toLowerCase();
        if (sourceType.includes('general') || sourceType.includes('family')) {
          ownerRole = 'General Dentist';
        } else if (sourceType.includes('ortho')) {
          ownerRole = 'Orthodontist';
          ownerDegrees = 'DDS, MS';
        } else if (sourceType.includes('oral') || sourceType.includes('surgeon')) {
          ownerRole = 'Oral Surgeon';
          ownerDegrees = 'DDS, MD';
        } else if (sourceType.includes('perio')) {
          ownerRole = 'Periodontist';
          ownerDegrees = 'DDS, MS';
        } else if (sourceType.includes('endo')) {
          ownerRole = 'Endodontist';
          ownerDegrees = 'DDS, MS';
        } else if (sourceType.includes('pediatric')) {
          ownerRole = 'Pediatric Dentist';
          ownerDegrees = 'DDS, MS';
        } else {
          ownerRole = 'Healthcare Professional';
        }
      }
      
      // Calculate treatment types from referral patterns
      let treatmentTypes = 'various procedures';
      if (office.officeSource?.source_type?.toLowerCase().includes('general')) {
        treatmentTypes = 'endodontic cases, complex restorations';
      } else if (office.officeSource?.source_type?.toLowerCase().includes('ortho')) {
        treatmentTypes = 'pre-orthodontic endodontics';
      }
      
      // Calculate referral frequency
      let referralFrequency = 'Low';
      if (office.stats.averageMonthly >= 3) referralFrequency = 'High';
      else if (office.stats.averageMonthly >= 1.5) referralFrequency = 'Moderate';
      
      // Map relationship strength to user's classification
      let mappedRelationship = 'Cold';
      if (office.stats.relationshipStrength.includes('VIP')) mappedRelationship = 'VIP';
      else if (office.stats.relationshipStrength.includes('Strong') || office.stats.relationshipStrength.includes('Active')) mappedRelationship = 'Warm';
      else if (office.stats.relationshipStrength.includes('Growing') || office.stats.relationshipStrength.includes('Occasional')) mappedRelationship = 'Sporadic';
      
      // Build structured context matching user's specification
      const comprehensiveContext = {
        task_type: 'email_generation',
        context: {
          // Structured Input Fields (matching user specification)
          office_name: office.name,
          owner_name: extractedOwner,
          owner_role: ownerRole,
          owner_degrees: ownerDegrees,
          referral_count_past_12_months: office.stats.totalReferrals,
          referral_frequency: referralFrequency,
          treatment_types_referred: treatmentTypes,
          last_referral_date: office.stats.lastReferralMonth,
          relationship_score: mappedRelationship,
          extra_notes: office.officeSource?.notes || '',
          
          // Supporting Data for Context
          office_address: office.address,
          office_type: office.officeSource?.source_type || 'Healthcare Office',
          extracted_owner_name: extractedOwner,
          
          // Complete Referral Data
          total_referrals: office.stats.totalReferrals,
          recent_referrals_6months: office.stats.recentReferrals,
          last_referral_month: office.stats.lastReferralMonth,
          months_active: office.stats.monthsActive,
          average_monthly_referrals: office.stats.averageMonthly,
          relationship_strength: mappedRelationship,
          
          // Visit History Context
          total_visits: office.stats.visitCount,
          last_visit_date: office.stats.lastVisit,
          average_visit_rating: office.stats.avgVisitRating,
          
          // Campaign History
          previous_campaigns: office.stats.campaignCount,
          
          // Current Campaign Context
          current_campaign: campaign_name,
          gift_bundle: gift_bundle,
          
          // Practice Context (from user profile & clinic)
          sender_name: `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim(),
          sender_degrees: userProfile?.degrees,
          sender_title: userProfile?.job_title,
          practice_name: clinic?.name || userProfile?.clinic_name || 'Healthcare Practice',
        },
        parameters: {
          tone: mappedRelationship === 'VIP' || mappedRelationship === 'Warm' 
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

      console.log('AI Response for', office.name, ':', aiResponse);

      if (aiResponse.error) {
        console.error(`AI Assistant error for ${office.name}:`, aiResponse.error);
        throw new Error(`AI generation failed for ${office.name}: ${aiResponse.error.message}`);
      }

      const aiContent = (aiResponse.data?.content ?? '').toString();
      let emailSubject = `Partnership Update from ${userProfile?.first_name || 'Dr.'} ${userProfile?.last_name || 'Doctor'}`;
      let emailBody = aiContent.trim();

      if (!emailBody) {
        console.warn(`AI returned empty content for ${office.name}, using deterministic fallback.`);
        // Build deterministic fallback email matching the required structure
        const greetingName = (extractedOwner || 'Doctor').replace(/,.*$/, '').trim();
        const practiceName = clinic?.name || userProfile?.clinic_name || 'Our Practice';
        const senderLineName = `${userProfile?.first_name || 'Dr.'} ${userProfile?.last_name || 'Name'}`.trim();
        const senderDegrees = userProfile?.degrees || 'DDS';
        const senderTitle = userProfile?.job_title || 'Owner';

        const intro = (
          mappedRelationship === 'VIP' ?
            `Thank you for your continued trust in ${practiceName}. We truly value our collaboration and the care you provide for your patients.` :
          mappedRelationship === 'Warm' ?
            `I appreciate the patients you've sent our way and wanted to check in to see how we can continue supporting your team and your patients.` :
          mappedRelationship === 'Sporadic' ?
            `We've noticed a few recent referrals and wanted to reach out to ensure our process supports your team well.` :
            `I’m reaching out to reintroduce ${practiceName} and make sure you have everything you need for any future cases we can assist with.`
        );

        const referralsYear = office.stats.totalReferrals;
        const lastRef = office.stats.lastReferralMonth ? 'earlier this year' : 'some time ago';
        const dataSummary = `Over the past year, we’ve seen ${referralsYear || 0} referral${(referralsYear||0) === 1 ? '' : 's'}. Typical cases include ${treatmentTypes}. Our most recent case from your office was ${lastRef}.`;

        const cta = (
          mappedRelationship === 'VIP' || mappedRelationship === 'Warm' ?
            `If you’d like updated referral forms, sample notes, or CE opportunities for your team, we’d be happy to share. Please let me know what would be most helpful.` :
            `If you’d like updated referral forms or a quick refresher on our process, I’d be glad to send materials or connect briefly.`
        );

        emailBody = `---\n**EMAIL DRAFT:**\n\nDear ${greetingName},\n\n${intro}\n\n${dataSummary}\n\n${cta}\n\nRespectfully,\n${senderLineName}, ${senderDegrees}\n${senderTitle}\n${practiceName}`;
      } else {
        console.log(`AI generated content for ${office.name}:`, emailBody.substring(0, 200) + '...');
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

    return createCorsResponse(JSON.stringify({ 
      success: true,
      emails: generatedEmails,
      total_generated: generatedEmails.length,
      data_sources_used: [
        'user_profiles', 'clinics', 'ai_business_profiles', 'patient_sources',
        'monthly_patients', 'marketing_visits', 'campaigns', 'campaign_deliveries'
      ]
    }), {
      headers: { 'Content-Type': 'application/json' },
    }, req);

  } catch (error) {
    console.error('Error in comprehensive email generation:', error);
    return createCorsResponse(JSON.stringify({ 
      success: false,
      error: (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }, req);
  }
});