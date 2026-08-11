/**
 * Google Places access for office discovery.
 *
 * Prefers Places API (New), which returns address, phone, website and rating
 * directly in the search response. The previous implementation used the legacy
 * search and then issued one Place Details request per result — roughly 100
 * extra billed calls per discovery, each with its own chance to time out and
 * leave an office with a null address.
 *
 * The legacy endpoints remain as an automatic fallback, because a project that
 * has never enabled Places API (New) answers every request with 403
 * PERMISSION_DENIED and discovery would otherwise return nothing at all.
 */

import {
  BoundingBox,
  LatLng,
  boundingBox,
  haversineMiles,
  mapWithConcurrency,
  milesToMeters,
} from "./geo.ts";

export interface RawPlace {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  ratingCount: number | null;
  lat: number;
  lng: number;
  businessStatus: string | null;
  primaryType: string | null;
  types: string[];
}

export type Provider = "places-new" | "places-legacy";

export interface Diagnostics {
  provider: Provider;
  requests: number;
  failures: number;
  tilesSearched: number;
  tilesSubdivided: number;
  textQueries: number;
  /** Hit the request budget — coverage is incomplete but usable. */
  budgetExhausted: boolean;
  /** Hit the wall-clock deadline — coverage is incomplete but usable. */
  timedOut: boolean;
  errors: string[];
}

const NEW_SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.businessStatus",
  "places.primaryType",
  "places.types",
].join(",");

/** New API caps a nearby search at 20; coming back full means we missed some. */
const NEW_MAX_RESULTS = 20;

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

  readonly diagnostics: Diagnostics = {
    provider: "places-new",
    requests: 0,
    failures: 0,
    tilesSearched: 0,
    tilesSubdivided: 0,
    textQueries: 0,
    budgetExhausted: false,
    timedOut: false,
    errors: [],
  };

  constructor(
    private readonly apiKey: string,
    private readonly maxRequests: number,
    private readonly deadlineAt: number,
  ) {}

  /** False once the request budget or the wall clock is spent. */
  get canSpend(): boolean {
    if (this.diagnostics.requests >= this.maxRequests) {
      this.diagnostics.budgetExhausted = true;
      return false;
    }
    if (Date.now() >= this.deadlineAt) {
      this.diagnostics.timedOut = true;
      return false;
    }
    return true;
  }

  private note(message: string) {
    if (this.diagnostics.errors.length < 12 && !this.diagnostics.errors.includes(message)) {
      this.diagnostics.errors.push(message);
    }
  }

  /**
   * One HTTP call with a hard timeout and bounded retries.
   *
   * The old code wrapped fetch in a bare try/catch that returned `[]`, so a
   * throttled or failing Google call was indistinguishable from a genuinely
   * empty neighbourhood. Failures are counted and reported instead.
   */
  private async request(
    url: string,
    init: RequestInit,
    { timeoutMs = 12_000, retries = 2 } = {},
  ): Promise<JsonResult> {
    let lastError = "unknown error";

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (!this.canSpend) {
        return { ok: false, status: 0, body: null, error: "budget exhausted" };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      this.diagnostics.requests++;

      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        const text = await response.text();
        let body: any = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = { raw: text };
        }

        if (response.ok) return { ok: true, status: response.status, body };

        // 429 and 5xx are worth another attempt; 4xx means the request itself
        // is wrong and retrying just burns quota.
        if (response.status === 429 || response.status >= 500) {
          lastError = `HTTP ${response.status}`;
          await sleep(400 * 2 ** attempt);
          continue;
        }

        return { ok: false, status: response.status, body };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < retries) await sleep(400 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }

    this.diagnostics.failures++;
    return { ok: false, status: 0, body: null, error: lastError };
  }

  /**
   * Decide once whether this API key can talk to Places API (New).
   *
   * Probes with a tiny nearby search; a 403/404 means the New API is not
   * enabled on the project and every later call transparently uses legacy.
   */
  private async resolveProvider(center: LatLng): Promise<void> {
    if (this.providerResolved) return;
    this.providerResolved = true;

    const result = await this.request(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({
          includedTypes: ["dentist"],
          maxResultCount: 1,
          locationRestriction: {
            circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 1000 },
          },
        }),
      },
      { retries: 1 },
    );

    if (result.ok) {
      this.provider = "places-new";
    } else {
      const reason = result.body?.error?.message ?? result.error ?? `HTTP ${result.status}`;
      this.provider = "places-legacy";
      this.note(`Places API (New) unavailable (${reason}); using legacy endpoints`);
      console.warn("[places] falling back to legacy endpoints:", reason);
    }
    this.diagnostics.provider = this.provider;
  }

  // ---------------------------------------------------------------- nearby

  /**
   * Every dentist inside one tile.
   *
   * `saturated` reports that the tile returned a full page, which is the
   * signal the caller uses to subdivide rather than silently dropping the
   * offices that did not fit.
   */
  async searchTile(
    center: LatLng,
    radiusMiles: number,
  ): Promise<{ places: RawPlace[]; saturated: boolean }> {
    await this.resolveProvider(center);
    this.diagnostics.tilesSearched++;

    return this.provider === "places-new"
      ? this.searchTileNew(center, radiusMiles)
      : this.searchTileLegacy(center, radiusMiles);
  }

  private async searchTileNew(center: LatLng, radiusMiles: number) {
    const result = await this.request(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": NEW_SEARCH_FIELDS,
        },
        body: JSON.stringify({
          includedTypes: ["dentist"],
          maxResultCount: NEW_MAX_RESULTS,
          rankPreference: "DISTANCE",
          locationRestriction: {
            circle: {
              center: { latitude: center.lat, longitude: center.lng },
              // Google rejects a circle wider than 50 km.
              radius: Math.min(50_000, milesToMeters(radiusMiles)),
            },
          },
        }),
      },
    );

    if (!result.ok) {
      this.note(this.describe(result, "nearby search"));
      return { places: [], saturated: false };
    }

    const places = (result.body?.places ?? []).map(fromNewPlace).filter(Boolean) as RawPlace[];
    return { places, saturated: places.length >= NEW_MAX_RESULTS };
  }

  private async searchTileLegacy(center: LatLng, radiusMiles: number) {
    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${center.lat},${center.lng}` +
      `&radius=${Math.round(Math.min(50_000, milesToMeters(radiusMiles)))}` +
      `&type=dentist&key=${this.apiKey}`;

    const results = await this.paginateLegacy(url, 3, "nearby search");
    // 60 is the legacy hard ceiling across all three pages.
    return { places: results.map(fromLegacyPlace), saturated: results.length >= 60 };
  }

  // ------------------------------------------------------------------ text

  /**
   * Keyword search across the whole search area.
   *
   * Nearby search only understands the `dentist` type, so specialists that
   * Google files under another category — most oral surgeons, many
   * orthodontists — are only reachable by keyword. The area is passed as a
   * hard `locationRestriction`; the legacy `radius` parameter this replaced
   * was only a ranking bias, which is why a 1-mile search used to return
   * offices 30 miles away.
   */
  async searchText(query: string, area: BoundingBox): Promise<RawPlace[]> {
    this.diagnostics.textQueries++;
    return this.provider === "places-new"
      ? this.searchTextNew(query, area)
      : this.searchTextLegacy(query, area);
  }

  private async searchTextNew(query: string, area: BoundingBox): Promise<RawPlace[]> {
    const places: RawPlace[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < 3; page++) {
      const result = await this.request(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask": `${NEW_SEARCH_FIELDS},nextPageToken`,
          },
          body: JSON.stringify({
            textQuery: query,
            pageSize: NEW_MAX_RESULTS,
            ...(pageToken ? { pageToken } : {}),
            locationRestriction: {
              rectangle: {
                low: { latitude: area.south, longitude: area.west },
                high: { latitude: area.north, longitude: area.east },
              },
            },
          }),
        },
      );

      if (!result.ok) {
        this.note(this.describe(result, `text search "${query}"`));
        break;
      }

      places.push(...((result.body?.places ?? []).map(fromNewPlace).filter(Boolean) as RawPlace[]));
      pageToken = result.body?.nextPageToken;
      if (!pageToken) break;
    }

    return places;
  }

  private async searchTextLegacy(query: string, area: BoundingBox): Promise<RawPlace[]> {
    const centerLat = (area.north + area.south) / 2;
    const centerLng = (area.east + area.west) / 2;
    const radiusMiles = haversineMiles(
      { lat: centerLat, lng: centerLng },
      { lat: area.north, lng: centerLng },
    );

    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(query)}` +
      `&location=${centerLat},${centerLng}` +
      `&radius=${Math.round(Math.min(50_000, milesToMeters(radiusMiles)))}` +
      `&key=${this.apiKey}`;

    const results = await this.paginateLegacy(url, 2, `text search "${query}"`);
    return results.map(fromLegacyPlace);
  }

  /**
   * Walk legacy `next_page_token` pages.
   *
   * Google needs a moment before a page token becomes valid and answers
   * INVALID_REQUEST until it does, so that specific status is retried once
   * after a wait instead of being treated as the end of the results.
   */
  private async paginateLegacy(url: string, maxPages: number, label: string): Promise<any[]> {
    const results: any[] = [];
    let pageToken: string | null = null;

    for (let page = 0; page < maxPages; page++) {
      if (page > 0) await sleep(2_000);

      const pageUrl = pageToken ? `${url}&pagetoken=${pageToken}` : url;
      let result = await this.request(pageUrl, { method: "GET" });

      if (result.ok && result.body?.status === "INVALID_REQUEST" && pageToken) {
        await sleep(2_000);
        result = await this.request(pageUrl, { method: "GET" });
      }

      if (!result.ok) {
        this.note(this.describe(result, label));
        break;
      }

      const status = result.body?.status;
      if (status === "ZERO_RESULTS") break;
      if (status !== "OK") {
        this.note(`${label}: Google returned ${status}${result.body?.error_message ? ` — ${result.body.error_message}` : ""}`);
        this.diagnostics.failures++;
        break;
      }

      results.push(...(result.body.results ?? []));
      pageToken = result.body.next_page_token ?? null;
      if (!pageToken) break;
    }

    return results;
  }

  // ------------------------------------------------------------- enrichment

  /**
   * Fill in phone/website/address for legacy results.
   *
   * Only reachable on the legacy path, and only ever called after the results
   * have been filtered down to the offices actually being saved, so the cost
   * scales with kept offices rather than with everything Google returned.
   */
  async enrichLegacy(places: RawPlace[]): Promise<void> {
    if (this.provider !== "places-legacy") return;

    const needing = places.filter((p) => !p.phone || !p.website || !p.address);
    if (needing.length === 0) return;

    await mapWithConcurrency(needing, 8, async (place) => {
      if (!this.canSpend) return;

      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${place.placeId}` +
        `&fields=formatted_address,formatted_phone_number,website,user_ratings_total,rating,business_status` +
        `&key=${this.apiKey}`;

      const result = await this.request(url, { method: "GET" }, { retries: 1 });
      if (!result.ok || result.body?.status !== "OK") return;

      const details = result.body.result ?? {};
      place.address = details.formatted_address ?? place.address;
      place.phone = details.formatted_phone_number ?? place.phone;
      place.website = details.website ?? place.website;
      place.rating = details.rating ?? place.rating;
      place.ratingCount = details.user_ratings_total ?? place.ratingCount;
      place.businessStatus = details.business_status ?? place.businessStatus;
    });
  }

  // ---------------------------------------------------------------- geocode

  /**
   * Turn a ZIP code into a search center.
   *
   * `components` pins the lookup to a postal code so "90210" cannot resolve to
   * a street address or a business that merely mentions those digits.
   */
  async geocodePostalCode(
    zip: string,
    region: string,
  ): Promise<{ center: LatLng; label: string } | null> {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?components=postal_code:${encodeURIComponent(zip)}|country:${region}` +
      `&key=${this.apiKey}`;

    const result = await this.request(url, { method: "GET" }, { retries: 1 });
    if (!result.ok || result.body?.status !== "OK" || !result.body.results?.length) {
      const reason = result.body?.status ?? result.error ?? `HTTP ${result.status}`;
      this.note(`Could not locate ZIP ${zip} (${reason})`);
      return null;
    }

    const match = result.body.results[0];
    const location = match.geometry?.location;
    if (!location) return null;

    return {
      center: { lat: location.lat, lng: location.lng },
      label: match.formatted_address ?? zip,
    };
  }

  private describe(result: JsonResult, label: string): string {
    const detail =
      result.body?.error?.message ??
      result.body?.error_message ??
      result.error ??
      `HTTP ${result.status}`;
    return `${label} failed: ${detail}`;
  }
}

function fromNewPlace(place: any): RawPlace | null {
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  if (!place?.id || typeof lat !== "number" || typeof lng !== "number") return null;

  return {
    placeId: place.id,
    name: place.displayName?.text ?? "Unnamed practice",
    address: place.formattedAddress ?? null,
    phone: place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    rating: typeof place.rating === "number" ? place.rating : null,
    ratingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    lat,
    lng,
    businessStatus: place.businessStatus ?? null,
    primaryType: place.primaryType ?? null,
    types: place.types ?? [],
  };
}

function fromLegacyPlace(place: any): RawPlace {
  return {
    placeId: place.place_id,
    name: place.name ?? "Unnamed practice",
    // Legacy nearby search only gives `vicinity` (street + city); the full
    // address arrives with enrichment.
    address: place.formatted_address ?? place.vicinity ?? null,
    phone: null,
    website: null,
    rating: typeof place.rating === "number" ? place.rating : null,
    ratingCount: typeof place.user_ratings_total === "number" ? place.user_ratings_total : null,
    lat: place.geometry?.location?.lat,
    lng: place.geometry?.location?.lng,
    businessStatus: place.business_status ?? null,
    primaryType: null,
    types: place.types ?? [],
  };
}

export { boundingBox };
