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
  };
  filled: {
    phone: string | null;
    website: string | null;
  };
  success: boolean;
  changed: boolean;
  error?: string;
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(`fill-office-details: auth.getUser failed [${requestId}]`, userError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { officeIds } = await req.json();
    if (!Array.isArray(officeIds) || officeIds.length === 0) {
      throw new Error("officeIds must be a non-empty array");
    }

    console.log(
      `fill-office-details: Processing ${officeIds.length} offices for user ${user.id} [${requestId}]`,
    );

    const { data: offices, error: fetchError } = await supabase
      .from("patient_sources")
      .select("id, name, phone, website, google_place_id, address")
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
        // Already complete
        if (office.phone && office.website) {
          results.push({
            id: office.id,
            officeName: office.name,
            original: { phone: office.phone, website: office.website },
            filled: { phone: office.phone, website: office.website },
            success: true,
            changed: false,
          });
          continue;
        }

        let placeId: string | null = office.google_place_id;

        // If no place_id, try search by name + address (best effort)
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

        if (!placeId) {
          results.push({
            id: office.id,
            officeName: office.name,
            original: { phone: office.phone, website: office.website },
            filled: { phone: office.phone, website: office.website },
            success: false,
            changed: false,
            error: "Could not find Google Place ID",
          });
          continue;
        }

        const detailsUrl =
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website,international_phone_number&key=${googleApiKey}`;

        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        if (detailsData.status !== "OK") {
          results.push({
            id: office.id,
            officeName: office.name,
            original: { phone: office.phone, website: office.website },
            filled: { phone: office.phone, website: office.website },
            success: false,
            changed: false,
            error: `Place details failed: ${detailsData.status}`,
          });
          continue;
        }

        const placeDetails = detailsData.result ?? {};
        const newPhone =
          office.phone ??
          placeDetails.formatted_phone_number ??
          placeDetails.international_phone_number ??
          null;
        const newWebsite = office.website ?? placeDetails.website ?? null;

        const hasChanges = newPhone !== office.phone || newWebsite !== office.website;
        if (hasChanges) needsUpdateCount++;

        results.push({
          id: office.id,
          officeName: office.name,
          original: { phone: office.phone, website: office.website },
          filled: { phone: newPhone, website: newWebsite },
          success: true,
          changed: hasChanges,
        });

        // light rate limit
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`fill-office-details: Error processing office ${office.id} [${requestId}]`, error);
        results.push({
          id: office.id,
          officeName: office.name,
          original: { phone: office.phone, website: office.website },
          filled: { phone: office.phone, website: office.website },
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
