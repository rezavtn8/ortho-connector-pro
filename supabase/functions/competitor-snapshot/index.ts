/**
 * Competitor watchlist and daily snapshots.
 *
 * Google access lives in places.ts; this module owns authentication, the
 * actions the page calls, and persistence.
 *
 * Three rules shape the design:
 *
 *  1. **A snapshot is only written when Google actually answered.** The old
 *     code stored whatever came back from a details call wrapped in a
 *     try/catch, so a throttled request recorded a real practice as having
 *     zero reviews and poisoned every trend drawn through that point.
 *
 *  2. **Refresh is idempotent and never billed twice in a day.** Entries
 *     already snapshotted today are skipped unless the caller forces it, which
 *     is what makes it safe for the page to offer a refresh button and for a
 *     cron to call the same action.
 *
 *  3. **Nothing bills Google on page load.** `bootstrap` is database-only. The
 *     page used to re-run the `add` action on every mount to keep the
 *     practice's own row current, which cost a Place Details call each time
 *     the tab was opened.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { PlaceResult, PlacesClient } from "./places.ts";

/** Ceiling on billed Google calls for one invocation. */
const MAX_GOOGLE_REQUESTS = Number(Deno.env.get("COMPETITOR_MAX_REQUESTS") ?? 60);

/** Watchlist entries refreshed concurrently. */
const REFRESH_CONCURRENCY = 4;

/** Hard cap on tracked competitors, so refresh cost stays predictable. */
const MAX_WATCHLIST = 25;

/**
 * Days between scheduled snapshots of the same practice.
 *
 * Every Google call is billed, so the sweep samples every third day rather
 * than nightly. Trends and the review race are unaffected — velocity is
 * measured over real elapsed days, not per snapshot — and surge detection
 * compares a competitor against their own baseline, so a wider spacing shifts
 * when a surge is noticed rather than whether it is.
 *
 * This gate, not the cron expression, is what guarantees the spacing: it holds
 * even if the schedule fires early, twice, or after a missed run.
 */
const SNAPSHOT_INTERVAL_DAYS = Number(
  Deno.env.get("COMPETITOR_SNAPSHOT_INTERVAL_DAYS") ?? 3,
);

/**
 * The manual Refresh button stays same-day: someone who pressed it and waited
 * expects today's numbers, not "come back on Thursday".
 */
const MANUAL_INTERVAL_DAYS = 1;

const DEFAULT_SEARCH_RADIUS_MILES = 10;
const MAX_SEARCH_RADIUS_MILES = 30;

/** Office types treated as competing for the same referrals. */
const DENTAL_FAMILY = [
  "dent",
  "ortho",
  "endo",
  "perio",
  "prosth",
  "oral",
  "maxillo",
  "pedodont",
  "implant",
];

interface WatchlistRow {
  id: string;
  google_place_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req, {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  });

  if (req.method === "OPTIONS") return handleCorsPreflight(req, corsHeaders);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const entry = body?.watchlist_entry ?? {};

    // ---------------------------------------------------------- refresh-all
    //
    // The scheduled path. A watch that only updates when someone opens the tab
    // has no history on the days that matter, so this exists to be called
    // nightly for every account at once.
    //
    // It cannot use the user JWT the other actions use — there is no user on a
    // cron — so it is authorised by a shared secret instead. Unset secret means
    // the endpoint stays closed rather than open.
    if (action === "refresh-all") {
      const expected = Deno.env.get("COMPETITOR_CRON_SECRET");
      const presented = req.headers.get("x-cron-secret");
      if (!expected || presented !== expected) {
        console.warn("[competitor] refresh-all rejected: bad or missing cron secret");
        return json({ error: "Unauthorized" }, 401);
      }
      return json(await refreshAllUsers(supabase));
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claims, error: claimsError } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claims?.user?.id) return json({ error: "Unauthorized" }, 401);
    const userId = claims.user.id;

    // ------------------------------------------------------------ bootstrap
    //
    // Make sure the practice's own Google listing is tracked, so ranks and the
    // review race have a "you" line. Database only — no Google call.
    if (action === "bootstrap") {
      const clinic = await loadClinic(supabase, userId);
      if (!clinic?.google_place_id) {
        return json({ success: true, tracked: false, reason: "clinic-has-no-place-id" });
      }

      const { error } = await supabase.from("competitor_watchlist").upsert(
        {
          user_id: userId,
          google_place_id: clinic.google_place_id,
          name: clinic.name,
          address: clinic.address,
          specialty: clinic.specialty ?? "dentist",
          latitude: clinic.latitude,
          longitude: clinic.longitude,
          clinic_id: clinic.id,
          is_active: true,
        },
        { onConflict: "user_id,google_place_id" },
      );
      if (error) throw error;

      return json({ success: true, tracked: true });
    }

    // ------------------------------------------------------------------ add
    if (action === "add") {
      // `name` is NOT NULL on the table, so an entry missing it would surface
      // as an opaque 500 rather than a usable message.
      if (!entry.google_place_id || !entry.name) {
        return json({ error: "google_place_id and name are required" }, 400);
      }

      const { count } = await supabase
        .from("competitor_watchlist")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_active", true);

      // Re-adding an existing entry is an update, not a new slot, so it is
      // allowed even at the cap.
      const { data: existing } = await supabase
        .from("competitor_watchlist")
        .select("id")
        .eq("user_id", userId)
        .eq("google_place_id", entry.google_place_id)
        .maybeSingle();

      if (!existing && (count ?? 0) >= MAX_WATCHLIST) {
        return json(
          { error: `Watchlist is limited to ${MAX_WATCHLIST} practices. Remove one to add another.` },
          400,
        );
      }

      const { data: row, error } = await supabase
        .from("competitor_watchlist")
        .upsert(
          {
            user_id: userId,
            google_place_id: entry.google_place_id,
            name: entry.name,
            address: entry.address ?? null,
            specialty: entry.specialty ?? null,
            latitude: entry.latitude ?? null,
            longitude: entry.longitude ?? null,
            clinic_id: entry.clinic_id ?? null,
            is_active: true,
          },
          { onConflict: "user_id,google_place_id" },
        )
        .select()
        .single();
      if (error) throw error;

      const places = new PlacesClient(requireApiKey(), MAX_GOOGLE_REQUESTS);
      const snapshot = await snapshotEntry(supabase, places, userId, row);

      return json({
        success: true,
        data: row,
        snapshot,
        diagnostics: places.diagnostics,
      });
    }

    // --------------------------------------------------------------- remove
    if (action === "remove") {
      if (!entry.id) return json({ error: "id is required" }, 400);

      // Snapshots cascade on the foreign key, so the history goes with it.
      const { error } = await supabase
        .from("competitor_watchlist")
        .delete()
        .eq("id", entry.id)
        .eq("user_id", userId);
      if (error) throw error;

      return json({ success: true });
    }

    // -------------------------------------------------------------- refresh
    if (action === "refresh") {
      const places = new PlacesClient(requireApiKey(), MAX_GOOGLE_REQUESTS);
      const result = await refreshUser(supabase, places, userId, {
        force: body?.force === true,
        intervalDays: MANUAL_INTERVAL_DAYS,
      });
      return json({ success: true, ...result, diagnostics: places.diagnostics });
    }

    // --------------------------------------------------------------- search
    if (action === "search") {
      const clinic = await loadClinic(supabase, userId);
      const lat = numberOrNull(entry.latitude) ?? numberOrNull(clinic?.latitude);
      const lng = numberOrNull(entry.longitude) ?? numberOrNull(clinic?.longitude);
      if (lat == null || lng == null) {
        return json({ error: "Set your clinic address before searching" }, 400);
      }

      const query = (entry.specialty || clinic?.specialty || "dentist").toString().slice(0, 120);
      const radius = Math.min(
        MAX_SEARCH_RADIUS_MILES,
        Math.max(1, numberOrNull(entry.radius_miles) ?? DEFAULT_SEARCH_RADIUS_MILES),
      );

      const places = new PlacesClient(requireApiKey(), MAX_GOOGLE_REQUESTS);
      const found = await places.search(query, lat, lng, radius);

      const excluded = await excludedPlaceIds(supabase, userId, clinic?.google_place_id ?? null);
      const results = found
        .filter((p) => !excluded.has(p.google_place_id))
        // A closed practice is not a competitor.
        .filter((p) => p.business_status == null || p.business_status === "OPERATIONAL")
        .map((p) => withDistance(p, lat, lng, query))
        .sort((a, b) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));

      return json({ success: true, results, diagnostics: places.diagnostics });
    }

    // -------------------------------------------------------------- suggest
    //
    // Reuses offices already discovered, so suggestions cost nothing.
    if (action === "suggest") {
      const clinic = await loadClinic(supabase, userId);
      const specialty = (entry.specialty || clinic?.specialty || "dentist").toString().toLowerCase();
      const excluded = await excludedPlaceIds(supabase, userId, clinic?.google_place_id ?? null);

      const { data: discovered } = await supabase
        .from("discovered_offices")
        .select(
          "name, address, google_place_id, google_rating, user_ratings_total, latitude, longitude, office_type, distance_miles",
        )
        .eq("discovered_by", userId)
        .eq("is_active", true)
        .order("distance_miles", { ascending: true })
        .limit(120);

      const wantsDental = DENTAL_FAMILY.some((kw) => specialty.includes(kw));

      const results = (discovered ?? [])
        .filter((d) => d.google_place_id && !excluded.has(d.google_place_id))
        .filter((d) => {
          const type = (d.office_type ?? "").toLowerCase();
          if (!type || type === "unknown") return true;
          if (wantsDental) return DENTAL_FAMILY.some((kw) => type.includes(kw));
          return type.includes(specialty) || specialty.includes(type);
        })
        // Nearest 120 are fetched, then ranked by prominence rather than by
        // distance: the practice two miles away with 400 reviews is a bigger
        // competitor than the one next door with none, and sorting this way
        // sinks the zero-review listings to the bottom on its own.
        .sort((a, b) => (b.user_ratings_total ?? 0) - (a.user_ratings_total ?? 0))
        .slice(0, 12)
        .map((d) => ({
          google_place_id: d.google_place_id,
          name: d.name,
          address: d.address,
          latitude: d.latitude,
          longitude: d.longitude,
          google_rating: d.google_rating,
          review_count: d.user_ratings_total,
          specialty: d.office_type ?? specialty,
          distance_miles: d.distance_miles,
        }));

      return json({ success: true, results });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error: any) {
    console.error("[competitor] unhandled error:", error);
    return json({ error: error?.message ?? "Unexpected error" }, 500);
  }
});

// ------------------------------------------------------------------ helpers

function requireApiKey(): string {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  return key;
}

/** `YYYY-MM-DD` in UTC, matching the `snapshot_date` column's semantics. */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` for `n` days before today, UTC. `n = 0` is today. */
function utcDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function loadClinic(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("clinic_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.clinic_id) return null;

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, address, latitude, longitude, google_place_id, specialty")
    .eq("id", profile.clinic_id)
    .maybeSingle();
  return clinic ?? null;
}

/** Place ids that must never appear as a suggestion: already watched, or us. */
async function excludedPlaceIds(
  supabase: any,
  userId: string,
  clinicPlaceId: string | null,
): Promise<Set<string>> {
  const { data: watched } = await supabase
    .from("competitor_watchlist")
    .select("google_place_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  const ids = new Set<string>((watched ?? []).map((w: any) => w.google_place_id));
  if (clinicPlaceId) ids.add(clinicPlaceId);
  return ids;
}

function withDistance(place: PlaceResult, lat: number, lng: number, specialty: string) {
  const distance =
    place.latitude != null && place.longitude != null
      ? haversineMiles(lat, lng, place.latitude, place.longitude)
      : null;
  return {
    ...place,
    specialty,
    distance_miles: distance == null ? null : Math.round(distance * 10) / 10,
  };
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface RefreshOutcome {
  refreshed: number;
  skipped: number;
  failed: number;
  upToDate?: boolean;
}

interface RefreshOptions {
  /** Snapshot regardless of how recently the practice was last captured. */
  force?: boolean;
  /** Minimum age of the newest snapshot before a practice is due again. */
  intervalDays?: number;
}

/**
 * Snapshot every practice one user watches.
 *
 * A practice is due when its newest snapshot is at least `intervalDays` old,
 * so this is safe to call from both a button and a schedule without paying
 * Google twice for the same window. `force` overrides the gate entirely.
 */
async function refreshUser(
  supabase: any,
  places: PlacesClient,
  userId: string,
  { force = false, intervalDays = MANUAL_INTERVAL_DAYS }: RefreshOptions = {},
): Promise<RefreshOutcome> {
  const { data: watchlist, error } = await supabase
    .from("competitor_watchlist")
    .select("id, google_place_id, name, latitude, longitude")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw error;

  if (!watchlist?.length) return { refreshed: 0, skipped: 0, failed: 0 };

  // Anything captured on or after this date is still fresh. At intervalDays=1
  // that is today alone; at 3 it is today and the two days before it.
  const freshFrom = utcDaysAgo(Math.max(0, intervalDays - 1));

  // One range query beats one existence check per entry.
  const { data: recent } = await supabase
    .from("competitor_snapshots")
    .select("watchlist_id")
    .eq("user_id", userId)
    .gte("snapshot_date", freshFrom);
  const stillFresh = new Set((recent ?? []).map((s: any) => s.watchlist_id));

  const due = force ? watchlist : watchlist.filter((w: WatchlistRow) => !stillFresh.has(w.id));
  const skipped = watchlist.length - due.length;

  if (due.length === 0) return { refreshed: 0, skipped, failed: 0, upToDate: true };

  const results = await mapWithConcurrency(due, REFRESH_CONCURRENCY, (row: WatchlistRow) =>
    snapshotEntry(supabase, places, userId, row).catch((e) => {
      console.error(`[competitor] refresh failed for ${row.name}:`, e);
      return null;
    }),
  );

  const refreshed = results.filter(Boolean).length;
  return { refreshed, skipped, failed: due.length - refreshed };
}

/**
 * The nightly sweep: every account that watches anything.
 *
 * Users are processed one at a time with a fresh request budget each, so one
 * account with a full watchlist cannot exhaust the budget and leave everyone
 * after it without a snapshot for the day. A user whose refresh throws is
 * logged and stepped over rather than aborting the run.
 */
async function refreshAllUsers(supabase: any) {
  const { data: rows, error } = await supabase
    .from("competitor_watchlist")
    .select("user_id")
    .eq("is_active", true);
  if (error) throw error;

  const userIds = [...new Set((rows ?? []).map((r: any) => r.user_id as string))];
  const apiKey = requireApiKey();

  let refreshed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    try {
      const places = new PlacesClient(apiKey, MAX_GOOGLE_REQUESTS);
      const result = await refreshUser(supabase, places, userId as string, {
        intervalDays: SNAPSHOT_INTERVAL_DAYS,
      });
      refreshed += result.refreshed;
      failed += result.failed;
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[competitor] refresh-all failed for user ${userId}:`, message);
      if (errors.length < 5) errors.push(message);
    }
  }

  console.log(
    `[competitor] refresh-all covered ${userIds.length} users, ${refreshed} snapshots, ${failed} failures`,
  );
  return { success: true, users: userIds.length, refreshed, failed, errors };
}

/**
 * Fetch and store one competitor's current standing.
 *
 * Velocity is measured against the most recent snapshot *strictly before
 * today*. The previous version took the latest snapshot of any date, so a
 * second refresh on the same day compared today's row against itself, computed
 * a zero-day delta and overwrote a real velocity with 0.
 *
 * Returns null without writing when Google did not answer, so a failed call
 * cannot enter the history as a genuine collapse to zero reviews.
 */
async function snapshotEntry(
  supabase: any,
  places: PlacesClient,
  userId: string,
  row: WatchlistRow,
) {
  const details = await places.details(row.google_place_id);
  if (!details) {
    console.warn(`[competitor] no details for ${row.name} (${row.google_place_id})`);
    return null;
  }

  const today = utcToday();

  const { data: previous } = await supabase
    .from("competitor_snapshots")
    .select("review_count, snapshot_date")
    .eq("watchlist_id", row.id)
    .lt("snapshot_date", today)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let velocity = 0;
  if (previous) {
    const days = Math.max(
      1,
      Math.round(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${previous.snapshot_date}T00:00:00Z`)) /
          86_400_000,
      ),
    );
    const gained = (details.reviewCount ?? 0) - (previous.review_count ?? 0);
    velocity = Math.round((gained / days) * 7 * 100) / 100;
  }

  const { error } = await supabase.from("competitor_snapshots").upsert(
    {
      watchlist_id: row.id,
      user_id: userId,
      google_rating: details.rating,
      review_count: details.reviewCount,
      review_velocity: velocity,
      snapshot_date: today,
      raw_data: {
        types: details.types,
        business_status: details.businessStatus,
        reviews: details.reviews,
        captured_at: new Date().toISOString(),
      },
    },
    { onConflict: "watchlist_id,snapshot_date" },
  );
  if (error) throw error;

  // Google is the authority on a practice's name; keep the watchlist in step
  // so a rebrand does not leave a stale label on the chart.
  if (details.name && details.name !== row.name) {
    await supabase.from("competitor_watchlist").update({ name: details.name }).eq("id", row.id);
  }

  return {
    watchlist_id: row.id,
    rating: details.rating,
    review_count: details.reviewCount,
    review_velocity: velocity,
  };
}

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}
