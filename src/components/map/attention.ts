import { computeMomentum, type Momentum, type MomentumReading } from '@/lib/officeMetrics';
import type { MapOffice } from './types';

/**
 * Which relationships are worth a phone call this week, and in what order.
 *
 * Ranked by **patients per month being lost**, not by percentage. A percentage
 * ranking floats the trivia to the top: an office that sent one patient and now
 * sends none is a 100% drop and worth almost nothing, while a VIP going twelve to
 * seven is a 42% drop and the single most expensive thing happening to the practice.
 * Sorting on the absolute loss puts real money first and reads in the unit the owner
 * already thinks in — "you are down four patients a month from Baywood".
 */

export interface AttentionItem extends MomentumReading {
  office: MapOffice;
}

export interface AttentionSummary {
  /** Offices giving up ground, worst first. */
  items: AttentionItem[];
  /** Momentum for every office supplied, including the healthy ones, for the map. */
  byId: Map<string, Momentum>;
  /** Patients per month being lost across the whole list. */
  patientsPerMonthAtRisk: number;
  /** How many offices are growing — the counterweight, so the panel is not all bad news. */
  risingCount: number;
}

const LOSING: readonly Momentum[] = ['slipping', 'quiet'];

/**
 * Order two losing offices.
 *
 * `quiet` outranks `slipping` at equal loss: an office at zero has usually chosen
 * someone else, while an office that is merely down is still choosing you.
 */
function compareSeverity(a: AttentionItem, b: AttentionItem): number {
  if (b.perMonthDelta !== a.perMonthDelta) return b.perMonthDelta - a.perMonthDelta;
  if (a.momentum !== b.momentum) return a.momentum === 'quiet' ? -1 : 1;
  return b.baseline - a.baseline;
}

export function computeAttention(
  offices: readonly MapOffice[],
  month: string | null,
): AttentionSummary {
  const byId = new Map<string, Momentum>();
  const items: AttentionItem[] = [];
  let risingCount = 0;

  if (!month) {
    return { items, byId, patientsPerMonthAtRisk: 0, risingCount: 0 };
  }

  for (const office of offices) {
    const reading = computeMomentum(office.monthly, month);
    byId.set(office.id, reading.momentum);

    if (reading.momentum === 'rising') risingCount++;
    // The guard matters: a `quiet` office with a sub-threshold baseline is already
    // excluded upstream, but a zero-loss entry would still be noise in a to-do list.
    if (LOSING.includes(reading.momentum) && reading.perMonthDelta > 0) {
      items.push({ ...reading, office });
    }
  }

  items.sort(compareSeverity);

  return {
    items,
    byId,
    patientsPerMonthAtRisk: items.reduce((sum, item) => sum + item.perMonthDelta, 0),
    risingCount,
  };
}
