import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UpdatePayload = {
  id: string;
  phone?: string | null;
  website?: string | null;
};

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`apply-office-details: ${req.method} request [${requestId}]`);

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
      console.error(`apply-office-details: auth.getUser failed [${requestId}]`, userError);
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

    const body = await req.json().catch(() => ({}));
    const updates = (body?.updates ?? []) as UpdatePayload[];

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error("updates must be a non-empty array");
    }

    console.log(
      `apply-office-details: Applying ${updates.length} updates for user ${user.id} [${requestId}]`,
    );

    let successCount = 0;
    const errors: string[] = [];

    for (const update of updates) {
      const { id, phone, website } = update;

      const updateData: { phone?: string | null; website?: string | null } = {};
      if (phone !== undefined) updateData.phone = phone;
      if (website !== undefined) updateData.website = website;

      if (Object.keys(updateData).length === 0) continue;

      const { data, error } = await supabase
        .from("patient_sources")
        .update(updateData)
        .eq("id", id)
        .eq("source_type", "Office")
        .select("id");

      if (error) {
        errors.push(`Failed to update ${id}: ${error.message}`);
        continue;
      }

      // Important: Supabase returns no error even if 0 rows match.
      if (!data || data.length === 0) {
        errors.push(
          `No row updated for ${id} (not found or not permitted).`,
        );
        continue;
      }

      successCount++;
    }

    console.log(
      `apply-office-details: Updated ${successCount}/${updates.length} offices [${requestId}]`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        updated: successCount,
        total: updates.length,
        errors: errors.length > 0 ? errors : undefined,
        requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(`apply-office-details: Error [${requestId}]:`, error);
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
