
# Analytics Platform Redesign

## Problems Found

1. **Reports tab is broken** -- It embeds a separate component with its own date/period selectors that conflict with the parent page's controls. It duplicates data already shown in other tabs (trends, distribution, top sources).
2. **Outreach tab is empty** -- Shows placeholder dashes ("-") and a "Coming Soon" message with no real data, despite `marketing_visits` and `campaigns` data being available in the database.
3. **Too many fragmented tabs (7)** -- Trends, Distribution, Performance, Growing, Declining, Outreach, Reports spread information too thin. Users have to click through many tabs to get a full picture.
4. **No unified data flow** -- The parent Analytics page fetches data one way, the embedded Reports component fetches it again independently with different queries.

## Redesign Plan

Consolidate from 7 tabs down to 4 focused, data-rich tabs. Remove the separate Reports component and merge its best features (PDF/CSV export, period comparison) into the main Analytics page.

### New Tab Structure

```text
[Overview]  [Sources]  [Outreach]  [Export]
```

### Tab 1: Overview (merge Trends + Distribution)
- Summary stat cards at top (already exist, keep them)
- Area chart showing monthly patient trends (full width)
- Pie chart for source type distribution (side panel)
- Period-over-period comparison badges on stat cards (from Reports logic)

### Tab 2: Sources (merge Performance + Growing + Declining)
- Sortable table of ALL sources with columns: Name, Type, Current Period, Previous Period, Change %, Trend indicator
- Color-coded rows: green for growing, red for declining
- Built-in sort by clicking column headers (patients, change %)
- Quick filter chips: All / Growing / Declining / Stable
- Bar chart showing top 10 performers above the table

### Tab 3: Outreach (fully functional, replaces empty placeholder)
- Pull real data from `marketing_visits` and `campaigns` tables (already fetched but unused)
- Stat cards: Total Visits, Completed Visits, Completion Rate, Total Campaigns, Active Campaigns
- Bar chart: visits per month over the selected period
- Table: recent marketing visits with office name, date, rep, status
- Campaign summary: active vs completed vs draft

### Tab 4: Export (replaces Reports tab)
- Period selector (Monthly/Quarterly/Yearly) and month picker
- Live preview of key metrics for the selected export period
- PDF export button (branded report with overview, top sources, campaigns, visits)
- CSV export button
- No redundant charts -- just the export controls and a summary preview

## Technical Details

### Files to modify:
- **`src/pages/Analytics.tsx`** -- Complete rewrite of tab content. Consolidate data fetching to include marketing_visits and campaigns in the main query. Remove the Reports import. Reduce to 4 tabs. Add sortable source table, real outreach data, and export functionality (absorb from Reports.tsx).
- **`src/pages/Reports.tsx`** -- Delete this file entirely. Its PDF/CSV export logic will be moved into Analytics.

### Data fetching changes:
- Add `marketing_visits` and `campaigns` queries to the existing `loadAnalytics` function
- Switch from raw `useEffect` + `setState` to `useQuery` for better caching and loading states
- Single data fetch serves all tabs

### New features in the rewrite:
- Sortable source table with filter chips (All/Growing/Declining/Stable)
- Real outreach analytics with visit trends chart and campaign stats
- Integrated PDF/CSV export with period selection
- Period-over-period comparison on overview stat cards
- Cleaner 4-tab layout that shows more data per view
