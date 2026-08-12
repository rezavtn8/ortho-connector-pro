// @vitest-environment jsdom
/**
 * Render smoke test for the assistant.
 *
 * The page that type-checks and builds can still mount to nothing, and this one is
 * more exposed than most: it composes a derived briefing, a streaming hook and two
 * lazy sheets, and every signal on the rail is computed from a data shape that a
 * single null office can break. A blank assistant behind an error boundary is
 * indistinguishable from a working one with nothing to say, so the failure is quiet.
 *
 * These assertions are about the contract the surface promises: the briefing is on
 * screen before anything is typed, the signals are ranked by what is at stake, and
 * clicking one asks the assistant its question rather than opening some other view.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { buildBriefing, summarizeBriefing, type BriefingOffice } from '@/lib/briefing';
import { buildMonthlySeries, type MonthlyRow } from '@/lib/officeMetrics';

const NOW = new Date(2026, 7, 7);

const send = vi.fn();
const briefingState = {
  briefing: null as ReturnType<typeof buildBriefing> | null,
  summary: '',
  tierByOffice: new Map<string, string>(),
  loading: false,
  error: null,
  refresh: vi.fn(),
};

vi.mock('@/hooks/useBriefing', () => ({ useBriefing: () => briefingState }));

vi.mock('@/hooks/useAgentChat', () => ({
  useAgentChat: () => ({
    messages: [],
    streaming: false,
    send,
    stop: vi.fn(),
    clear: vi.fn(),
    resolveProposal: vi.fn(),
  }),
}));

// The two sheets are only mounted when opened; stubbing them keeps this test about
// the assistant rather than about the forecast's own network calls.
vi.mock('@/components/ai/AIForecastTab', () => ({ AIForecastTab: () => null }));
vi.mock('@/components/ai/AISettingsTab', () => ({ AISettingsTab: () => null }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => createElement('a', null, children),
}));

function office(id: string, over: Partial<BriefingOffice> = {}): BriefingOffice {
  return {
    id,
    name: id,
    tier: 'Warm',
    l12: 24,
    r3: 6,
    mslr: 0,
    totalReferrals: 24,
    lastActiveMonth: '2026-07',
    ...over,
  };
}

function months(id: string, keys: string[], per: number): MonthlyRow[] {
  return keys.map((year_month) => ({ source_id: id, year_month, patient_count: per }));
}

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  send.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  briefingState.briefing = null;
  briefingState.summary = '';
  briefingState.loading = false;
});

function setBriefing(rows: MonthlyRow[], offices: BriefingOffice[]) {
  const briefing = buildBriefing({
    offices,
    series: buildMonthlySeries(rows),
    // Non-empty so the visit chore does not crowd the assertions below.
    lastVisitByOffice: new Map(offices.map((o) => [o.id, '2026-08-01'])),
    reviewsUnanswered: 0,
    entriesThisMonth: 4,
    nowDate: NOW,
  });
  briefingState.briefing = briefing;
  briefingState.summary = summarizeBriefing(briefing);
}

async function render() {
  const { AIAssistant } = await import('@/pages/AIAssistant');
  await act(async () => {
    root.render(createElement(AIAssistant));
  });
}

describe('AIAssistant', () => {
  it('opens with the briefing rather than an empty prompt', async () => {
    setBriefing(months('Westside Dental', ['2026-02', '2026-03', '2026-04'], 4), [
      office('Westside Dental'),
    ]);

    await render();
    const text = container.textContent ?? '';

    expect(text).not.toContain('Something went wrong');
    expect(text).toContain('What changed');
    expect(text).toContain('Westside Dental has stopped referring');
    // The supporting arithmetic is on screen, not just the claim.
    expect(text).toContain('Was 4/month, now zero for 3 months');
    // And the computed opening line, before the user has typed anything.
    expect(text).toContain('patients in the last three months');
  });

  it('leads with the largest loss, not the loudest label', async () => {
    setBriefing(
      [
        ...months('Small Office', ['2026-02', '2026-03', '2026-04'], 1),
        ...months('Big Office', ['2026-02', '2026-03', '2026-04'], 12),
        ...months('Big Office', ['2026-05', '2026-06', '2026-07'], 4),
      ],
      [office('Small Office'), office('Big Office')],
    );

    await render();
    const text = container.textContent ?? '';

    // "Big Office is slipping" must appear above "Small Office has stopped referring",
    // even though going to zero sounds worse than a partial decline.
    expect(text.indexOf('Big Office')).toBeLessThan(text.indexOf('Small Office'));
    expect(text).toContain('Big Office is slipping');
    expect(text).toContain('12 → 4 per month · 8/month lost');
    // 8 a month from the slip plus 1 from the office that went silent.
    expect(text).toContain('9patients/month at risk');
  });

  it('asks the assistant when a signal is clicked', async () => {
    setBriefing(months('Westside Dental', ['2026-02', '2026-03', '2026-04'], 4), [
      office('Westside Dental'),
    ]);
    await render();

    const ask = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Ask about this'),
    );
    expect(ask).toBeDefined();

    await act(async () => {
      ask!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain('Westside Dental');
  });

  it('says so plainly when there is nothing to report', async () => {
    setBriefing(
      months('Steady Office', ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'], 4),
      [office('Steady Office')],
    );

    await render();
    const text = container.textContent ?? '';

    expect(text).not.toContain('Something went wrong');
    expect(text).toContain('Nothing needs your attention');
  });

  it('renders while the briefing is still loading', async () => {
    briefingState.loading = true;
    await render();
    expect(container.textContent ?? '').not.toContain('Something went wrong');
  });
});
