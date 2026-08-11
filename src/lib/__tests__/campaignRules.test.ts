import { describe, expect, it } from 'vitest';
import {
  aggregateDeliveries,
  attentionFor,
  bundleCost,
  copyableCampaignFields,
  EMPTY_STATS,
  normalizeMethod,
  normalizeStatus,
  progressFor,
  type DeliveryRow,
} from '@/lib/campaignRules';

const row = (over: Partial<DeliveryRow> = {}): DeliveryRow => ({
  campaign_id: 'c1',
  office_id: 'o1',
  referral_tier: 'VIP',
  email_status: null,
  gift_status: null,
  ...over,
});

describe('normalizeStatus', () => {
  it('folds the casings the table actually contains', () => {
    expect(normalizeStatus('active')).toBe('Active');
    expect(normalizeStatus('Active')).toBe('Active');
    expect(normalizeStatus('COMPLETED')).toBe('Completed');
    expect(normalizeStatus('in progress')).toBe('Active');
  });

  it('treats anything unrecognised as a draft', () => {
    expect(normalizeStatus(null)).toBe('Draft');
    expect(normalizeStatus('')).toBe('Draft');
    expect(normalizeStatus('paused')).toBe('Draft');
  });
});

describe('normalizeMethod', () => {
  it('defaults unknown delivery methods to physical', () => {
    expect(normalizeMethod('email')).toBe('email');
    expect(normalizeMethod('letter')).toBe('letter');
    expect(normalizeMethod('physical')).toBe('physical');
    expect(normalizeMethod(null)).toBe('physical');
  });
});

describe('aggregateDeliveries', () => {
  it('counts each state and keeps the tier mix per campaign', () => {
    const stats = aggregateDeliveries([
      row({ email_status: 'sent' }),
      row({ email_status: 'ready', referral_tier: 'Warm', office_id: 'o2' }),
      row({ email_status: 'pending', referral_tier: 'Warm', office_id: 'o3' }),
      row({ campaign_id: 'c2', gift_status: 'delivered', office_id: 'o4' }),
      row({ campaign_id: 'c2', gift_status: 'failed', office_id: 'o5' }),
    ]);

    const c1 = stats.get('c1')!;
    expect(c1.total).toBe(3);
    // A sent email is also a drafted one.
    expect(c1.drafted).toBe(2);
    expect(c1.sent).toBe(1);
    expect(c1.tiers).toEqual({ VIP: 1, Warm: 2 });
    expect(c1.officeIds).toEqual(['o1', 'o2', 'o3']);

    const c2 = stats.get('c2')!;
    expect(c2.delivered).toBe(1);
    expect(c2.failed).toBe(1);
  });
});

describe('progressFor', () => {
  const stats = { ...EMPTY_STATS, total: 4, drafted: 3, sent: 1, delivered: 2 };

  it('measures each method against its own finish line', () => {
    expect(progressFor('email', stats).done).toBe(1);
    expect(progressFor('letter', stats).done).toBe(3);
    expect(progressFor('physical', stats).done).toBe(2);
  });

  it('reports 0% rather than NaN for an empty campaign', () => {
    const empty = progressFor('email', EMPTY_STATS);
    expect(empty.pct).toBe(0);
    expect(empty.label).toBe('No offices selected');
  });
});

describe('attentionFor', () => {
  const today = new Date('2026-06-15T00:00:00');
  const base = { status: 'Active', planned_delivery_date: null, created_at: '2026-06-01' };
  const stats = (over: Partial<typeof EMPTY_STATS> = {}) => ({ ...EMPTY_STATS, ...over });

  it('flags a campaign that has no offices to send to', () => {
    expect(attentionFor({ ...base, status: 'Draft' }, 'email', stats(), today)?.level).toBe('empty');
  });

  it('flags a finished campaign that was never closed', () => {
    const attention = attentionFor(base, 'email', stats({ total: 3, sent: 3 }), today);
    expect(attention?.level).toBe('closeable');
  });

  it('does not nag about a draft whose material is merely all prepared', () => {
    expect(
      attentionFor({ ...base, status: 'Draft' }, 'letter', stats({ total: 3, drafted: 3 }), today),
    ).toBeNull();
  });

  it('flags a campaign whose send date has passed', () => {
    const attention = attentionFor(
      { ...base, planned_delivery_date: '2026-06-05' },
      'email',
      stats({ total: 3, sent: 1, drafted: 3 }),
      today,
    );
    expect(attention?.level).toBe('overdue');
    expect(attention?.headline).toContain('10 days');
  });

  it('flags an active campaign that has sent nothing', () => {
    expect(attentionFor(base, 'email', stats({ total: 3, drafted: 3 }), today)?.level).toBe(
      'stalled',
    );
  });

  it('stays quiet for a draft that is simply not started yet', () => {
    expect(attentionFor({ ...base, status: 'Draft' }, 'email', stats({ total: 3 }), today)).toBeNull();
  });

  it('stays quiet for a completed campaign', () => {
    expect(
      attentionFor(
        { ...base, status: 'Completed', planned_delivery_date: '2026-01-01' },
        'email',
        stats({ total: 3, sent: 2 }),
        today,
      ),
    ).toBeNull();
  });
});

describe('bundleCost', () => {
  it('reads either key past versions wrote, and never returns NaN', () => {
    expect(bundleCost({ estimatedCost: 75 })).toBe(75);
    expect(bundleCost({ cost: 60 })).toBe(60);
    expect(bundleCost({ estimated_cost: 45 })).toBe(45);
    expect(bundleCost({ name: 'no price' })).toBe(0);
    expect(bundleCost(null)).toBe(0);
  });
});

describe('copyableCampaignFields', () => {
  it('drops the derived fields the list view attaches', () => {
    const copy = copyableCampaignFields({
      id: 'c1',
      name: 'Spring',
      campaign_type: 'referral_outreach',
      delivery_method: 'email',
      created_at: '2026-01-01',
      office_count: 12,
      sent_count: 3,
      stats: { total: 12 },
      progress: { pct: 25 },
    });

    expect(copy).toEqual({
      name: 'Spring',
      campaign_type: 'referral_outreach',
      delivery_method: 'email',
    });
  });
});
