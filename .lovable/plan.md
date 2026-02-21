

# Rebuild Activity Logs Page -- Comprehensive & Accurate

## Problem

The current Logs page only shows data from 2 of the 7+ activity-generating tables in the database. Marketing visits (109 records), campaigns, campaign deliveries, discovery sessions, and office interactions are completely invisible. The page also lacks category tabs, summary stats, and pagination.

## Data Sources to Include

| Source Table | Records | What It Tracks |
|---|---|---|
| `activity_log` | 49 | Source CRUD, tags, imports |
| `patient_changes_log` | 19 | Patient count changes |
| `marketing_visits` | 109 | Scheduled & completed visits |
| `campaigns` | 1 | Campaign creation/status |
| `campaign_deliveries` | 2 | Email/gift delivery events |
| `office_interactions` | 0 | Calls, notes, referrals |
| `discovered_offices` | 584 | Discovery activity (aggregated by session) |
| `discovery_sessions` | ~varies | Search sessions run |

## New Page Layout

```text
+-------------------------------------------------------+
| Activity Log                              [Refresh]    |
+-------------------------------------------------------+
| Summary Bar                                            |
| [Total: 180] [Sources: 49] [Visits: 109] [Patients:19]|
+-------------------------------------------------------+
| Category Tabs:                                         |
|  All | Sources | Patient Data | Marketing | Campaigns  |
|      | Discovery                                       |
+-------------------------------------------------------+
| Filters: [Search...] [Date: All/Today/7d/30d] [Clear] |
+-------------------------------------------------------+
| Table (paginated, 50 per page)                         |
| Date | Time | Category | Icon | Description            |
| ------------------------------------------------       |
| 02/20/26 | 14:30 | Visit | ... | Visited "ABC Dental" |
| 02/20/26 | 14:00 | Source| ... | Created "XYZ Ortho"  |
| ...                                                    |
+-------------------------------------------------------+
| Showing 1-50 of 180  [< Prev] [Next >]                |
+-------------------------------------------------------+
```

## Implementation Details

### Step 1: Rewrite `src/pages/Logs.tsx`

**Data Loading** -- Fetch from all 6 tables in parallel:
1. `activity_log` (source CRUD, tags, imports)
2. `patient_changes_log` (with source name join)
3. `marketing_visits` (with office name join via `patient_sources`)
4. `campaigns` (campaign creation/updates)
5. `campaign_deliveries` (with campaign name join)
6. `discovery_sessions` (search sessions)

Each result gets normalized into a unified log entry shape:
```text
{
  id, timestamp, category, action, icon, description, metadata
}
```

**Category Tabs** -- Filter by category:
- All: everything combined
- Sources: `activity_log` entries (source_created, source_deleted, source_updated, tag_added, tag_removed, import_completed)
- Patient Data: `patient_changes_log` entries
- Marketing: `marketing_visits` entries (scheduled, completed, with star ratings)
- Campaigns: `campaigns` + `campaign_deliveries` entries
- Discovery: `discovery_sessions` entries (searches run)

**Filters:**
- Search: text search across description, resource names
- Date range: Today / 7 Days / 30 Days / All Time
- Clear button to reset

**Pagination:**
- 50 entries per page with Prev/Next controls
- Total count displayed

**Summary Stats Bar:**
- Compact horizontal chips showing counts per category

**Description Formatting:**
- Marketing visits: "Visited [Office Name] on [date] -- [visit_type]" or "Scheduled visit to [Office Name] for [date]"
- Campaigns: "Created campaign [name] ([type])" / "Delivered [email/gift] to [office]"  
- Discovery: "Searched for offices within [distance] miles -- found [count] results"
- Patient changes: keep existing format (increase/decrease/manual edit)
- Source activity: keep existing format (created/deleted/updated/tagged)

**Icons per category:**
- Sources: Plus (green), Trash (red), Edit (blue), Tag (purple), Upload (purple)
- Patient Data: TrendingUp (green), TrendingDown (red), Edit (blue)
- Marketing: MapPin (blue) for scheduled, CheckCircle (green) for visited
- Campaigns: Mail (blue) for email, Gift (pink) for gift, Send (green) for delivered
- Discovery: Search (indigo) for search sessions

### Step 2: Increase query limits

Currently limited to 300 activity + 200 patient logs. The new page will fetch up to 500 per table but use client-side pagination to keep rendering fast.

### No Database Changes Required

All the tables already exist with proper RLS policies. This is purely a frontend data-fetching and presentation change.

### Files Modified

| File | Change |
|---|---|
| `src/pages/Logs.tsx` | Full rewrite with comprehensive data sources, tabs, pagination |

