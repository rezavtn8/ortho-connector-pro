

# Codebase Cleanup: Dead Code, Unused Files, and Performance Issues

## Overview

A systematic audit of the codebase has identified **22 dead/unused files and exports**, **3 duplicate systems** doing the same job, and several performance concerns. All removals are safe -- nothing currently imported or routed.

---

## Category 1: Dead Files (Never Imported Anywhere)

These files exist on disk but are not imported by any other file in the project:

| File | Why It's Dead |
|------|--------------|
| `src/components/AIRecommendations.tsx` | Zero imports found |
| `src/components/SimplifiedBusinessAnalysis.tsx` | Zero imports found |
| `src/components/SmartEmptyState.tsx` | Zero imports found |
| `src/components/OfficeHealthScore.tsx` | Zero imports found |
| `src/components/OfficeActivityTimeline.tsx` | Zero imports found |
| `src/components/VirtualizedOfficeList.tsx` | Zero imports found |
| `src/components/PatientSourceGraph.tsx` | Zero imports found |
| `src/components/ImportantDateCampaignDialog.tsx` | Zero imports found |
| `src/components/ImportantDatesCalendar.tsx` | Zero imports found |
| `src/components/ContextBanner.tsx` | Zero imports found |
| `src/components/SetupChecklist.tsx` | Zero imports found |
| `src/components/SubscriptionRequired.tsx` | Zero imports found |
| `src/components/SecurityAuditLog.tsx` | Zero imports found |
| `src/components/SecuritySettings.tsx` | Zero imports found |
| `src/components/CalendarView.tsx` | Zero imports found |
| `src/components/DateRangePicker.tsx` | Only imports `dateSync` but is never imported itself |
| `src/pages/NotFound.tsx` | Never routed or imported |
| `src/hooks/useOptimisticUpdate.ts` | Zero imports found |
| `src/hooks/useErrorToast.ts` | Zero imports found |
| `src/hooks/useSubscriptionCheck.ts` | Zero imports found |
| `src/hooks/usePagination.ts` | Zero imports found |
| `src/hooks/useDebounce.ts` | Zero imports found |
| `src/utils/errorHandler.ts` | Zero imports found (GlobalErrorHandler class, never used) |
| `src/lib/supabaseClient.ts` | `resilientSupabase` is never imported anywhere |

**Action:** Delete all 24 files.

---

## Category 2: Dead Exports in Used Files

These are exported functions/hooks that exist inside files that ARE used, but these specific exports are never imported:

| File | Dead Export |
|------|-----------|
| `src/hooks/useResilientQuery.ts` | `useCampaignsResilient()` -- never imported |
| `src/hooks/useResilientQuery.ts` | `useMarketingVisitsResilient()` -- never imported |
| `src/hooks/useResilientQuery.ts` | `usePatientSourcesResilient()` -- never imported |

**Action:** Remove these 3 dead exports from `useResilientQuery.ts` (keep `useResilientQuery` and `useProfileDataResilient` which ARE used).

---

## Category 3: Duplicate Systems

### 3a. Duplicate Network Monitoring
Two independent systems both monitor network status and poll Supabase:
- `ConnectionMonitor.tsx` (rendered in `App.tsx`) -- polls `user_profiles` every 30 seconds when offline
- `useResilientQuery.ts` -- independently listens to online/offline events and checks Supabase connectivity

**Problem:** Both make redundant health-check queries to the database.

**Action:** Keep `ConnectionMonitor` for the UI banner. Remove the duplicate network monitoring from `useResilientQuery` -- it already has `enabled: !!user?.id` which handles the offline case via React Query's built-in `refetchOnReconnect`.

### 3b. Global refetchInterval in App.tsx
`App.tsx` sets `refetchInterval: 1000 * 60 * 10` (every 10 minutes) for ALL queries globally. This means every single query in the app auto-refetches every 10 minutes, even pages the user isn't viewing.

**Problem:** Wastes bandwidth and Supabase quota. Combined with `refetchOnWindowFocus: true` and `refetchOnReconnect: true`, the global interval is unnecessary.

**Action:** Remove the global `refetchInterval` from `App.tsx`. Keep it only on the Campaigns page where it's explicitly set to 30s (that one is intentional).

---

## Category 4: Performance Concerns

### 4a. ConnectionMonitor fires unauthenticated queries
`ConnectionMonitor` calls `supabase.from('user_profiles').select('id').limit(1)` on mount even for unauthenticated users on the landing page. This will always fail due to RLS.

**Action:** Add a guard to only run the health check when a user session exists.

### 4b. useResilientQuery appends user.id to ALL query keys
Line 55: `queryKey: [...queryKey, user?.id]` -- this means every time the user object reference changes (e.g., token refresh), all queries get new keys and refetch from scratch instead of using cache.

**Action:** Use `user?.id` as a string dependency, not appended to queryKey. The auth is already enforced by RLS; the queryKey pollution causes unnecessary refetches.

---

## Category 5: Minor Issues

### 5a. Campaigns page refetchInterval: 30s is aggressive
The campaigns page sets `refetchInterval: 30000` (every 30 seconds). Campaign data rarely changes that fast.

**Action:** Increase to 5 minutes (300000) or remove entirely since `refetchOnWindowFocus` already handles staleness.

### 5b. `performance/ErrorBoundary.tsx` is a re-export shim
`src/components/performance/ErrorBoundary.tsx` just re-exports from `../ErrorBoundary`. Nothing imports from this path.

**Action:** Delete the file and the `performance/` directory.

---

## Implementation Order

1. Delete all 24 dead files listed in Category 1
2. Delete `src/components/performance/ErrorBoundary.tsx` and the `performance/` directory
3. Clean dead exports from `useResilientQuery.ts`
4. Remove duplicate network monitoring from `useResilientQuery.ts`
5. Remove global `refetchInterval` from `App.tsx`
6. Guard `ConnectionMonitor` against unauthenticated state
7. Fix queryKey pollution in `useResilientQuery.ts`
8. Reduce campaigns `refetchInterval` from 30s to 5 minutes
9. Verify clean build

