

# Fix: Remaining Incomplete Addresses in Discovered Offices

## Root Cause Analysis

The previous fix correctly updated the address preference order for **new** API fetches. However, two issues remain:

1. **Cached DB records**: Offices discovered before the fix still have short `vicinity` addresses stored in the database. When cache is valid (7-day window), these old records are returned as-is (lines 120-166) without re-fetching details.

2. **Silent Place Details failures**: When a Place Details API call fails for a specific office (line 405-408), `details` is `null`, so the code falls through to `place.vicinity` — the short address. There's no retry or fallback to re-fetch.

## The Fix (Two Parts)

### Part 1: Backfill incomplete addresses on cache return

When returning cached results (line 120-166), detect offices with incomplete addresses (missing state/ZIP pattern) and batch-fetch their `formatted_address` from Place Details before returning. This fixes all existing records without requiring a full re-discovery.

Add a helper that:
- Filters cached offices where `address` lacks a US state abbreviation or ZIP code (regex: no match for `, [A-Z]{2} \d{5}`)
- For those offices, calls Place Details with `fields=formatted_address` using their `google_place_id`
- Updates the `discovered_offices` rows in-place with the corrected addresses
- Returns the corrected list

### Part 2: Retry on Place Details failure during fresh fetch

In the batch details fetch (line 388-424), if a Place Details call fails or returns no `formatted_address`, add a single retry after a short delay. This reduces the chance of silent failures leaving offices with short addresses.

### Files Modified

- `supabase/functions/discover-nearby-offices/index.ts` — Add address backfill logic in the cache-return path (~lines 120-166) and retry logic in the batch details fetch (~lines 390-410)

### No Other Changes Needed

- No database migration
- No frontend changes
- No new edge functions

