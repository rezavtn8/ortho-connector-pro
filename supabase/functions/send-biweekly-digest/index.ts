import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { DigestEmail } from "./_templates/digest.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateUnsubscribeToken(userId: string, secret: string): Promise<string> {
  const payload = JSON.stringify({ user_id: userId, type: "biweekly_digest", ts: Date.now() });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
  const token = btoa(JSON.stringify({ payload, signature: sigHex }));
  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendApiKey);

    // Get all users opted into biweekly digest
    const { data: users, error: usersError } = await supabase
      .from("user_profiles")
      .select("user_id, first_name, email, email_preferences")
      .not("email", "is", null);

    if (usersError) throw usersError;

    const optedInUsers = (users || []).filter((u: any) => {
      const prefs = u.email_preferences;
      return prefs && prefs.biweekly_digest !== false;
    });

    console.log(`Found ${optedInUsers.length} users opted into biweekly digest`);

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const dateRange = `${fourteenDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    let sentCount = 0;

    for (const user of optedInUsers) {
      try {
        // Fetch practice data for this user
        const [patientsRes, officesRes, visitsRes, campaignsRes, topOfficesRes] = await Promise.all([
          supabase
            .from("daily_patients")
            .select("patient_count")
            .eq("user_id", user.user_id)
            .gte("patient_date", fourteenDaysAgo.toISOString().split("T")[0]),
          supabase
            .from("patient_sources")
            .select("id")
            .eq("created_by", user.user_id)
            .gte("created_at", fourteenDaysAgo.toISOString()),
          supabase
            .from("marketing_visits")
            .select("id")
            .eq("user_id", user.user_id)
            .gte("visit_date", fourteenDaysAgo.toISOString().split("T")[0]),
          supabase
            .from("campaigns")
            .select("id")
            .eq("created_by", user.user_id)
            .gte("created_at", fourteenDaysAgo.toISOString()),
          supabase
            .from("monthly_patients")
            .select("source_id, patient_count, patient_sources!inner(name)")
            .eq("user_id", user.user_id)
            .eq("year_month", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
            .order("patient_count", { ascending: false })
            .limit(5),
        ]);

        const newPatients = (patientsRes.data || []).reduce((sum: number, r: any) => sum + (r.patient_count || 0), 0);
        const officesAdded = officesRes.data?.length || 0;
        const visitsCompleted = visitsRes.data?.length || 0;
        const campaignsSent = campaignsRes.data?.length || 0;
        const topOffices = (topOfficesRes.data || [])
          .filter((r: any) => r.patient_count > 0)
          .map((r: any) => ({
            name: (r as any).patient_sources?.name || "Unknown",
            count: r.patient_count,
          }));

        // Skip if no activity at all
        if (newPatients === 0 && officesAdded === 0 && visitsCompleted === 0 && campaignsSent === 0 && topOffices.length === 0) {
          continue;
        }

        const unsubscribeToken = await generateUnsubscribeToken(user.user_id, serviceRoleKey);
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/email-unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

        const html = await renderAsync(
          React.createElement(DigestEmail, {
            firstName: user.first_name || undefined,
            dateRange,
            newPatients,
            visitsCompleted,
            officesAdded,
            campaignsSent,
            topOffices,
            unsubscribeUrl,
          })
        );

        await resend.emails.send({
          from: "Nexora Dental <admin@nexoradental.com>",
          to: [user.email],
          subject: `Your Practice Summary — ${dateRange}`,
          html,
        });

        sentCount++;
      } catch (userError) {
        console.error(`Error sending digest to ${user.email}:`, userError);
      }
    }

    console.log(`Biweekly digest sent to ${sentCount} users`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in biweekly digest:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
