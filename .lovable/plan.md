

# Add Optional Network Import for Discovered Offices

## Problem
The FK constraint `campaign_deliveries.office_id → patient_sources.id` requires discovered offices to exist in `patient_sources`. Currently they're auto-imported silently. The user wants explicit control.

## Solution

**File: `src/components/campaign/LetterCampaignCreator.tsx`**

1. Add `importToNetwork` state (default: `false`)
2. Replace the auto-import notice (line 331) with a checkbox: "Also add these offices to my network"
   - Muted note below: "If unchecked, offices will only be used for this campaign's letters and won't appear in your network."
3. Update `importDiscoveredOffices` to accept `addToNetwork: boolean`:
   - If `true`: insert with `is_active: true`, mark `discovered_offices.imported = true`
   - If `false`: insert with `is_active: false`, do NOT mark `discovered_offices.imported = true`
4. Pass `importToNetwork` to `importDiscoveredOffices` in `handleSubmit`
5. Update Step 3 summary to show "Will be added to network" or "Letter printing only" based on checkbox
6. Add `importToNetwork` to `resetForm`

No database changes needed — `patient_sources.is_active` already exists and defaults to `true`.

