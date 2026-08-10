import type { Flow } from './types';

/**
 * The map's time axis: a trailing window of N months ending at the scrubber.
 *
 * One concept covers every view the map offers. A single month is simply a window
 * of one, so nothing is a special case — the same aggregation, the same widths, the
 * same compare arithmetic serve all of them.
 *
 * This exists because the map used to be a point-in-time instrument only: every arc,
 * width, particle and headline number described one month, so the only way to see a
 * relationship whole was to play the animation and remember it. That is backwards.
 * The aggregate is the resting state; a single month is the drill-down.
 */

export type WindowSize = 1 | 3 | 12 | 'all';

/** Widest first, which is the order the control offers them in. */
export const WINDOW_SIZES: readonly WindowSize[] = ['all', 12, 3, 1] as const;

export interface TimeWindow {
  size: WindowSize;
  /** Inclusive indices into the month axis. `endIndex` is -1 only when there are no months. */
  startIndex: number;
  endIndex: number;
  /** The months covered, ascending. */
  months: string[];
  /**
   * Months actually covered, which near the start of the axis is fewer than `size`.
   *
   * This is the divisor for per-month rates, so a practice with four months of
   * history is never reported as averaging a quarter of its real volume.
   */
  monthCount: number;
}

const EMPTY: TimeWindow = {
  size: 'all',
  startIndex: 0,
  endIndex: -1,
  months: [],
  monthCount: 0,
};

/**
 * Resolve the window ending at `endIndex`.
 *
 * The single source of truth for "what period is on screen". Every consumer — arcs,
 * stats, reach, compare — derives from this one call, which is what stops the
 * headline numbers and the map from describing different periods.
 */
export function resolveWindow(
  months: readonly string[],
  size: WindowSize,
  endIndex: number,
): TimeWindow {
  if (months.length === 0) return { ...EMPTY, size };

  const end = Math.max(0, Math.min(Math.trunc(endIndex), months.length - 1));
  const span = size === 'all' ? months.length : size;
  const start = Math.max(0, end - span + 1);

  return {
    size,
    startIndex: start,
    endIndex: end,
    months: months.slice(start, end + 1),
    monthCount: end - start + 1,
  };
}

/**
 * The window of the same length sitting `offsetMonths` earlier, for compare mode.
 *
 * Returns null when the history cannot cover it in full. A partial baseline would
 * silently compare, say, twelve months against four and report the difference as a
 * collapse — the exact false alarm this map exists to avoid raising.
 */
export function baselineWindow(
  months: readonly string[],
  current: TimeWindow,
  offsetMonths: number,
): TimeWindow | null {
  if (offsetMonths <= 0 || current.monthCount === 0) return null;

  const end = current.endIndex - offsetMonths;
  const start = end - current.monthCount + 1;
  if (start < 0 || end < 0) return null;

  return {
    size: current.size,
    startIndex: start,
    endIndex: end,
    months: months.slice(start, end + 1),
    monthCount: end - start + 1,
  };
}

/**
 * Total patients per office+hub across the window.
 *
 * `count` is the true total for the period. Widths divide it by `monthCount`
 * elsewhere so that thickness always means patients *per month* — see `buildArcs`.
 */
export function aggregateFlows(
  flowsByMonth: Readonly<Record<string, Flow[]>>,
  windowMonths: readonly string[],
  keep?: (sourceId: string) => boolean,
): Flow[] {
  if (windowMonths.length === 0) return [];

  // A single month needs no merging, but it still gets fresh objects. Returning the
  // cached rows themselves would hand callers a live reference into the React Query
  // cache, where one `flow.count +=` anywhere would corrupt every other consumer of
  // that month — a bug with no stack trace and no obvious cause.
  if (windowMonths.length === 1) {
    const only = flowsByMonth[windowMonths[0]] ?? [];
    const kept = keep ? only.filter((f) => keep(f.sourceId)) : only;
    return kept.map((f) => ({ sourceId: f.sourceId, hubId: f.hubId, count: f.count }));
  }

  const totals = new Map<string, Flow>();

  for (const month of windowMonths) {
    for (const flow of flowsByMonth[month] ?? []) {
      if (keep && !keep(flow.sourceId)) continue;
      const key = `${flow.sourceId}|${flow.hubId}`;
      const entry = totals.get(key);
      if (entry) entry.count += flow.count;
      else totals.set(key, { sourceId: flow.sourceId, hubId: flow.hubId, count: flow.count });
    }
  }

  return [...totals.values()];
}

/** Patients across the whole window. */
export function totalPatients(flows: readonly Flow[]): number {
  let total = 0;
  for (const flow of flows) total += flow.count;
  return total;
}
