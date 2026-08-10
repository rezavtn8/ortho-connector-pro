/**
 * Which offices we touched, through which channel, in which month.
 *
 * Three tables record outreach and none of them agree on shape: `marketing_visits`
 * has a `visited` flag and a date, `campaign_deliveries` carries three independent
 * status columns that can each mean "this happened", and `office_emails` has its own
 * status vocabulary. This module flattens all of that into one event stream so the
 * circular network chart never has to know about any of it.
 *
 * Pure by design — `vitest.config.ts` runs `environment: "node"`, so nothing here may
 * touch `window` or a clock. Month keys are produced in the same `'YYYY-MM'` shape
 * `monthly_patients.year_month` uses, so a window filter is a plain string compare.
 */

import { MONTH_KEY_PATTERN } from '@/lib/officeMetrics';

export type OutreachChannel = 'visit' | 'campaign' | 'email';

/** The order hubs are laid out and legended in. `none` is always last. */
export const OUTREACH_CHANNELS: readonly OutreachChannel[] = ['visit', 'campaign', 'email'];

export const CHANNEL_LABELS: Readonly<Record<OutreachChannel | 'none', string>> = {
  visit: 'In-person visits',
  campaign: 'Campaign deliveries',
  email: 'Email outreach',
  none: 'Never contacted',
};

export interface OutreachEvent {
  officeId: string;
  channel: OutreachChannel;
  /** `'YYYY-MM'`. */
  month: string;
}

/**
 * `'2026-03-14T…'` or `'2026-03-14'` -> `'2026-03'`, or null if it isn't a usable date.
 *
 * Deliberately a string slice rather than `new Date(...)`. Parsing a bare `'2026-03-14'`
 * gives UTC midnight, which in a negative-offset timezone renders as February — the
 * event would land in the wrong month for every user west of Greenwich.
 */
function monthOf(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length < 7) return null;
  const month = value.slice(0, 7);
  return MONTH_KEY_PATTERN.test(month) ? month : null;
}

export interface VisitRow {
  office_id: string | null;
  visit_date: string | null;
  visited: boolean | null;
}

export interface DeliveryRow {
  office_id: string | null;
  delivered_at: string | null;
  delivery_status: string | null;
  email_status: string | null;
  email_sent_at: string | null;
  created_at: string | null;
}

export interface OfficeEmailRow {
  office_id: string | null;
  sent_at: string | null;
  created_at: string | null;
  status: string | null;
}

/**
 * Flatten the three outreach tables into one event stream.
 *
 * A single campaign delivery can produce two events — a gift dropped off and an email
 * sent are separate contacts with the same office, and collapsing them would make the
 * email channel look empty for anyone who runs email campaigns through the campaign
 * builder rather than the standalone sender.
 *
 * Rows with no usable date are dropped rather than defaulted. A missing date coerced
 * to the epoch would silently pile every incomplete row into January 1970, which then
 * sits outside every window and reads as "never contacted" — the opposite of the truth.
 */
export function toOutreachEvents(input: {
  visits?: readonly VisitRow[];
  deliveries?: readonly DeliveryRow[];
  emails?: readonly OfficeEmailRow[];
}): OutreachEvent[] {
  const out: OutreachEvent[] = [];

  const push = (officeId: string | null, channel: OutreachChannel, month: string | null) => {
    if (!officeId || !month) return;
    out.push({ officeId, channel, month });
  };

  for (const v of input.visits ?? []) {
    // A planned-but-unvisited row is an intention, not a contact.
    if (v?.visited !== true) continue;
    push(v.office_id, 'visit', monthOf(v.visit_date));
  }

  for (const d of input.deliveries ?? []) {
    if (!d) continue;

    // `delivered_at` is the authoritative signal; a delivery marked delivered but
    // never stamped still counts, falling back to when the row was created.
    const delivered =
      d.delivered_at != null || d.delivery_status === 'delivered' || d.delivery_status === 'sent';
    if (delivered) push(d.office_id, 'campaign', monthOf(d.delivered_at ?? d.created_at));

    if (d.email_status === 'sent' || d.email_sent_at != null) {
      push(d.office_id, 'email', monthOf(d.email_sent_at ?? d.created_at));
    }
  }

  for (const e of input.emails ?? []) {
    if (!e || e.status !== 'sent') continue;
    push(e.office_id, 'email', monthOf(e.sent_at ?? e.created_at));
  }

  return out;
}

/**
 * officeId -> the set of channels that touched it inside `months`.
 *
 * Offices with events only *outside* the window are absent from the map entirely, and
 * the caller supplies the empty set. That distinction matters: "not contacted in this
 * window" and "not an office we know about" must not collapse into the same lookup
 * result, or scrubbing back in time would start dropping offices off the ring.
 */
export function channelsInWindow(
  events: readonly OutreachEvent[],
  months: readonly string[],
): Map<string, Set<OutreachChannel>> {
  const inWindow = new Set(months);
  const byOffice = new Map<string, Set<OutreachChannel>>();

  for (const e of events) {
    if (!inWindow.has(e.month)) continue;
    let set = byOffice.get(e.officeId);
    if (!set) {
      set = new Set();
      byOffice.set(e.officeId, set);
    }
    set.add(e.channel);
  }

  return byOffice;
}
