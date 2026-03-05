

# Competitor Watch -- Full Redesign

## Problems in the Current Implementation

1. **Edge function bug**: The `search` action calls `req.json()` a second time (line 156) after it was already consumed on line 40. This will always fail/return empty. The body is already parsed -- need to use the already-destructured `watchlist_entry`.

2. **No auto-suggest from discovered offices**: The user wants to see same-specialty discovered offices as quick-add candidates without searching Google.

3. **Specialty is hardcoded**: The search hardcodes `type=dentist` in the Google API call and defaults specialty to `'dentist'` everywhere. Should pull the user's clinic specialty from their profile/clinic data dynamically.

4. **UI is functional but plain**: Needs a premium, polished look with a clear hero section for the user's practice, easy onboarding flow, and better visual hierarchy.

5. **No empty state guidance**: When no competitors are tracked, the empty state is minimal.

6. **Snapshot RLS missing UPDATE/DELETE**: Users can't update or delete snapshots, which may be needed for cleanup. Watchlist `competitor_snapshots` only has INSERT and SELECT policies.

---

## Plan

### 1. Fix Edge Function Bugs
**File:** `supabase/functions/competitor-snapshot/index.ts`

- Remove the second `req.json()` call in the `search` action -- use the already-parsed `watchlist_entry` object.
- Make the Google Places search `type` parameter dynamic based on the `specialty` field instead of hardcoding `type=dentist`.
- Add a `suggest` action that queries `discovered_offices` for offices matching the user's clinic specialty (using `office_type`), excluding already-watched ones, and returns them as suggestions.

### 2. Add `suggest` Action for Discovered Offices
**In the same edge function**, add logic:
- Query `discovered_offices` where `discovered_by = userId` and `office_type` matches the user's clinic specialty.
- Exclude offices already in `competitor_watchlist`.
- Return up to 10 suggestions sorted by distance.

### 3. Redesign the CompetitorBenchmarking Component
**File:** `src/components/analytics/CompetitorBenchmarking.tsx` -- full rewrite

**Layout structure:**

```text
┌──────────────────────────────────────────────────────────┐
│  YOUR PRACTICE (Hero Card - prominent, larger)           │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                │
│  │Rating│  │Reviews│  │Rank  │  │Velocity│               │
│  └──────┘  └──────┘  └──────┘  └──────┘                │
│  Market position summary bar                             │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ADD COMPETITORS                                         │
│  ┌─ Tabs ──────────────────────────────────────────┐    │
│  │ Suggested (from discoveries) │ Search Google     │    │
│  ├──────────────────────────────────────────────────┤    │
│  │ Cards with quick "Watch" button                  │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  BENCHMARKING (only when competitors exist)              │
│  Rating Comparison Chart  │  Review Volume Chart         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  COMPETITOR GRID                                         │
│  Cards with rating, reviews, velocity, vs-you delta      │
│  Sorted by rating. Remove button on each.                │
└──────────────────────────────────────────────────────────┘
```

**Key UI improvements:**
- Hero card uses glass variant with gradient, prominently showing "Your Practice" badge
- "Suggested" tab auto-loads same-specialty discovered offices for one-click watching
- "Search" tab keeps the Google Places search functionality
- Better empty state with illustration and clear CTA
- Competitor cards show a colored indicator (green/red/amber) based on how they compare to you
- Refresh button with last-refreshed timestamp
- Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop

### 4. Update CompetitorWatch Page
**File:** `src/pages/CompetitorWatch.tsx`

- Update subtitle text. Keep it clean and minimal since the component handles all the UI.

### 5. Add Snapshot UPDATE Policy
**Migration**: Add UPDATE policy on `competitor_snapshots` so the edge function's upsert works correctly (it uses service role, so this is mainly for future-proofing direct client access).

---

## Technical Details

- The `suggest` action will query `discovered_offices` joined against `competitor_watchlist` to exclude already-watched offices, filtering by `office_type` matching the user's clinic specialty.
- Charts remain Recharts-based (already installed).
- No new dependencies needed.
- Edge function fix is critical -- the current `search` action is broken due to double `req.json()` consumption.

