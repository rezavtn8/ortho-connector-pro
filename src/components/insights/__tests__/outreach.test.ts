import { describe, it, expect } from 'vitest';
import {
  channelsInWindow,
  toOutreachEvents,
  type DeliveryRow,
  type OfficeEmailRow,
  type VisitRow,
} from '../outreach';

const visit = (over: Partial<VisitRow> = {}): VisitRow => ({
  office_id: 'o1',
  visit_date: '2026-03-14',
  visited: true,
  ...over,
});

const delivery = (over: Partial<DeliveryRow> = {}): DeliveryRow => ({
  office_id: 'o1',
  delivered_at: null,
  delivery_status: 'pending',
  email_status: null,
  email_sent_at: null,
  created_at: '2026-03-01T10:00:00Z',
  ...over,
});

const email = (over: Partial<OfficeEmailRow> = {}): OfficeEmailRow => ({
  office_id: 'o1',
  sent_at: '2026-03-20T09:00:00Z',
  created_at: '2026-03-19T09:00:00Z',
  status: 'sent',
  ...over,
});

describe('toOutreachEvents — visits', () => {
  it('keeps a completed visit and stamps it with the visit month', () => {
    expect(toOutreachEvents({ visits: [visit()] })).toEqual([
      { officeId: 'o1', channel: 'visit', month: '2026-03' },
    ]);
  });

  it('drops a planned-but-unvisited row', () => {
    expect(toOutreachEvents({ visits: [visit({ visited: false })] })).toEqual([]);
    expect(toOutreachEvents({ visits: [visit({ visited: null })] })).toEqual([]);
  });

  it('drops a row with no usable date rather than defaulting it to the epoch', () => {
    expect(toOutreachEvents({ visits: [visit({ visit_date: null })] })).toEqual([]);
    expect(toOutreachEvents({ visits: [visit({ visit_date: 'not-a-date' })] })).toEqual([]);
    expect(toOutreachEvents({ visits: [visit({ visit_date: '2026-13-01' })] })).toEqual([]);
  });

  it('drops a row with no office', () => {
    expect(toOutreachEvents({ visits: [visit({ office_id: null })] })).toEqual([]);
  });
});

describe('toOutreachEvents — deliveries', () => {
  it('counts a stamped delivery as a campaign contact', () => {
    const events = toOutreachEvents({
      deliveries: [delivery({ delivered_at: '2026-04-02T00:00:00Z', delivery_status: 'delivered' })],
    });
    expect(events).toEqual([{ officeId: 'o1', channel: 'campaign', month: '2026-04' }]);
  });

  it('falls back to created_at when a delivered row was never stamped', () => {
    const events = toOutreachEvents({ deliveries: [delivery({ delivery_status: 'delivered' })] });
    expect(events).toEqual([{ officeId: 'o1', channel: 'campaign', month: '2026-03' }]);
  });

  it('ignores a delivery that has not happened yet', () => {
    expect(toOutreachEvents({ deliveries: [delivery({ delivery_status: 'pending' })] })).toEqual([]);
  });

  it('emits two events when a delivery was both dropped off and emailed', () => {
    const events = toOutreachEvents({
      deliveries: [
        delivery({
          delivered_at: '2026-04-02T00:00:00Z',
          delivery_status: 'delivered',
          email_status: 'sent',
          email_sent_at: '2026-05-09T00:00:00Z',
        }),
      ],
    });

    expect(events).toEqual([
      { officeId: 'o1', channel: 'campaign', month: '2026-04' },
      { officeId: 'o1', channel: 'email', month: '2026-05' },
    ]);
  });
});

describe('toOutreachEvents — office emails', () => {
  it('keeps only sent emails', () => {
    expect(toOutreachEvents({ emails: [email()] })).toEqual([
      { officeId: 'o1', channel: 'email', month: '2026-03' },
    ]);
    expect(toOutreachEvents({ emails: [email({ status: 'draft' })] })).toEqual([]);
  });

  it('falls back to created_at when sent_at is missing', () => {
    const events = toOutreachEvents({ emails: [email({ sent_at: null })] });
    expect(events).toEqual([{ officeId: 'o1', channel: 'email', month: '2026-03' }]);
  });
});

describe('toOutreachEvents — shape', () => {
  it('returns an empty array when given nothing', () => {
    expect(toOutreachEvents({})).toEqual([]);
  });

  it('tolerates null entries inside the arrays', () => {
    const events = toOutreachEvents({
      visits: [null as unknown as VisitRow, visit()],
      deliveries: [null as unknown as DeliveryRow],
      emails: [null as unknown as OfficeEmailRow],
    });
    expect(events).toHaveLength(1);
  });

  it('extracts months in the same shape as monthly_patients.year_month', () => {
    const events = toOutreachEvents({ visits: [visit({ visit_date: '2026-01-31T23:00:00Z' })] });
    expect(events[0].month).toBe('2026-01');
  });
});

describe('channelsInWindow', () => {
  const events = toOutreachEvents({
    visits: [visit({ office_id: 'a', visit_date: '2026-03-01' })],
    deliveries: [
      delivery({ office_id: 'a', delivered_at: '2026-04-01', delivery_status: 'delivered' }),
      delivery({ office_id: 'b', delivered_at: '2026-01-01', delivery_status: 'delivered' }),
    ],
  });

  it('collects every channel that touched an office inside the window', () => {
    const map = channelsInWindow(events, ['2026-03', '2026-04']);
    expect([...map.get('a')!].sort()).toEqual(['campaign', 'visit']);
  });

  it('omits an office whose only events fall outside the window', () => {
    const map = channelsInWindow(events, ['2026-03', '2026-04']);
    // Absent, not an empty set — the caller supplies "never contacted" so that an
    // office we know nothing about and an office we simply did not contact this
    // window stay distinguishable.
    expect(map.has('b')).toBe(false);
  });

  it('returns an empty map for an empty window', () => {
    expect(channelsInWindow(events, []).size).toBe(0);
  });
});
