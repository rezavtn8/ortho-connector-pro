

# Discovered Offices: Groups Feature and UI/UX Cleanup

## Overview

Two improvements to the Discovered Offices page:
1. A **Groups** system so users can organize discovered offices into named collections for future use (print labels, campaigns, etc.)
2. **UI/UX cleanup** to fix layout inconsistencies, glitchy category badges, and improve overall organization

---

## Part 1: Groups Feature

### How It Works

- Users select discovered offices and click **"Save as Group"** (new button in the selection action bar)
- A dialog appears where they name the group (e.g., "East Side Dentists", "Spring 2026 Outreach")
- Groups appear as **tabs or a dropdown** at the top of the Discover page, letting users quickly switch between "All Offices" and their saved groups
- Each group has actions: rename, add/remove offices, print labels, view on map, delete group
- Groups persist in the database and survive page refreshes

### Database Changes

**New table: `discovered_office_groups`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| name | text | Group name |
| user_id | uuid | Owner |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now() |

**New table: `discovered_office_group_members`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| group_id | uuid (FK) | References discovered_office_groups |
| office_id | uuid (FK) | References discovered_offices |
| added_at | timestamptz | Default now() |
| Unique constraint | | (group_id, office_id) |

Both tables get RLS policies restricting access to the owning user.

### UI Components

**1. Group Selector (top of Discover page)**
- A horizontal bar with pill/chip buttons: "All Offices" | "Group A" | "Group B" | "+ New Group"
- Clicking a group filters the list to only show offices in that group
- Active group is highlighted

**2. "Save as Group" button in SelectionActionBar**
- When offices are selected, a new "Save as Group" button appears alongside existing actions (Add to Network, Labels, Map, Remove)
- Opens a dialog to name the group or add to an existing group

**3. Group Management Dialog**
- Rename group
- Remove offices from group
- Delete entire group
- Quick actions: Print Labels for group, View on Map

### Files to Create
- `src/components/DiscoveredOfficeGroups.tsx` -- Group selector bar + management UI
- `src/components/SaveToGroupDialog.tsx` -- Dialog for creating/adding to groups
- `src/hooks/useDiscoveredGroups.ts` -- Hook for CRUD operations on groups

### Files to Modify
- `src/pages/Discover.tsx` -- Add group selector, filter by active group
- `src/components/SelectionActionBar.tsx` -- Add "Save as Group" button for discovered offices
- `src/components/DiscoveryResults.tsx` -- Support group-filtered display

---

## Part 2: UI/UX Cleanup

### Issues to Fix

**1. Stats cards duplicated**
- The Discover page renders its own stats grid (lines 477-533) AND the DiscoveryResults component renders another summary card (lines 220-259). This creates redundant/conflicting information.
- **Fix:** Remove the stats from the parent Discover page and let DiscoveryResults handle all display, OR consolidate into one clean stats bar.

**2. Office type badges inconsistency**
- The `office_type` field can have values like "Unknown", empty strings, or inconsistent casing from Google API
- **Fix:** Normalize office types on display -- map "Unknown" to a generic label, standardize casing, and use consistent badge colors per type (e.g., "General Dentist" = blue, "Orthodontist" = purple, "Pediatric" = green)

**3. Average rating shows "NaN" when no offices have ratings**
- Line 450-451: Division by zero when `newOffices.filter(o => o.google_rating).length` is 0
- **Fix:** Add a zero-length guard

**4. Layout improvements**
- Sort control uses a raw `<select>` element instead of the Shadcn Select component -- looks inconsistent
- The "Clear All" destructive action is too close to useful actions
- Selection checkbox alignment needs tightening
- **Fix:** Replace with Shadcn Select, add confirmation to "Clear All", improve spacing

**5. Empty state when group is empty**
- Show a friendly message with an action to add offices when viewing an empty group

### Files to Modify
- `src/pages/Discover.tsx` -- Remove duplicate stats, fix NaN rating, consolidate layout
- `src/components/DiscoveryResults.tsx` -- Normalize office types, replace raw select with Shadcn Select, improve card layout consistency, add confirmation to Clear All

---

## Implementation Order

1. Database migration (create 2 new tables with RLS)
2. Create `useDiscoveredGroups` hook
3. Create `SaveToGroupDialog` component
4. Create `DiscoveredOfficeGroups` selector component
5. Update `SelectionActionBar` with "Save as Group" button
6. Update `Discover.tsx` to integrate groups and fix UI issues
7. Update `DiscoveryResults.tsx` for UI cleanup (badges, sort, layout)

