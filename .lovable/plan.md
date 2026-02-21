

# Make Discovered Office Groups a First-Class Entity

## Goal

Right now, discovered office groups only live on the Discover page. The user wants them to be selectable as a source everywhere -- when creating email campaigns, gift campaigns, printing mailing labels, and viewing on the map. A group should feel like a saved list that the user can reach from any tool in the app.

---

## Integration Points

### 1. Email Campaign Creator -- Add "Discovered Group" Source

**File:** `src/components/campaign/EmailCampaignCreator.tsx`

Currently the office list only comes from `useOffices()` (network/partner offices). Changes:

- Add a **source toggle** at the top of the office selection step (Step 2): "Network Offices" | "Discovered Groups"
- When "Discovered Groups" is selected, show a dropdown of the user's saved groups (from `useDiscoveredGroups`)
- Selecting a group loads its member offices from `discovered_offices` table
- The discovered offices get displayed in the same checkbox list format, with office type badge instead of tier badge
- When creating the campaign, the `office_id` in `campaign_deliveries` will reference discovered office IDs (they're all UUIDs from the same pattern, so this works)

### 2. Gift/Physical Campaign Creator -- Same Treatment

**File:** `src/components/campaign/PhysicalCampaignCreator.tsx`

Same pattern as email -- add a source toggle between network offices and discovered groups in the office selection step.

### 3. Mailing Labels -- Add Group Filter

**File:** `src/pages/MailingLabels.tsx`

Currently has a basic `sourceFilter` (all/partner/discovered) and a `discovered=true&ids=...` URL param pattern. Changes:

- Add a **"Discovered Group"** option to the source filter dropdown
- When selected, show a group picker dropdown
- Selecting a group auto-filters to only offices in that group
- Support a new URL param: `group=<groupId>` so groups can link directly to labels from the Discover page

### 4. Map View -- Filter by Group

**File:** `src/components/MapView.tsx` and `src/pages/MapView.tsx`

Currently shows all discovered offices when the toggle is on. Changes:

- Add a group filter dropdown (visible when "Show Discovered" toggle is on)
- When a group is selected, only show that group's offices on the map instead of all discovered offices
- Support URL param: `group=<groupId>` for direct linking

### 5. Discovered Office Groups Component -- Add Campaign Actions

**File:** `src/components/DiscoveredOfficeGroups.tsx`

Add to the group dropdown menu:
- "Email Campaign" -- opens EmailCampaignCreator with group pre-selected
- "Gift Campaign" -- opens PhysicalCampaignCreator with group pre-selected
- "Print Labels" already exists but will use the new `group=<groupId>` URL param
- "View on Map" will use the new `group=<groupId>` URL param

### 6. Selection Action Bar -- Add Campaign Actions for Discovered Offices

**File:** `src/components/SelectionActionBar.tsx`

Currently discovered offices only show "Add to Network", "Labels", "Map", "Group", "Remove". Add:
- **"Email"** button -- same as network offices, opens email campaign creator with selected discovered office IDs
- **"Gift"** button -- same pattern

---

## Technical Details

### Hook Changes

**`src/hooks/useDiscoveredGroups.ts`** -- Add a new function:
- `getGroupOffices(groupId)` -- fetches full office data (name, address, etc.) for all members of a group by joining `discovered_office_group_members` with `discovered_offices`

### Campaign Creator Changes

Both `EmailCampaignCreator.tsx` and `PhysicalCampaignCreator.tsx` need:
- New prop: `preSelectedDiscoveredIds?: string[]` -- to pre-select discovered offices when coming from groups
- New state: `officeSource: 'network' | 'discovered'` -- toggles which list is shown
- New state: `selectedGroupId: string | null` -- which discovered group to load
- Import and use `useDiscoveredGroups` hook
- Query `discovered_offices` filtered by group member IDs when a group is selected

### Mailing Labels Changes

- New URL param support: `group=<groupId>`
- When `group` param is present, fetch group members and filter discovered offices to only those IDs
- Add group dropdown to the source filter area

### Map View Changes

- New URL param support: `group=<groupId>`
- `useDiscoveredMapData` hook: accept optional `groupMemberIds` to filter which discovered offices to show
- Add group selector dropdown when discovered toggle is on

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useDiscoveredGroups.ts` | Add `getGroupOffices()` method |
| `src/components/campaign/EmailCampaignCreator.tsx` | Add source toggle, group picker, discovered office support |
| `src/components/campaign/PhysicalCampaignCreator.tsx` | Same as email creator |
| `src/pages/MailingLabels.tsx` | Add group filter option and `group=` URL param |
| `src/components/MapView.tsx` | Add group filter dropdown when showing discovered |
| `src/pages/MapView.tsx` | Pass group param from URL |
| `src/components/DiscoveredOfficeGroups.tsx` | Add Email/Gift campaign actions to group menu |
| `src/components/SelectionActionBar.tsx` | Add Email/Gift buttons for discovered offices |

### No Database Changes Required

All the data relationships already exist -- `discovered_office_groups`, `discovered_office_group_members`, and `discovered_offices` tables with proper RLS. We just need to query them from more places in the frontend.

### Implementation Order

1. Enhance `useDiscoveredGroups` hook with `getGroupOffices()`
2. Update `EmailCampaignCreator` with source toggle + group picker
3. Update `PhysicalCampaignCreator` with same pattern
4. Update `SelectionActionBar` to add Email/Gift for discovered offices
5. Update `DiscoveredOfficeGroups` menu with campaign actions
6. Update `MailingLabels` with group filter
7. Update `MapView` with group filter
8. Test end-to-end

