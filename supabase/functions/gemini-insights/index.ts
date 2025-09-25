import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCorsPreflightRequest, createCorsResponse, validateOrigin, createOriginErrorResponse } from "../_shared/cors-config.ts";

interface UserData {
  offices: any[];
  monthlyPatients: any[];
  campaigns: any[];
  marketingVisits: any[];
  userProfile: any;
  recentActivity: any[];
  discoveredOffices: any[];
  reviewStatus: any[];
  discoveryAnalytics: {
    totalOfficesInDatabase: number;
    officesWithAddresses: number;
    officesWithGoogleData: number;
    averageRating: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req, ['POST']);
  }

  // Validate origin for browser requests
  const { isValid: originValid, origin } = validateOrigin(req);
  if (!originValid) {
    return createOriginErrorResponse(origin);
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
    
    // Check rate limiting for AI insights
    const { data: rateLimitData, error: rateLimitError } = await supabaseClient
      .rpc('check_rate_limit', {
        p_endpoint: 'gemini-insights',
        p_max_requests: 20,
        p_window_minutes: 60
      });
    
    if (rateLimitError) {
      console.warn('Rate limit check failed:', rateLimitError?.message);
      // Continue anyway to avoid blocking users if rate limit service is down
    } else if (rateLimitData === false) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

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
      { data: recentActivity },
      { data: discoveredOffices },
      { data: reviewStatus }
    ] = await Promise.all([
      supabaseClient
        .from('patient_sources')
        .select('*')
        .eq('created_by', user.id)
        .order('name', { ascending: true }),
      
      supabaseClient
        .from('monthly_patients')
        .select('*')
        .eq('user_id', user.id)
        .order('year_month', { ascending: false }),
      
      supabaseClient
        .from('campaigns')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false }),
      
      supabaseClient
        .from('marketing_visits')
        .select('*')
        .eq('user_id', user.id)
        .order('visit_date', { ascending: false }),
      
      supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      
      supabaseClient
        .from('patient_changes_log')
        .select('*')
        .eq('user_id', user.id)
        .order('changed_at', { ascending: false })
        .limit(20),
      
      supabaseClient
        .from('discovered_offices')
        .select('*')
        .eq('discovered_by', user.id)
        .order('fetched_at', { ascending: false }),
      
      supabaseClient
        .from('review_status')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    ]);

    // Calculate analytics
    const officesData = offices || [];
    const officesWithAddresses = officesData.filter(office => office.address).length;
    const officesWithGoogleData = officesData.filter(office => office.google_place_id).length;
    const ratingsAvailable = officesData.filter(office => office.google_rating).map(office => office.google_rating);
    const averageRating = ratingsAvailable.length > 0 
      ? ratingsAvailable.reduce((sum, rating) => sum + rating, 0) / ratingsAvailable.length 
      : 0;

    // Package data for Gemini
    const userData: UserData = {
      offices: officesData,
      monthlyPatients: monthlyPatients || [],
      campaigns: campaigns || [],
      marketingVisits: marketingVisits || [],
      userProfile: userProfile || {},
      recentActivity: recentActivity || [],
      discoveredOffices: discoveredOffices || [],
      reviewStatus: reviewStatus || [],
      discoveryAnalytics: {
        totalOfficesInDatabase: officesData.length,
        officesWithAddresses: officesWithAddresses,
        officesWithGoogleData: officesWithGoogleData,
        averageRating: averageRating
      }
    };

    console.log(`Packaging data: ${userData.offices.length} offices, ${userData.monthlyPatients.length} monthly records, ${userData.discoveredOffices.length} discovered offices, ${userData.reviewStatus.length} reviews`);

    // Group monthly data by source for better analysis
    const monthlyBySource = userData.monthlyPatients.reduce((acc, record) => {
      if (!acc[record.source_id]) {
        acc[record.source_id] = [];
      }
      acc[record.source_id].push(record);
      return acc;
    }, {});

    // Find top performing sources based on recent data
    const sourcePerformance = Object.keys(monthlyBySource).map(sourceId => {
      const sourceRecords = monthlyBySource[sourceId];
      const recentRecords = sourceRecords.slice(0, 6); // Last 6 months
      const totalRecent = recentRecords.reduce((sum: number, record: any) => sum + record.patient_count, 0);
      const totalAll = sourceRecords.reduce((sum: number, record: any) => sum + record.patient_count, 0);
      const office = userData.offices.find(o => o.id === sourceId);
      
      return {
        sourceId,
        officeName: office?.name || 'Unknown',
        totalRecentPatients: totalRecent,
        totalAllTimePatients: totalAll,
        averageMonthly: recentRecords.length > 0 ? totalRecent / recentRecords.length : 0,
        address: office?.address || 'No address',
        googleRating: office?.google_rating || 'No rating'
      };
    }).sort((a, b) => b.totalRecentPatients - a.totalRecentPatients);

    // Create context for Gemini - simplified approach for better reliability
    const context = `
You are a healthcare marketing analytics assistant analyzing comprehensive data for ${userProfile?.clinic_name || 'a medical practice'}. 

COMPREHENSIVE DATA OVERVIEW:
- Total Patient Sources: ${userData.offices.length} referral sources
- Monthly Patient Records: ${userData.monthlyPatients.length} data points
- Marketing Campaigns: ${userData.campaigns.length} campaigns  
- Marketing Visits: ${userData.marketingVisits.length} visits
- Discovered Offices: ${userData.discoveredOffices.length} potential referral sources
- Review Tracking: ${userData.reviewStatus.length} reviews being monitored

DATA QUALITY ANALYSIS:
- Offices with complete addresses: ${userData.discoveryAnalytics.officesWithAddresses}/${userData.discoveryAnalytics.totalOfficesInDatabase} (${((userData.discoveryAnalytics.officesWithAddresses/userData.discoveryAnalytics.totalOfficesInDatabase)*100).toFixed(1)}%)
- Offices with Google integration: ${userData.discoveryAnalytics.officesWithGoogleData}/${userData.discoveryAnalytics.totalOfficesInDatabase} (${((userData.discoveryAnalytics.officesWithGoogleData/userData.discoveryAnalytics.totalOfficesInDatabase)*100).toFixed(1)}%)
- Average Google Rating: ${userData.discoveryAnalytics.averageRating.toFixed(1)}/5.0

TOP PERFORMING REFERRAL SOURCES (Recent 6 months):
${sourcePerformance.slice(0, 10).map((source, index) => 
  `${index + 1}. ${source.officeName}: ${source.totalRecentPatients} patients (avg: ${source.averageMonthly.toFixed(1)}/month, rating: ${source.googleRating})`
).join('\n')}

UNDERPERFORMING SOURCES (Need attention):
${sourcePerformance.slice(-5).map(source => 
  `- ${source.officeName}: Only ${source.totalRecentPatients} recent patients, ${source.address ? 'Has address' : 'Missing address'}`
).join('\n')}

MONTHLY TRENDS (Last 12 months):
${userData.monthlyPatients
  .reduce((acc, record) => {
    if (!acc[record.year_month]) acc[record.year_month] = 0;
    acc[record.year_month] += record.patient_count;
    return acc;
  }, {})
  && Object.entries(userData.monthlyPatients
    .reduce((acc, record) => {
      if (!acc[record.year_month]) acc[record.year_month] = 0;
      acc[record.year_month] += record.patient_count;
      return acc;
    }, {}))
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([month, total]) => `- ${month}: ${total} total patients`)
    .join('\n')
}

DISCOVERED OPPORTUNITIES:
${userData.discoveredOffices.slice(0, 5).map(office => 
  `- ${office.name} (${office.office_type}): ${office.rating ? `Rating: ${office.rating}` : 'No rating'}, ${office.imported ? 'Already imported' : 'Not yet contacted'}`
).join('\n')}

MARKETING CAMPAIGNS STATUS:
${userData.campaigns.length > 0 
  ? userData.campaigns.map(campaign => `- ${campaign.name} (${campaign.status}): ${campaign.campaign_type} - ${campaign.delivery_method}`).join('\n')
  : 'No active marketing campaigns'
}

RECENT MARKETING VISITS:
${userData.marketingVisits.slice(0, 5).map(visit => 
  `- ${visit.visit_date}: ${visit.rep_name} visited office (${visit.visit_type}) - Rating: ${visit.star_rating || 'N/A'}`
).join('\n')}

REVIEW MONITORING:
${userData.reviewStatus.slice(0, 3).map(review => 
  `- Place ID ${review.place_id}: Status ${review.status} ${review.needs_attention ? '(NEEDS ATTENTION)' : ''}`
).join('\n')}

Please provide comprehensive insights, analytics, and actionable recommendations based on this data. Focus on:
1. Patient referral trends and performance patterns
2. Marketing campaign effectiveness and ROI
3. Office relationship quality and opportunities  
4. Data gaps and improvement recommendations
5. Strategic growth opportunities

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

    return createCorsResponse(
      JSON.stringify({
        response: aiResponse,
        dataContext: {
          officesCount: userData.offices.length,
          monthlyRecords: userData.monthlyPatients.length,
          campaignsCount: userData.campaigns.length,
          visitsCount: userData.marketingVisits.length,
          discoveredOfficesCount: userData.discoveredOffices.length,
          reviewsCount: userData.reviewStatus.length,
          dataQuality: {
            addressCompleteness: ((userData.discoveryAnalytics.officesWithAddresses / userData.discoveryAnalytics.totalOfficesInDatabase) * 100).toFixed(1) + '%',
            googleIntegration: ((userData.discoveryAnalytics.officesWithGoogleData / userData.discoveryAnalytics.totalOfficesInDatabase) * 100).toFixed(1) + '%',
            averageRating: userData.discoveryAnalytics.averageRating.toFixed(1)
          }
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }, req
    );

  } catch (error) {
    console.error('Error in gemini-insights function:', error);
    return createCorsResponse(
      JSON.stringify({ 
        error: (error as Error).message,
        details: 'Failed to process AI insights request'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }, req
    );
  }
});