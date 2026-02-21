

# Systematically Rebuild the Campaigns Tab

## Current State Assessment

The Campaigns tab has two separate pages (`Campaigns.tsx` at 580 lines and `CampaignsResilient.tsx` at 260 lines -- only the default export `Campaigns.tsx` is used), multiple creator dialogs, detail dialogs, and execution dialogs. The code is fragmented across 7+ component files with duplicated logic, inconsistent patterns, and several functional gaps:

**Functional Issues:**
- Email campaigns auto-trigger AI generation on dialog open (can waste API calls)
- No ability to delete campaigns
- No ability to change campaign status (Draft/Active/Completed)
- Gift campaign delivery tracking is basic -- no progress bar or batch actions
- No search/filter on the main campaigns list
- The `CampaignsResilient.tsx` file is dead code (not used)

**UI/UX Issues:**
- Stats cards take up too much vertical space
- Campaign cards lack clear progress indicators
- No visual distinction between campaign statuses at a glance
- Empty states are generic
- No confirmation before destructive actions

---

## Rebuild Plan

### Step 1: Clean Up Dead Code
- Delete `src/pages/CampaignsResilient.tsx` (unused)
- Delete `src/components/CreateCampaignDialog.tsx` (superseded by EmailCampaignCreator and PhysicalCampaignCreator)
- Delete `src/components/UnifiedCampaignCreator.tsx` and `src/components/UnifiedCampaignDialog.tsx` if unused
- Delete `src/components/CampaignDetailDialog.tsx` and `src/components/CampaignExecutionDialog.tsx` if unused

### Step 2: Rebuild Main Campaigns Page (`src/pages/Campaigns.tsx`)

**New Layout:**
```
+--------------------------------------------------+
| Stats Bar (compact, single row)                   |
| [Total: 12] [Active: 3] [Completed: 8] [Draft:1] |
+--------------------------------------------------+
| Toolbar: [Search...] [Filter: Status] [+ Email] [+ Gift] |
+--------------------------------------------------+
| Tab: All | Email | Gift                           |
+--------------------------------------------------+
| Campaign Cards Grid (2-3 columns)                 |
| Each card shows:                                  |
|   - Icon + Name + Status badge                    |
|   - Type + Office count + Progress bar            |
|   - Date created + Planned date                   |
|   - Quick actions: View | Execute | Delete        |
+--------------------------------------------------+
```

**Key Changes:**
- Compact inline stats (horizontal chips, not 4 full cards)
- Add a search input to filter campaigns by name
- Add status filter dropdown (All, Draft, Active, Completed)
- Add tabs: All / Email / Gift to switch between views
- Unified campaign card component with progress indicator
- Add delete campaign functionality with confirmation dialog
- Add status change (Draft -> Active -> Completed) via dropdown on each card

### Step 3: Improve Email Campaign Creator (`EmailCampaignCreator.tsx`)
- Keep the 2-step wizard but improve step indicators (numbered circles with connecting line)
- Add campaign name auto-suggestion based on type + date
- Improve office selection with a search/filter input within the list
- Add a "Preview" summary before final creation
- Better validation messages inline (not just toast)

### Step 4: Improve Physical/Gift Campaign Creator (`PhysicalCampaignCreator.tsx`)
- Streamline from 4 steps to 3 (merge campaign details + gift bundle into one step)
- Add visual gift bundle cards with icons
- Show running cost estimate prominently as offices are selected
- Better step navigation with clear progress

### Step 5: Improve Email Execution Dialog (`EmailExecutionDialog.tsx`)
- Remove auto-generate on open (add explicit "Generate All Emails" button instead)
- Add batch actions: "Copy All", "Mark All as Sent"
- Add a progress bar showing generation/sent status
- Collapsible email preview cards (show subject only, expand for body)
- Add "Send via Email" button that pre-fills the recipient if office has an email

### Step 6: Improve Gift Delivery Dialog (`GiftDeliveryDialog.tsx`)
- Add a progress bar at the top (delivered/total)
- Add batch "Mark All as Delivered" button
- Add sorting: by status (pending first), by office name
- Better visual hierarchy for delivery cards

### Step 7: Add Campaign Actions
- **Delete Campaign**: With confirmation dialog, cascading delete of deliveries
- **Status Toggle**: Dropdown or button to change Draft -> Active -> Completed
- **Duplicate Campaign**: Copy an existing campaign with new name
- **Export**: Export campaign summary as CSV

---

## Technical Details

### Files to Delete
| File | Reason |
|------|--------|
| `src/pages/CampaignsResilient.tsx` | Dead code, not routed |
| `src/components/CreateCampaignDialog.tsx` | Superseded |
| `src/components/CampaignDetailDialog.tsx` | Check if used, likely superseded |
| `src/components/CampaignExecutionDialog.tsx` | Check if used, likely superseded |
| `src/components/UnifiedCampaignCreator.tsx` | Check if used |
| `src/components/UnifiedCampaignDialog.tsx` | Check if used |

### Files to Rewrite/Heavily Modify
| File | Changes |
|------|---------|
| `src/pages/Campaigns.tsx` | Full rewrite: compact stats, search, filters, tabs, delete/status actions |
| `src/components/campaign/EmailCampaignCreator.tsx` | Add search in office list, auto-name, preview step |
| `src/components/campaign/PhysicalCampaignCreator.tsx` | Consolidate steps, better gift bundle UI |
| `src/components/campaign/EmailExecutionDialog.tsx` | Remove auto-generate, add batch actions, collapsible cards |
| `src/components/campaign/GiftDeliveryDialog.tsx` | Add progress bar, batch actions, sorting |
| `src/components/campaign/EmailCampaignDetailDialog.tsx` | Minor cleanup, consistency |
| `src/components/campaign/GiftCampaignDetailDialog.tsx` | Minor cleanup, consistency |

### No Database Changes Required
All the campaign infrastructure (campaigns, campaign_deliveries tables) already exists with proper RLS policies. The changes are purely frontend.

### Implementation Order
1. Delete dead code files
2. Rewrite `Campaigns.tsx` main page with new layout
3. Improve `EmailCampaignCreator.tsx`
4. Improve `PhysicalCampaignCreator.tsx`
5. Improve `EmailExecutionDialog.tsx` (remove auto-generate, add batch actions)
6. Improve `GiftDeliveryDialog.tsx` (progress bar, batch actions)
7. Clean up detail dialogs
8. Test end-to-end

