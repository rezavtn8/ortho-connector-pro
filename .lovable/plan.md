

# Root Cause: Incomplete Addresses in Discovered Offices

## The Problem

Google Places API returns two different address fields depending on the search type:

- **Nearby Search** returns `vicinity` -- a shortened address like `"1234 Main St, Torrance"` (no state, no ZIP)
- **Text Search** returns `formatted_address` -- the full address like `"1234 Main St, Torrance, CA 90501, USA"`

The edge function on line 482 of `discover-nearby-offices/index.ts` does:

```typescript
address: place.vicinity || place.formatted_address || null
```

This **prefers** the incomplete `vicinity` over the complete `formatted_address`. Since the primary search is a Nearby Search, most offices get truncated addresses. Text Search results that also have `formatted_address` still lose it because `vicinity` is checked first.

Furthermore, the Place Details batch fetch (line 392) requests only `formatted_phone_number,website,user_ratings_total`. It does NOT request `formatted_address`, which would provide the complete address for every result regardless of search type.

## The Fix

Two changes to `supabase/functions/discover-nearby-offices/index.ts`:

1. **Add `formatted_address` to the Place Details fields request** (line 392). Change:
   ```
   fields=formatted_phone_number,website,user_ratings_total
   ```
   to:
   ```
   fields=formatted_address,formatted_phone_number,website,user_ratings_total
   ```

2. **Prefer the full address from Details, then `formatted_address`, then `vicinity`** (line 482). Change:
   ```typescript
   address: place.vicinity || place.formatted_address || null
   ```
   to:
   ```typescript
   address: details?.formatted_address || place.formatted_address || place.vicinity || null
   ```

This ensures every discovered office gets the most complete address available -- the Place Details `formatted_address` is authoritative and always includes street, city, state, ZIP, and country.

### Files Modified

- `supabase/functions/discover-nearby-offices/index.ts` -- Two line changes (Details fields and address preference order)

### Impact on Existing Data

Cached offices already in the database will retain their incomplete addresses. Users can either:
- Run a new discovery search (clears cache after 7 days, or they can force refresh)
- Use the existing "Correct Addresses" feature which calls Google Geocoding to fix stored addresses

No database migration needed. No frontend changes needed.

