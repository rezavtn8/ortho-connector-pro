

# Competitor Watch -- Diagnosis & Fix Plan

## Root Causes Identified

1. **Specialty matching is broken**: The `clinics` table has no `specialty` column. The component hardcodes `"dental"` as the specialty. The `suggest` action in the edge function tries to match `"dental"` against `office_type` values like `"General Dentist"`, `"Endodontics"`, `"Orthodontics"` -- but `"general dentist".includes("dental")` is `false` (it's "dentist" not "dental"), so zero suggestions are returned despite 587 discovered offices existing.

2. **Search Google likely works** but may appear broken because the empty suggest tab is shown first, and the user's clinic is "Irvine Endodontics" which is an Endodontics practice -- searching with the default "dental" keyword may return unrelated results. The specialty should be set dynamically.

3. **Header doesn't match other pages**: Per project design conventions, pages use stats-first layout with no large headers. The current page has a Shield icon + title + description block. Also, tabs use `variant="pills"` but the design standard is `variant="default"` (beveled rectangle).

## Plan

### 1. Add `specialty` column to `clinics` table
- Add `specialty TEXT` column to `clinics`, defaulting to `NULL`
- This lets users set their actual specialty (e.g., "Endodontics", "General Dentist")

### 2. Fix edge function suggest logic
**File:** `supabase/functions/competitor-snapshot/index.ts`
- In the `suggest` action, broaden the matching: instead of strict `includes()` checks, use a set of related keywords. For example, if specialty is "Endodontics" or "dental", also match "General Dentist" and all dental-related office types.
- Better approach: if no specific specialty filter, return all discovered offices sorted by distance (dental practices are all competitors to each other).
- Fetch the clinic's specialty from the DB if not provided in the request.

### 3. Fix component specialty handling
**File:** `src/components/analytics/CompetitorBenchmarking.tsx`
- Use `clinic.specialty` (from the new column) instead of hardcoded `"dental"`
- If no specialty is set, default to the clinic's office type or a broad dental keyword
- Pass the actual specialty to both `suggest` and `search` actions

### 4. Remove page header, stats-first layout
**File:** `src/pages/CompetitorWatch.tsx`
- Remove the header block (icon + title + description)
- Let the `CompetitorBenchmarking` component's hero card serve as the top element (stats-first)

### 5. Fix tab variant
**File:** `src/components/analytics/CompetitorBenchmarking.tsx`
- Change `TabsList variant="pills"` to `variant="default"` and `TabsTrigger variant="pills"` to `variant="default"` to match project design standards

## Technical Details

- Migration: `ALTER TABLE clinics ADD COLUMN specialty TEXT;`
- Edge function fix: Replace the strict `officeType.includes(specLower)` filter with a broader dental-family matcher -- if the specialty contains "dent" or "endo" or "ortho" etc., treat all dental office types as potential competitors
- No new dependencies needed

