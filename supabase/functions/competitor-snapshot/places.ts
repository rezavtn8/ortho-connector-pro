/**
 * Google Places access for competitor tracking.
 *
 * Mirrors the arrangement in `discover-nearby-offices/places.ts`: prefer Places
 * API (New) and fall back to the legacy endpoints when the project answers 403
 * PERMISSION_DENIED, so a Cloud project that never enabled the New API still
 * works. The provider is resolved once per invocation and reused.
 *
 * The previous implementation called `fetch` inside a bare try/catch that
 * returned null, which made a throttled Google call indistinguishable from a
 * competitor who genuinely has no reviews — and a snapshot written from that
 * would record a real practice as having zero. Failures are surfaced instead,
 * and the caller skips the write rather than storing a fabricated zero.
 */

export interface PlaceSnapshot {
  placeId: string;
  name: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  types: string[];
  /** Up to five reviews; Google returns no more than that on either API. */
  reviews: Array<{
    rating: number | null;
    text: string | null;
    author: string | null;
    postedAt: string | null;
  }>;
}

export interface PlaceResult {
  google_place_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  review_count: number | null;
  business_status: string | null;
}

export type Provider = "places-new" | "places-legacy";

const DETAIL_FIELDS_NEW = [
  "id",
  "displayName",
  "rating",
  "userRatingCount",
  "businessStatus",
  "types",
  "reviews",
].join(",");

const SEARCH_FIELDS_NEW = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
].join(",");

const DETAIL_FIELDS_LEGACY = "name,rating,user_ratings_total,reviews,types,business_status";

/** Google never returns more than five reviews on a details call. */
const MAX_REVIEWS_STORED = 5;

/** Review text kept per review. Enough to read the complaint, not the essay. */
const REVIEW_TEXT_LIMIT = 400;

interface JsonResult {
  ok: boolean;
  status: number;
  body: any;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class PlacesClient {
  private provider: Provider = "places-new";
  private providerResolved = false;

  readonly diagnostics = {
    provider: "places-new" as Provider,
    requests: 0,
    failures: 0,
    errors: [] as string[],
  };

  constructor(
    private readonly apiKey: string,
    private readonly maxRequests = 60,
  ) {}

  get canSpend(): boolean {
    return this.diagnostics.requests < this.maxRequests;
  }

  private note(message: string) {
    if (this.diagnostics.errors.length < 8 && !this.diagnostics.errors.includes(message)) {
      this.diagnostics.errors.push(message);
    }
  }

  /** One HTTP call with a hard timeout and bounded retries. */
  private async request(
    url: string,
    init: RequestInit,
    { timeoutMs = 10_000, retries = 2 } = {},
  ): Promise<JsonResult> {
    let lastError = "unknown error";

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (!this.canSpend) return { ok: false, status: 0, body: null, error: "request budget spent" };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      this.diagnostics.requests++;

      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        const body = await res.json().catch(() => null);

        if (res.ok) return { ok: true, status: res.status, body };

        // 4xx other than 429 will not improve on a retry.
        if (res.status < 500 && res.status !== 429) {
          this.diagnostics.failures++;
          return {
            ok: false,
            status: res.status,
            body,
            error: body?.error?.message ?? body?.error_message ?? `HTTP ${res.status}`,
          };
        }
        lastError = `HTTP ${res.status}`;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      } finally {
        clearTimeout(timer);
      }

      if (attempt < retries) await sleep(250 * 2 ** attempt);
    }

    this.diagnostics.failures++;
    return { ok: false, status: 0, body: null, error: lastError };
  }

  /**
   * Decide which API this project can actually use, once.
   *
   * A details call on a known place is the cheapest probe available, and the
   * caller always needs one anyway, so the probe result is returned rather
   * than thrown away.
   */
  private async resolveProvider(probePlaceId: string): Promise<JsonResult | null> {
    if (this.providerResolved) return null;
    this.providerResolved = true;

    const result = await this.detailsNewRaw(probePlaceId);
    if (result.ok) {
      this.provider = "places-new";
      this.diagnostics.provider = "places-new";
      return result;
    }

    // A missing place is a bad id, not a disabled API — do not downgrade for it.
    if (result.status === 404) {
      this.provider = "places-new";
      this.diagnostics.provider = "places-new";
      return result;
    }

    this.provider = "places-legacy";
    this.diagnostics.provider = "places-legacy";
    const reason = result.error ?? `HTTP ${result.status}`;
    this.note(`Places API (New) unavailable (${reason}); using legacy endpoints`);
    console.warn("[competitor] falling back to legacy Places endpoints:", reason);
    return null;
  }

  // ---------------------------------------------------------------- details

  /**
   * Rating, review count and recent reviews for one place.
   *
   * Returns null when Google could not be reached or refused the request, so
   * the caller can skip the snapshot instead of recording a zero.
   */
  async details(placeId: string): Promise<PlaceSnapshot | null> {
    const probe = await this.resolveProvider(placeId);
    if (probe) return probe.ok ? parseDetailsNew(placeId, probe.body) : null;

    if (this.provider === "places-new") {
      const result = await this.detailsNewRaw(placeId);
      return result.ok ? parseDetailsNew(placeId, result.body) : null;
    }

    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}&fields=${DETAIL_FIELDS_LEGACY}&key=${this.apiKey}`;
    const result = await this.request(url, { method: "GET" });

    if (!result.ok) return null;
    if (result.body?.status !== "OK" || !result.body?.result) {
      this.note(`details ${placeId}: ${result.body?.status ?? "no result"}`);
      return null;
    }
    return parseDetailsLegacy(placeId, result.body.result);
  }

  private detailsNewRaw(placeId: string): Promise<JsonResult> {
    return this.request(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        method: "GET",
        headers: { "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": DETAIL_FIELDS_NEW },
      },
      { retries: 1 },
    );
  }

  // ----------------------------------------------------------------- search

  /**
   * Practices matching `query` near a point.
   *
   * Text search rather than a typed nearby search: Google files most dental
   * specialists under something other than `dentist`, so "periodontist" as a
   * type returns almost nothing while the same word as text returns the field.
   */
  async search(query: string, lat: number, lng: number, radiusMiles: number): Promise<PlaceResult[]> {
    const radiusMeters = Math.min(50_000, Math.round(radiusMiles * 1609.344));

    if (!this.providerResolved) {
      // Nothing to probe with, so try the New API and downgrade on refusal.
      const probe = await this.searchNew(query, lat, lng, radiusMeters);
      this.providerResolved = true;
      if (probe.ok) {
        this.provider = "places-new";
        this.diagnostics.provider = "places-new";
        return parseSearchNew(probe.body);
      }
      this.provider = "places-legacy";
      this.diagnostics.provider = "places-legacy";
      this.note(`Places API (New) unavailable (${probe.error ?? probe.status}); using legacy`);
    }

    if (this.provider === "places-new") {
      const result = await this.searchNew(query, lat, lng, radiusMeters);
      return result.ok ? parseSearchNew(result.body) : [];
    }

    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}&radius=${radiusMeters}` +
      `&keyword=${encodeURIComponent(query)}&key=${this.apiKey}`;
    const result = await this.request(url, { method: "GET" });
    if (!result.ok) return [];

    const status = result.body?.status;
    if (status !== "OK" && status !== "ZERO_RESULTS") {
      this.note(`search: ${status ?? "unknown"}`);
      return [];
    }
    return parseSearchLegacy(result.body?.results ?? []);
  }

  private searchNew(query: string, lat: number, lng: number, radiusMeters: number) {
    return this.request(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": SEARCH_FIELDS_NEW,
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 20,
          locationBias: {
            circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
          },
        }),
      },
      { retries: 1 },
    );
  }
}

// ---------------------------------------------------------------- parsing

function trimText(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const clean = text.trim();
  if (!clean) return null;
  return clean.length > REVIEW_TEXT_LIMIT ? `${clean.slice(0, REVIEW_TEXT_LIMIT)}…` : clean;
}

function parseDetailsNew(placeId: string, body: any): PlaceSnapshot {
  return {
    placeId,
    name: body?.displayName?.text ?? null,
    rating: numberOrNull(body?.rating),
    reviewCount: numberOrNull(body?.userRatingCount),
    businessStatus: body?.businessStatus ?? null,
    types: Array.isArray(body?.types) ? body.types : [],
    reviews: (body?.reviews ?? []).slice(0, MAX_REVIEWS_STORED).map((r: any) => ({
      rating: numberOrNull(r?.rating),
      text: trimText(r?.text?.text ?? r?.originalText?.text),
      author: r?.authorAttribution?.displayName ?? null,
      postedAt: r?.publishTime ?? null,
    })),
  };
}

function parseDetailsLegacy(placeId: string, result: any): PlaceSnapshot {
  return {
    placeId,
    name: result?.name ?? null,
    rating: numberOrNull(result?.rating),
    reviewCount: numberOrNull(result?.user_ratings_total),
    businessStatus: result?.business_status ?? null,
    types: Array.isArray(result?.types) ? result.types : [],
    reviews: (result?.reviews ?? []).slice(0, MAX_REVIEWS_STORED).map((r: any) => ({
      rating: numberOrNull(r?.rating),
      text: trimText(r?.text),
      author: r?.author_name ?? null,
      // Legacy returns seconds since epoch; store the same ISO shape as the New API.
      postedAt: typeof r?.time === "number" ? new Date(r.time * 1000).toISOString() : null,
    })),
  };
}

function parseSearchNew(body: any): PlaceResult[] {
  return (body?.places ?? [])
    .filter((p: any) => p?.id && p?.displayName?.text)
    .map((p: any) => ({
      google_place_id: p.id,
      name: p.displayName.text,
      address: p.formattedAddress ?? null,
      latitude: numberOrNull(p.location?.latitude),
      longitude: numberOrNull(p.location?.longitude),
      google_rating: numberOrNull(p.rating),
      review_count: numberOrNull(p.userRatingCount),
      business_status: p.businessStatus ?? null,
    }));
}

function parseSearchLegacy(results: any[]): PlaceResult[] {
  return results
    .filter((p) => p?.place_id && p?.name)
    .map((p) => ({
      google_place_id: p.place_id,
      name: p.name,
      address: p.vicinity ?? p.formatted_address ?? null,
      latitude: numberOrNull(p.geometry?.location?.lat),
      longitude: numberOrNull(p.geometry?.location?.lng),
      google_rating: numberOrNull(p.rating),
      review_count: numberOrNull(p.user_ratings_total),
      business_status: p.business_status ?? null,
    }));
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
