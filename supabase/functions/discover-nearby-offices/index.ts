/**
 * Discover dental offices around a clinic (or an arbitrary ZIP code).
 *
 * The search itself lives in places.ts; this module owns authentication, the
 * search plan, the cache, and persistence.
 *
 * Two rules shape the design:
 *
 *  1. Everything dental inside the radius gets saved. Quality preferences
 *     (rating floor, "has a website", specialty vs general) are applied by the
 *     caller when rendering, never when fetching. Filtering during the fetch
 *     meant the cached result set depended on whichever filters happened to be
 *     set on the first search, so changing a filter afterwards showed results
 *     that no longer matched anything.
 *
 *  2. Nothing outside the radius gets saved. Distance is computed and stored
 *     for every office, and anything beyond the requested radius is dropped.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  LatLng,
  boundingBox,
  chooseTileRadius,
  haversineMiles,
  mapWithConcurrency,
  subdivideTile,
  tileCircle,
} from "./geo.ts";
import { PlacesClient, RawPlace } from "./places.ts";
import { inferOfficeType, isDentalPractice, normalizeName } from "./classify.ts";

/** Discovered offices stay valid for a week before Google is asked again. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Ceiling on billed Google calls for one discovery. */
const MAX_GOOGLE_REQUESTS = Number(Deno.env.get("DISCOVERY_MAX_REQUESTS") ?? 160);

/** Stop issuing new Google calls after this long and return what we have. */
const SEARCH_DEADLINE_MS = Number(Deno.env.get("DISCOVERY_DEADLINE_MS") ?? 90_000);

/** Fresh (non-cached) searches allowed per user per rolling 7 days. */
const WEEKLY_LIMIT = Number(Deno.env.get("DISCOVERY_WEEKLY_LIMIT") ?? 25);

/** Roughly how many tiles to spend covering the requested radius. */
const TILE_BUDGET = 24;

const MIN_RADIUS_MILES = 1;
const MAX_RADIUS_MILES = 50;

/**
 * Keyword passes run in addition to the `dentist` tile sweep.
 *
 * Nearby search only accepts one type, and Google files a lot of specialists
 * under something other than `dentist`, so these queries are the only way most
 * oral surgeons and orthodontists show up at all.
 */
const SPECIALTY_QUERIES = [
  "orthodontist",
  "oral and maxillofacial surgeon",
  "endodontist",
  "periodontist",
  "pediatric dentist",
  "prosthodontist",
  "dental implants specialist",
  "dental clinic",
];

interface DiscoveryRequest {
  clinic_id?: string;
  distance?: number;
  search_lat?: number;
  search_lng?: number;
  zip_code_override?: string | null;
  office_type_filter?: string | null;
  force_refresh?: boolean;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });

  if (req.method === "OPTIONS") return handleCorsPreflight(req, corsHeaders);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const startedAt = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ------------------------------------------------------------ auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("JWT verification failed:", claimsError);
      return json({ success: false, error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // --------------------------------------------------------- request
    const body = (await req.json().catch(() => ({}))) as DiscoveryRequest;
    const { clinic_id: clinicId, zip_code_override: zipOverride, force_refresh: forceRefresh } = body;

    if (!clinicId) return json({ success: false, error: "clinic_id is required" }, 400);

    const requestedDistance = Number(body.distance ?? 10);
    if (!Number.isFinite(requestedDistance)) {
      return json({ success: false, error: "distance must be a number" }, 400);
    }
    const distance = Math.min(MAX_RADIUS_MILES, Math.max(MIN_RADIUS_MILES, requestedDistance));

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("latitude, longitude, name, google_place_id")
      .eq("id", clinicId)
      .single();

    if (clinicError || !clinic) return json({ success: false, error: "Clinic not found" }, 404);

    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!googleApiKey) {
      return json({ success: false, error: "Google Maps API key not configured" }, 500);
    }

    const places = new PlacesClient(
      googleApiKey,
      MAX_GOOGLE_REQUESTS,
      startedAt + SEARCH_DEADLINE_MS,
    );

    // ------------------------------------------------ resolve the center
    //
    // The ZIP override used to be stored on the session and then ignored: the
    // search always ran on whatever coordinates the client sent, which were
    // always the clinic's. Typing a ZIP code did nothing at all.
    let center: LatLng | null = null;
    let centerLabel = clinic.name ? `${clinic.name} (your clinic)` : "your clinic";
    const zip = typeof zipOverride === "string" ? zipOverride.trim() : "";

    if (zip) {
      if (!/^\d{5}$/.test(zip)) {
        return json({ success: false, error: `"${zip}" is not a valid 5-digit ZIP code` }, 400);
      }
      const geocoded = await places.geocodePostalCode(zip, "US");
      if (!geocoded) {
        return json(
          { success: false, error: `Could not find ZIP code ${zip}. Check it and try again.` },
          400,
        );
      }
      center = geocoded.center;
      centerLabel = geocoded.label;
    } else {
      const lat = Number(body.search_lat ?? clinic.latitude);
      const lng = Number(body.search_lng ?? clinic.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) center = { lat, lng };
    }

    if (!center) {
      return json(
        {
          success: false,
          error:
            "No search location available. Add your clinic address in Settings, or search by ZIP code.",
        },
        400,
      );
    }

    // ----------------------------------------------------------- cache
    if (!forceRefresh) {
      const cached = await readCache(supabase, userId, clinicId, center, distance);
      if (cached) {
        const offices = await markImported(supabase, userId, cached.offices);
        const inNetwork = offices.filter((o) => o.imported).length;

        const { data: session } = await supabase
          .from("discovery_sessions")
          .insert({
            user_id: userId,
            clinic_id: clinicId,
            search_distance: distance,
            search_lat: center.lat,
            search_lng: center.lng,
            office_type_filter: body.office_type_filter ?? null,
            zip_code_override: zip || null,
            api_call_made: false,
            cache_hit: true,
            cache_age_seconds: cached.ageSeconds,
            results_count: offices.length,
          })
          .select("id")
          .single();

        return json({
          success: true,
          cached: true,
          cacheAge: cached.ageSeconds,
          expiresIn: cached.expiresInSeconds,
          message: `Loaded ${offices.length} offices found earlier (${formatAge(cached.ageSeconds)} ago)`,
          offices,
          sessionId: session?.id ?? null,
          totalOfficesCount: offices.length,
          newOfficesCount: offices.length - inNetwork,
          alreadyInNetworkCount: inNetwork,
          searchCenter: { ...center, label: centerLabel },
          usage: await readUsage(supabase, userId),
          canRefresh: true,
        });
      }
    }

    // ------------------------------------------------------ rate limit
    const usage = await readUsage(supabase, userId);
    if (usage.used >= usage.limit) {
      return json(
        {
          success: false,
          error: `You've used all ${usage.limit} fresh searches for this week. Cached results are still available, and the limit resets ${usage.resetsAt ? `on ${new Date(usage.resetsAt).toLocaleDateString("en-US")}` : "in a few days"}.`,
          usage,
        },
        429,
      );
    }

    // -------------------------------------------------------- session
    const { data: session, error: sessionError } = await supabase
      .from("discovery_sessions")
      .insert({
        user_id: userId,
        clinic_id: clinicId,
        search_distance: distance,
        search_lat: center.lat,
        search_lng: center.lng,
        office_type_filter: body.office_type_filter ?? null,
        zip_code_override: zip || null,
        api_call_made: true,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("Error creating discovery session:", sessionError);
      return json({ success: false, error: "Failed to start the search" }, 500);
    }

    // --------------------------------------------------------- search
    const found = await runSearch(places, center, distance);
    console.log(
      `[discover] ${found.size} raw places via ${places.diagnostics.provider} ` +
        `in ${places.diagnostics.requests} requests`,
    );

    // ------------------------------------------------------- filtering
    const ownClinicPlaceId = clinic.google_place_id ?? null;
    const ownClinicName = clinic.name ? normalizeName(clinic.name) : "";

    const kept: Array<RawPlace & { distanceMiles: number; officeType: string }> = [];
    for (const place of found.values()) {
      if (!place.placeId || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) continue;

      // Google keeps returning shuttered practices; they are not referral targets.
      if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;

      if (!isDentalPractice(place)) continue;

      if (ownClinicPlaceId && place.placeId === ownClinicPlaceId) continue;

      const distanceMiles = haversineMiles(center, { lat: place.lat, lng: place.lng });

      // Same name within a block of the search center is the user's own office
      // under a second listing.
      if (ownClinicName && distanceMiles < 0.15 && normalizeName(place.name) === ownClinicName) {
        continue;
      }

      // The radius is a promise. 2% of slack absorbs the difference between
      // Google's rounding and ours without letting real outliers through.
      if (distanceMiles > distance * 1.02) continue;

      kept.push({ ...place, distanceMiles, officeType: inferOfficeType(place) });
    }

    kept.sort((a, b) => a.distanceMiles - b.distanceMiles);

    // Legacy search results have no phone or website until we ask for them,
    // and now we only ask for the offices we are actually keeping.
    await places.enrichLegacy(kept);

    // ------------------------------------------------------- persistence
    const existing = await loadNetworkIndex(supabase, userId);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    const now = new Date().toISOString();

    const rows = kept.map((office) => ({
      google_place_id: office.placeId,
      name: office.name,
      address: office.address,
      phone: office.phone,
      website: office.website,
      google_rating: office.rating,
      user_ratings_total: office.ratingCount,
      latitude: office.lat,
      longitude: office.lng,
      distance_miles: Number(office.distanceMiles.toFixed(2)),
      office_type: office.officeType,
      discovered_by: userId,
      clinic_id: clinicId,
      source: "google",
      search_distance: distance,
      search_location_lat: center.lat,
      search_location_lng: center.lng,
      discovery_session_id: session.id,
      cache_expires_at: expiresAt,
      last_verified_at: now,
      is_active: true,
      inNetwork: isInNetwork(existing, office),
    }));

    const saved = await persist(supabase, rows);
    const inNetworkCount = saved.filter((o) => o.imported).length;

    await supabase
      .from("discovery_sessions")
      .update({
        api_response_time_ms: Date.now() - startedAt,
        results_count: saved.length,
      })
      .eq("id", session.id);

    const diagnostics = places.diagnostics;
    const incomplete = diagnostics.budgetExhausted || diagnostics.timedOut;

    return json({
      success: true,
      cached: false,
      message: buildMessage(saved.length, distance, centerLabel, incomplete),
      offices: saved,
      sessionId: session.id,
      totalOfficesCount: saved.length,
      newOfficesCount: saved.length - inNetworkCount,
      alreadyInNetworkCount: inNetworkCount,
      searchCenter: { ...center, label: centerLabel },
      finalRadius: distance,
      usage: await readUsage(supabase, userId),
      diagnostics: {
        provider: diagnostics.provider,
        googleRequests: diagnostics.requests,
        failedRequests: diagnostics.failures,
        tilesSearched: diagnostics.tilesSearched,
        tilesSubdivided: diagnostics.tilesSubdivided,
        rawPlaces: found.size,
        keptOffices: saved.length,
        elapsedMs: Date.now() - startedAt,
        coverageIncomplete: incomplete,
        warnings: diagnostics.errors,
      },
      canRefresh: true,
    });
  } catch (error) {
    console.error("Error in discover-nearby-offices:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        canRefresh: true,
      },
      500,
    );
  }
});

/**
 * Sweep the area with nearby-search tiles, subdivide the ones that came back
 * full, then run the specialty keyword passes.
 *
 * Subdivision is what makes a dense downtown work. A tile that returns a full
 * page is Google saying "there are more here than I will show you"; splitting
 * it into seven smaller circles surfaces the rest instead of pretending the
 * neighbourhood only has 20 dentists.
 */
async function runSearch(
  places: PlacesClient,
  center: LatLng,
  distance: number,
): Promise<Map<string, RawPlace>> {
  const found = new Map<string, RawPlace>();
  const collect = (batch: RawPlace[]) => {
    for (const place of batch) {
      if (!place?.placeId) continue;
      const existing = found.get(place.placeId);
      // Keep whichever copy carries more detail — the keyword passes sometimes
      // return a website the tile sweep did not.
      if (!existing || score(place) > score(existing)) found.set(place.placeId, place);
    }
  };

  const tileRadius = chooseTileRadius(distance, TILE_BUDGET);
  const tiles = tileCircle(center, distance, tileRadius);
  console.log(`[discover] ${tiles.length} tiles of ${tileRadius.toFixed(1)}mi covering ${distance}mi`);

  const sweep = await mapWithConcurrency(tiles, 8, (tile) => places.searchTile(tile, tileRadius));
  sweep.forEach((r) => collect(r.places));

  const saturated = tiles.filter((_, i) => sweep[i]?.saturated);
  if (saturated.length > 0 && places.canSpend) {
    const children = saturated.flatMap((tile) => subdivideTile(tile, tileRadius).slice(1));
    places.diagnostics.tilesSubdivided = saturated.length;
    console.log(`[discover] subdividing ${saturated.length} saturated tiles into ${children.length}`);

    const deeper = await mapWithConcurrency(children, 8, (tile) =>
      places.searchTile(tile, tileRadius / 2),
    );
    deeper.forEach((r) => collect(r.places));
  }

  const area = boundingBox(center, distance);
  const keyword = await mapWithConcurrency(SPECIALTY_QUERIES, 4, (query) =>
    places.canSpend ? places.searchText(query, area) : Promise.resolve([]),
  );
  keyword.forEach(collect);

  return found;
}

/** How complete a place record is, used to pick between duplicate hits. */
function score(place: RawPlace): number {
  return (
    (place.address ? 1 : 0) +
    (place.phone ? 1 : 0) +
    (place.website ? 1 : 0) +
    (place.rating != null ? 1 : 0) +
    (place.primaryType ? 1 : 0)
  );
}

interface CacheHit {
  offices: any[];
  ageSeconds: number;
  expiresInSeconds: number;
}

/**
 * Unexpired offices from an earlier search around the same point.
 *
 * A previous wider search covers a narrower one, so a 5-mile request happily
 * reuses the results of a 10-mile search rather than re-billing Google — the
 * stored `distance_miles` is what trims it back down. The old cache lookup
 * ignored the search center entirely, so searching a ZIP code across the state
 * returned the offices next to your clinic.
 */
async function readCache(
  supabase: any,
  userId: string,
  clinicId: string,
  center: LatLng,
  distance: number,
): Promise<CacheHit | null> {
  // ~0.35 miles of tolerance, so a re-run from the same clinic still matches.
  const eps = 0.005;

  const { data, error } = await supabase
    .from("discovered_offices")
    .select("*")
    .eq("discovered_by", userId)
    .eq("clinic_id", clinicId)
    .gte("search_distance", distance)
    .gte("search_location_lat", center.lat - eps)
    .lte("search_location_lat", center.lat + eps)
    .gte("search_location_lng", center.lng - eps)
    .lte("search_location_lng", center.lng + eps)
    .gt("cache_expires_at", new Date().toISOString())
    .order("fetched_at", { ascending: false });

  if (error) {
    console.error("Cache lookup failed:", error);
    return null;
  }
  if (!data || data.length === 0) return null;

  const withinRadius = data.filter((office: any) => {
    if (office.distance_miles != null) return office.distance_miles <= distance * 1.02;
    if (office.latitude == null || office.longitude == null) return false;
    return (
      haversineMiles(center, { lat: office.latitude, lng: office.longitude }) <= distance * 1.02
    );
  });

  if (withinRadius.length === 0) return null;

  const newest = data[0];
  return {
    offices: withinRadius,
    ageSeconds: Math.max(0, Math.floor((Date.now() - new Date(newest.fetched_at).getTime()) / 1000)),
    expiresInSeconds: Math.max(
      0,
      Math.floor((new Date(newest.cache_expires_at).getTime() - Date.now()) / 1000),
    ),
  };
}

interface NetworkIndex {
  placeIds: Set<string>;
  byName: Map<string, Array<{ lat: number | null; lng: number | null }>>;
}

async function loadNetworkIndex(supabase: any, userId: string): Promise<NetworkIndex> {
  const { data } = await supabase
    .from("patient_sources")
    .select("google_place_id, name, latitude, longitude")
    .eq("created_by", userId);

  const index: NetworkIndex = { placeIds: new Set(), byName: new Map() };
  for (const source of data ?? []) {
    if (source.google_place_id) index.placeIds.add(source.google_place_id);
    const key = normalizeName(source.name ?? "");
    if (!key) continue;
    const list = index.byName.get(key) ?? [];
    list.push({ lat: source.latitude, lng: source.longitude });
    index.byName.set(key, list);
  }
  return index;
}

/**
 * Whether this office is already a referral source.
 *
 * Place ID is authoritative. The name fallback additionally requires the two
 * to be within a quarter mile, because "Smile Dental" is not a unique name and
 * matching on it alone would hide unrelated practices in other towns.
 */
function isInNetwork(index: NetworkIndex, place: RawPlace): boolean {
  if (index.placeIds.has(place.placeId)) return true;

  const candidates = index.byName.get(normalizeName(place.name));
  if (!candidates) return false;

  return candidates.some(
    (c) =>
      c.lat != null &&
      c.lng != null &&
      haversineMiles({ lat: c.lat, lng: c.lng }, { lat: place.lat, lng: place.lng }) < 0.25,
  );
}

/**
 * Write the offices and return the stored rows.
 *
 * Returning the stored rows matters: the UI keys selection off `id`, and the
 * previous version returned freshly-built objects that had no `id` at all, so
 * every checkbox in a fresh result set shared the key `undefined`.
 *
 * Offices already in the network are written separately and without an
 * `imported` key, so re-running discovery can set the flag but never clear one.
 */
async function persist(supabase: any, rows: any[]): Promise<any[]> {
  if (rows.length === 0) return [];

  const inNetwork = rows.filter((r) => r.inNetwork).map(({ inNetwork: _, ...r }) => ({
    ...r,
    imported: true,
  }));
  const fresh = rows.filter((r) => !r.inNetwork).map(({ inNetwork: _, ...r }) => r);

  const saved: any[] = [];
  for (const batch of [inNetwork, fresh]) {
    if (batch.length === 0) continue;
    saved.push(...(await upsertOffices(supabase, batch)));
  }
  return saved;
}

/**
 * Upsert scoped to the discovering user.
 *
 * `discovered_offices` shipped with a global `UNIQUE (google_place_id)`, so
 * upserting on that column hands another user's row to whoever searched most
 * recently — their office silently disappears from their own list. The
 * per-user conflict target is correct; the fallback only exists for projects
 * where the accompanying migration has not been applied yet.
 */
async function upsertOffices(supabase: any, batch: any[]): Promise<any[]> {
  const perUser = await supabase
    .from("discovered_offices")
    .upsert(batch, { onConflict: "discovered_by,google_place_id" })
    .select();

  if (!perUser.error) return perUser.data ?? [];

  // 42P10: no unique constraint matches the ON CONFLICT specification.
  if (perUser.error.code !== "42P10") {
    console.error("Upsert failed:", perUser.error);
    throw perUser.error;
  }

  console.warn(
    "[discover] discovered_offices has no UNIQUE (discovered_by, google_place_id); " +
      "falling back to the global place-id constraint. Apply the accompanying " +
      "migration — until then two users cannot both keep the same discovered office.",
  );

  const legacy = await supabase
    .from("discovered_offices")
    .upsert(batch, { onConflict: "google_place_id" })
    .select();

  if (legacy.error) {
    console.error("Upsert failed:", legacy.error);
    throw legacy.error;
  }
  return legacy.data ?? [];
}

/** Refresh the in-network flag on cached rows without touching Google. */
async function markImported(supabase: any, userId: string, offices: any[]): Promise<any[]> {
  const index = await loadNetworkIndex(supabase, userId);

  const nowInNetwork = offices.filter(
    (office) =>
      !office.imported &&
      isInNetwork(index, {
        placeId: office.google_place_id,
        name: office.name,
        lat: office.latitude,
        lng: office.longitude,
      } as RawPlace),
  );

  if (nowInNetwork.length > 0) {
    await supabase
      .from("discovered_offices")
      .update({ imported: true })
      .in(
        "id",
        nowInNetwork.map((o) => o.id),
      );
  }

  const promoted = new Set(nowInNetwork.map((o) => o.id));
  return offices.map((o) => (promoted.has(o.id) ? { ...o, imported: true } : o));
}

interface Usage {
  used: number;
  limit: number;
  resetsAt: string | null;
}

/** Fresh searches this user has run in the last 7 days. */
async function readUsage(supabase: any, userId: string): Promise<Usage> {
  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("discovery_sessions")
    .select("created_at")
    .eq("user_id", userId)
    .eq("api_call_made", true)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Usage lookup failed:", error);
    return { used: 0, limit: WEEKLY_LIMIT, resetsAt: null };
  }

  const sessions = data ?? [];
  const oldest = sessions[0]?.created_at;
  return {
    used: sessions.length,
    limit: WEEKLY_LIMIT,
    // The window is rolling, so the next slot frees up when the oldest
    // search ages out — not at midnight on some fixed day.
    resetsAt: oldest ? new Date(new Date(oldest).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
  };
}

function formatAge(seconds: number): string {
  if (seconds < 90) return "moments";
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.round(hours / 24)} days`;
}

function buildMessage(count: number, distance: number, label: string, incomplete: boolean): string {
  if (count === 0) {
    return `No dental offices found within ${distance} miles of ${label}. Try a wider radius.`;
  }
  const base = `Found ${count} dental office${count === 1 ? "" : "s"} within ${distance} miles of ${label}`;
  return incomplete
    ? `${base}. The area was larger than one search could fully cover — search a smaller radius for complete coverage.`
    : base;
}
