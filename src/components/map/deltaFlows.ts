import type { Flow } from './types';

/**
 * Month-on-month change per office, for the map's compare mode.
 *
 * The flow map answers "where do patients come from". Comparing two months answers
 * "what moved", which is the question an owner actually opens this page with — and
 * one the scrubber alone cannot answer, because it shows you a month at a time and
 * asks you to hold the previous one in your head.
 */

export interface DeltaFlow {
  sourceId: string;
  hubId: string;
  /** Patients now minus patients in the baseline month. Never zero. */
  delta: number;
}

export interface DeltaSummary {
  flows: DeltaFlow[];
  /** Largest single change either way, for scaling arc widths. At least 1. */
  maxDelta: number;
  gained: number;
  lost: number;
}

const EMPTY: DeltaSummary = { flows: [], maxDelta: 1, gained: 0, lost: 0 };

/**
 * Diff two months of flows.
 *
 * An office present in only one of the two months still produces an arc — those are
 * the interesting ones. A relationship that started, or stopped, is exactly what a
 * side-by-side of two months is meant to surface, and dropping it because it has no
 * counterpart would hide the largest changes on the map.
 */
export function computeDeltaFlows(
  current: readonly Flow[],
  baseline: readonly Flow[],
  keep?: (sourceId: string) => boolean,
): DeltaSummary {
  if (current.length === 0 && baseline.length === 0) return EMPTY;

  // Keyed by office+hub so a multi-location practice diffs each leg separately.
  const key = (f: Flow) => `${f.sourceId}|${f.hubId}`;
  const totals = new Map<string, { sourceId: string; hubId: string; delta: number }>();

  const accumulate = (flows: readonly Flow[], sign: 1 | -1) => {
    for (const flow of flows) {
      if (keep && !keep(flow.sourceId)) continue;
      const k = key(flow);
      const entry = totals.get(k);
      if (entry) entry.delta += sign * flow.count;
      else totals.set(k, { sourceId: flow.sourceId, hubId: flow.hubId, delta: sign * flow.count });
    }
  };

  accumulate(current, 1);
  accumulate(baseline, -1);

  const flows: DeltaFlow[] = [];
  let maxDelta = 0;
  let gained = 0;
  let lost = 0;

  for (const entry of totals.values()) {
    if (entry.delta === 0) continue; // unchanged offices draw nothing
    flows.push(entry);
    maxDelta = Math.max(maxDelta, Math.abs(entry.delta));
    if (entry.delta > 0) gained += entry.delta;
    else lost -= entry.delta;
  }

  // Biggest movers first, so the heaviest arcs are drawn last and land on top.
  flows.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));

  return { flows, maxDelta: Math.max(1, maxDelta), gained, lost };
}
