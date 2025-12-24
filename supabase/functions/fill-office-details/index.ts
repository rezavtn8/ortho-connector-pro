import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FilledDetails {
  id: string;
  officeName: string;
  original: {
    phone: string | null;
    website: string | null;
    email: string | null;
  };
  filled: {
    phone: string | null;
    website: string | null;
    email: string | null;
  };
  success: boolean;
  changed: boolean;
  error?: string;
}

/**
 * Extract email addresses from HTML content
 */
function extractEmailsFromHtml(html: string): string[] {
  // Common email pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) || [];
  
  // Filter out common false positives and duplicates
  const filtered = [...new Set(matches)]
    .filter(email => {
      const lower = email.toLowerCase();
      // Exclude common non-contact emails
      if (lower.includes('example.com')) return false;
      if (lower.includes('domain.com')) return false;
      if (lower.includes('email.com')) return false;
      if (lower.includes('yoursite.com')) return false;
      if (lower.includes('wixpress.com')) return false;
      if (lower.includes('sentry.io')) return false;
      if (lower.endsWith('.png')) return false;
      if (lower.endsWith('.jpg')) return false;
      if (lower.endsWith('.gif')) return false;
      if (lower.endsWith('.svg')) return false;
      if (lower.endsWith('.webp')) return false;
      // Prioritize contact/info emails
      return true;
    })
    .sort((a, b) => {
      // Prioritize contact/info/office emails
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const priorityPatterns = ['info@', 'contact@', 'office@', 'hello@', 'appointments@', 'admin@', 'reception@'];
      const aHasPriority = priorityPatterns.some(p => aLower.startsWith(p));
      const bHasPriority = priorityPatterns.some(p => bLower.startsWith(p));
      if (aHasPriority && !bHasPriority) return -1;
      if (!aHasPriority && bHasPriority) return 1;
      return 0;
    });

  return filtered;
}

/**
 * Try to fetch website and extract email
 */
async function extractEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    // Normalize URL
    let url = websiteUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    // Fetch the page with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const emails = extractEmailsFromHtml(html);

    if (emails.length > 0) {
      console.log(`Found emails on ${url}: ${emails.slice(0, 3).join(', ')}`);
      return emails[0]; // Return the best candidate
    }

    // Try the contact page if main page has no email
    const contactPaths = ['/contact', '/contact-us', '/about', '/about-us'];
    for (const path of contactPaths) {
      try {
        const contactUrl = new URL(path, url).href;
        const contactController = new AbortController();
        const contactTimeoutId = setTimeout(() => contactController.abort(), 5000);

        const contactResponse = await fetch(contactUrl, {
          signal: contactController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });

        clearTimeout(contactTimeoutId);

        if (contactResponse.ok) {
          const contactHtml = await contactResponse.text();
          const contactEmails = extractEmailsFromHtml(contactHtml);
          if (contactEmails.length > 0) {
            console.log(`Found email on ${contactUrl}: ${contactEmails[0]}`);
            return contactEmails[0];
          }
        }
      } catch {
        // Ignore errors on contact page attempts
      }
    }

    return null;
  } catch (error) {
    console.log(`Error fetching website ${websiteUrl}:`, error);
    return null;
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`fill-office-details: ${req.method} request [${requestId}]`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!googleApiKey) {
      throw new Error("Google Maps API key not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use service role to validate the JWT token
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error(`fill-office-details: auth.getUser failed [${requestId}]`, userError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create client for RLS-protected queries
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { officeIds } = await req.json();
    if (!Array.isArray(officeIds) || officeIds.length === 0) {
      throw new Error("officeIds must be a non-empty array");
    }

    console.log(
      `fill-office-details: Processing ${officeIds.length} offices for user ${user.id} [${requestId}]`,
    );

    const { data: offices, error: fetchError } = await supabase
      .from("patient_sources")
      .select("id, name, phone, website, email, google_place_id, address")
      .in("id", officeIds)
      .eq("source_type", "Office");

    if (fetchError) {
      throw new Error(`Failed to fetch offices: ${fetchError.message}`);
    }

    if (!offices || offices.length === 0) {
      throw new Error("No offices found");
    }

    const results: FilledDetails[] = [];
    let needsUpdateCount = 0;

    for (const office of offices) {
      try {
        // Check if already complete (has phone, website, AND email)
        if (office.phone && office.website && office.email) {
          results.push({
            id: office.id,
            officeName: office.name,
            original: { phone: office.phone, website: office.website, email: office.email },
            filled: { phone: office.phone, website: office.website, email: office.email },
            success: true,
            changed: false,
          });
          continue;
        }

        let placeId: string | null = office.google_place_id;
        let newPhone = office.phone;
        let newWebsite = office.website;
        let newEmail = office.email;

        // If missing phone or website, try Google Places
        if (!office.phone || !office.website) {
          // If no place_id, try search by name + address
          if (!placeId && office.address) {
            const searchQuery = `${office.name} ${office.address}`;
            const searchUrl =
              `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id&key=${googleApiKey}`;

            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();

            if (searchData.status === "OK" && searchData.candidates?.length > 0) {
              placeId = searchData.candidates[0].place_id;
            }
          }

          if (placeId) {
            const detailsUrl =
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website,international_phone_number&key=${googleApiKey}`;

            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();

            if (detailsData.status === "OK") {
              const placeDetails = detailsData.result ?? {};
              newPhone = office.phone ?? placeDetails.formatted_phone_number ?? placeDetails.international_phone_number ?? null;
              newWebsite = office.website ?? placeDetails.website ?? null;
            }
          }
        }

        // Try to extract email from website if we have one and email is missing
        if (!newEmail && newWebsite) {
          console.log(`fill-office-details: Extracting email from ${newWebsite} for ${office.name} [${requestId}]`);
          newEmail = await extractEmailFromWebsite(newWebsite);
        }

        const hasChanges = newPhone !== office.phone || newWebsite !== office.website || newEmail !== office.email;
        
        if (hasChanges) {
          needsUpdateCount++;
        }

        results.push({
          id: office.id,
          officeName: office.name,
          original: { phone: office.phone, website: office.website, email: office.email },
          filled: { phone: newPhone, website: newWebsite, email: newEmail },
          success: true,
          changed: hasChanges,
        });

        // Rate limit between requests
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`fill-office-details: Error processing office ${office.id} [${requestId}]`, error);
        results.push({
          id: office.id,
          officeName: office.name,
          original: { phone: office.phone, website: office.website, email: office.email },
          filled: { phone: office.phone, website: office.website, email: office.email },
          success: false,
          changed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log(
      `fill-office-details: Processed ${offices.length} offices, ${needsUpdateCount} need updates [${requestId}]`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: offices.length,
        needsUpdate: needsUpdateCount,
        results,
        requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(`fill-office-details: Error [${requestId}]:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
