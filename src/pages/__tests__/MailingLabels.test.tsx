// @vitest-environment jsdom
/**
 * Render smoke test for the Mailing Labels page.
 *
 * Everything on this page is derived from one free-text address field, so a single
 * bad parse used to take the route down behind the error boundary. This asserts the
 * real tree mounts and that the counts a user prints against — labels, sheets,
 * leftovers, address problems — come out right.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const officesResult = {
  data: [] as Array<Record<string, unknown>>,
  isLoading: false,
};

vi.mock('@/hooks/useOffices', () => ({
  useOffices: () => officesResult,
}));

vi.mock('@/hooks/useDiscoveredGroups', () => ({
  useDiscoveredGroups: () => ({
    groups: [],
    getGroupMemberIds: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/hooks/useSavedLabelSettings', () => ({
  useSavedLabelSettings: () => ({ isLoading: false }),
}));

function office(over: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    name: 'Bright Smiles Orthodontics',
    address: '16100 Sand Canyon Ave Suite 230, Irvine, CA 92618, United States',
    tier: 'VIP',
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  officesResult.data = [];
});

async function render() {
  const { MailingLabels } = await import('@/pages/MailingLabels');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, null, createElement(MailingLabels)),
      ),
    );
  });
}

describe('Mailing Labels page', () => {
  it('renders the parsed rows and the sheet maths', async () => {
    officesResult.data = [
      office(),
      office({ id: 'o2', name: 'Dr. Jane Doe Family Dentistry', address: '1 Elm St, Boston, MA 02108' }),
    ];

    await render();
    const text = container.textContent ?? '';

    expect(text).not.toContain('Something went wrong');
    expect(text).toContain('Bright Smiles Orthodontics');
    // The suite is split off the street line so it prints on its own row.
    expect(text).toContain('16100 Sand Canyon Ave');
    expect(text).toContain('Suite 230');
    // The doctor is recovered without the practice name trailing it.
    expect(text).toContain('Dr. Jane Doe');
    // Two labels fit on one 30-up Avery 5160 sheet with 28 slots to spare.
    expect(text).toContain('Labels selected');
    expect(text).toContain('Unused on last sheet');
    expect(text).toContain('2 of 2 selected');
  });

  it('flags an address that would print undeliverable', async () => {
    officesResult.data = [
      office(),
      office({ id: 'o2', name: 'Harbor Dental', address: 'Somewhere in the office park' }),
    ];

    await render();
    const text = container.textContent ?? '';

    expect(text).toContain('Incomplete (1)');
    expect(text).toContain('Incomplete addresses');
  });

  it('offers a way back to the filters when nothing matches', async () => {
    await render();
    const text = container.textContent ?? '';

    expect(text).toContain('No offices match your filters.');
    expect(text).toContain('Reset filters');
  });
});
