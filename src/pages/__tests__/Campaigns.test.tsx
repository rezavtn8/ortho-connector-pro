// @vitest-environment jsdom
/**
 * Render smoke test for the Campaigns page.
 *
 * A page that type-checks and builds can still mount to nothing — every campaign view
 * is derived data, and one bad read (a null office join, a missing tier bucket) takes
 * the whole route down behind the error boundary. This asserts the real component tree
 * renders, in both the populated and the first-run state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { EMPTY_STATS, progressFor, attentionFor } from '@/lib/campaignRules';
import type { Campaign } from '@/hooks/useCampaigns';

const campaignsResult = {
  data: [] as Campaign[],
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
  isOffline: false,
};

vi.mock('@/hooks/useCampaigns', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useCampaigns')>(
    '@/hooks/useCampaigns',
  );
  return {
    ...actual,
    useCampaigns: () => campaignsResult,
    useCampaignActions: () => ({
      setStatus: vi.fn(),
      remove: vi.fn(),
      duplicate: vi.fn(),
      saveOutcome: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

vi.mock('@/hooks/useOffices', () => ({
  useOffices: () => ({ data: [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }], isLoading: false }),
}));

function campaign(over: Partial<Campaign> = {}): Campaign {
  const stats = { ...EMPTY_STATS, total: 2, sent: 1, drafted: 2, tiers: { VIP: 1, Warm: 1 }, officeIds: ['o1', 'o2'] };
  const base = {
    id: 'c1',
    name: 'Spring Referral Push',
    status: 'Active',
    campaign_type: 'referral_outreach',
    delivery_method: 'email',
    campaign_mode: 'ai_powered',
    created_at: '2026-06-01T00:00:00Z',
    planned_delivery_date: null,
    notes: null,
    selected_gift_bundle: null,
    estimated_cost: null,
    actual_referrals: null,
    materials_checklist: null,
    assigned_rep_id: null,
    clinic_id: null,
    method: 'email' as const,
    statusLabel: 'Active' as const,
    stats,
    ...over,
  };
  return {
    ...base,
    progress: progressFor(base.method, base.stats),
    attention: attentionFor(base, base.method, base.stats),
  } as Campaign;
}

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  campaignsResult.data = [];
});

async function render() {
  const { default: Campaigns } = await import('@/pages/Campaigns');
  await act(async () => {
    root.render(createElement(Campaigns));
  });
}

describe('Campaigns page', () => {
  it('renders the overview, the queue and the campaign grid', async () => {
    campaignsResult.data = [
      campaign(),
      campaign({
        id: 'c2',
        name: 'Holiday Gifts',
        method: 'physical',
        delivery_method: 'physical',
        statusLabel: 'Draft',
        status: 'Draft',
        estimated_cost: 300,
      }),
    ];

    await render();
    const text = container.textContent ?? '';

    expect(text).not.toContain('Something went wrong');
    expect(text).toContain('Spring Referral Push');
    expect(text).toContain('Holiday Gifts');
    // Overview tiles
    expect(text).toContain('In flight');
    expect(text).toContain('Network reached');
    // Both campaigns cover offices o1/o2 of the three in the network.
    expect(text).toContain('2 of 3 offices');
    // A draft's budget is not money committed yet, so it stays out of the total.
    expect(text).toContain('Committed spend$0');
    // Progress copy comes from the method-aware rules, not a shared "delivered".
    expect(text).toContain('1 of 2 sent');
    expect(text).toContain('Showing 2 of 2 campaigns');
  });

  it('shows the first-run guide when the account has no campaigns', async () => {
    await render();
    const text = container.textContent ?? '';

    expect(text).not.toContain('Something went wrong');
    expect(text).toContain('Start reaching your referral network');
    expect(text).toContain('Email campaign');
    expect(text).toContain('Letter campaign');
    expect(text).toContain('Gift campaign');
  });

  it('surfaces a campaign that finished but was never closed', async () => {
    campaignsResult.data = [
      campaign({
        stats: { ...EMPTY_STATS, total: 2, sent: 2, drafted: 2, officeIds: ['o1', 'o2'] },
      }),
    ].map((c) => ({ ...c, progress: progressFor(c.method, c.stats), attention: attentionFor(c, c.method, c.stats) }));

    await render();
    expect(container.textContent).toContain('needs attention');
  });
});
