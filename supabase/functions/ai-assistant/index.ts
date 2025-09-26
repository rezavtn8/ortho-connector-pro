import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Types kept intentionally loose to be resilient to different callers already in the app
interface AnyObject { [key: string]: any }

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for auth header first
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ 
          content: "**Authentication Required** — Please sign in to access AI analysis features.",
          error: "No authorization header"
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnon) {
      console.log("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ 
          content: "**Configuration Error** — Service temporarily unavailable. Please try again later.",
          error: "Missing configuration"
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    // Parse request body defensively (support legacy shapes used around the app)
    const body: AnyObject = await req.json().catch(() => ({}));
    const taskType: string = body.task_type || body.context_type || "generic";
    const prompt: string = body.prompt || body.message || "";
    const ctx: AnyObject = body.context || {};

    // Try to resolve the user with better error handling
    let userId: string | null = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.log("Auth error:", authError.message);
        return new Response(
          JSON.stringify({ 
            content: "**Authentication Failed** — Please sign in again to access AI features.",
            error: "Authentication failed"
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      if (authData?.user?.id) {
        userId = authData.user.id;
        console.log(`Authenticated user: ${userId}`);
      } else {
        console.log("No user found in auth data");
        return new Response(
          JSON.stringify({ 
            content: "**User Not Found** — Please sign in to access AI analysis.",
            error: "User not found"
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
    } catch (authException) {
      console.error("Auth exception:", authException);
      return new Response(
        JSON.stringify({ 
          content: "**Authentication Error** — Unable to verify user. Please refresh and try again.",
          error: "Auth exception"
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Helper to fetch practice data from DB if we have a user; otherwise use provided context
    async function getPracticeData(): Promise<{ sources: AnyObject[]; monthly: AnyObject[]; visits: AnyObject[]; campaigns: AnyObject[] }> {
      // Prefer DB for freshest data when authenticated
      if (userId) {
        const [sourcesRes, monthlyRes, visitsRes, campaignsRes] = await Promise.all([
          supabase.from("patient_sources").select("*").eq("created_by", userId).limit(200),
          supabase.from("monthly_patients").select("*").eq("user_id", userId).limit(500),
          supabase.from("marketing_visits").select("*").eq("user_id", userId).limit(200),
          supabase.from("campaigns").select("*").eq("created_by", userId).limit(200),
        ]);

        return {
          sources: sourcesRes.data ?? [],
          monthly: monthlyRes.data ?? [],
          visits: visitsRes.data ?? [],
          campaigns: campaignsRes.data ?? [],
        };
      }

      // Fallback to whatever the caller sent us
      const practice = ctx.practice_data || ctx.unified_data || {};
      return {
        sources: practice.sources ?? [],
        monthly: practice.monthly_data ?? practice.monthly ?? [],
        visits: practice.visits ?? [],
        campaigns: practice.campaigns ?? [],
      };
    }

    // Basic metrics derived from data
    function summarize({ sources, monthly, visits, campaigns }: { sources: AnyObject[]; monthly: AnyObject[]; visits: AnyObject[]; campaigns: AnyObject[] }) {
      const nowYM = new Date().toISOString().slice(0, 7);
      const totalSources = sources.length;
      const activeSources = sources.filter((s) => s.is_active).length;
      const totalReferrals = monthly.reduce((sum, m) => sum + (m.patient_count || 0), 0);
      const thisMonth = monthly.filter((m) => m.year_month === nowYM).reduce((s, m) => s + (m.patient_count || 0), 0);

      const byType: Record<string, number> = {};
      for (const s of sources) {
        const t = (s.source_type ?? "Unknown").toString();
        byType[t] = (byType[t] || 0) + 1;
      }

      const visited = visits.filter((v) => v.visited).length;
      const activeCampaigns = campaigns.filter((c) => c.status === "Active").length;

      // Last 6 months trend (by user_id filter already applied at fetch)
      const months = [...new Set(monthly.map((m) => m.year_month))]
        .filter(Boolean)
        .sort()
        .slice(-6);
      const trend = months.map((ym) => ({
        year_month: ym,
        patient_count: monthly
          .filter((m) => m.year_month === ym)
          .reduce((s, m) => s + (m.patient_count || 0), 0),
      }));

      return { totalSources, activeSources, totalReferrals, thisMonth, byType, visited, activeCampaigns, trend };
    }

    // Text generators – no external AI dependency for reliability
    function generateQuickText(metrics: ReturnType<typeof summarize>): string {
      const parts: string[] = [];
      parts.push(`**Top Sources & Activity** — ${metrics.activeSources}/${metrics.totalSources} active. ${metrics.thisMonth} referrals this month.`);

      const topType = Object.entries(metrics.byType).sort((a, b) => b[1] - a[1])[0];
      if (topType) {
        parts.push(`**Dominant Source Type** — ${topType[0]} leads in count. Balance outreach to avoid over-reliance.`);
      }

      if (metrics.visited > 0) {
        parts.push(`**Marketing Execution** — ${metrics.visited} recent completed visits. Keep cadence and schedule follow-ups within 7 days.`);
      } else {
        parts.push(`**Marketing Execution** — No recent completed visits. Plan 3 targeted drop-ins this week focusing on low-activity sources.`);
      }

      parts.push(`Next steps: 1) Contact top 3 inactive sources, 2) Schedule 2 visits, 3) Send recap emails with availability.`);
      return parts.join("\n\n");
    }

    function generateComprehensiveText(metrics: ReturnType<typeof summarize>): string {
      const lines: string[] = [];
      lines.push(`**Referral Health** — ${metrics.totalSources} sources (${metrics.activeSources} active). Aim for >70% active to stabilize flow.`);

      const last = metrics.trend[metrics.trend.length - 1];
      const prev = metrics.trend[metrics.trend.length - 2];
      if (last && prev) {
        const diff = last.patient_count - prev.patient_count;
        const dir = diff >= 0 ? "up" : "down";
        const pct = prev.patient_count > 0 ? Math.round((Math.abs(diff) / prev.patient_count) * 100) : 0;
        lines.push(`**Trend** — ${last.year_month}: ${last.patient_count} patients (${dir} ${pct}%). Investigate drivers and replicate wins.`);
      }

      const typesSorted = Object.entries(metrics.byType).sort((a, b) => b[1] - a[1]);
      if (typesSorted.length) {
        const [t1, t2] = typesSorted;
        lines.push(`**Mix & Concentration** — ${t1[0]} dominates. ${t2 ? `Next: ${t2[0]}. ` : ""}Mitigate risk by nurturing underrepresented segments.`);
      }

      if (metrics.activeCampaigns > 0) {
        lines.push(`**Campaigns** — ${metrics.activeCampaigns} active. Add clear follow-up steps and measure conversion by source.`);
      } else {
        lines.push(`**Campaigns** — No active campaigns. Launch a 4-week referral refresh cadence with weekly touchpoints.`);
      }

      lines.push(`**Actions** — 1) Reactivate 3 lapsed sources, 2) Set monthly KPI review, 3) Standardize post-visit email within 24h.`);
      return lines.join("\n\n");
    }

    // Build response text
    const data = await getPracticeData();
    const metrics = summarize(data);

    let content = "";
    const normalized = (taskType || "").toLowerCase();

    if (normalized.includes("quick") || normalized.includes("consult")) {
      content = generateQuickText(metrics);
    } else if (normalized.includes("analysis") || normalized.includes("business_intelligence") || normalized.includes("comprehensive")) {
      content = generateComprehensiveText(metrics);
    } else {
      // Generic fallback so callers always get something useful
      content = generateQuickText(metrics);
      if (prompt) content += `\n\n**Note** — Addressing your question: ${prompt}`;
    }

    // Best-effort logging (non-blocking)
    try {
      if (userId) {
        await supabase.from("ai_usage_tracking").insert({
          user_id: userId,
          task_type: normalized || "generic",
          success: true,
          request_data: { prompt: prompt?.slice(0, 200) },
          response_data: { preview: content.slice(0, 200) },
        });
      }
    } catch (_) {}

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ai-assistant fatal error:", err);
    const fallback = "**We hit a temporary issue.** Here are immediate steps: 1) Revisit top sources this week, 2) Email recap to recent referrers, 3) Review month-to-date referrals and set 2 KPIs.";
    return new Response(
      JSON.stringify({ content: fallback, error: err instanceof Error ? err.message : String(err) }),
      { 
        status: 200, // Always return 200 to prevent client-side errors
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      },
    );
  }
});
