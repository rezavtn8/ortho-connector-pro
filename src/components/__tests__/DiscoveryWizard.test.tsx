// @vitest-environment jsdom
/**
 * Render test for the discovery wizard.
 *
 * The wizard's job is to hand the page a search it can actually run. Its
 * predecessor collected a ZIP code it never validated and reported a usage
 * figure that was hard-coded, so what the user saw and what the search did had
 * drifted apart. These tests pin the contract: what you enter is what gets
 * searched, and what cannot be searched cannot be submitted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { DiscoveryWizard } from '@/components/DiscoveryWizard';
import type { DiscoveryPreferences } from '@/components/DiscoveryWizard';

const PREFERENCES: DiscoveryPreferences = {
  officeType: 'all',
  minRating: 0,
  includeSpecialties: true,
  requireWebsite: false,
};

let container: HTMLDivElement;
let root: Root;

function render(props: Partial<React.ComponentProps<typeof DiscoveryWizard>> = {}) {
  const onDiscover = props.onDiscover ?? vi.fn().mockResolvedValue(undefined);
  act(() => {
    root.render(
      createElement(DiscoveryWizard, {
        onDiscover,
        isLoading: false,
        usage: { used: 2, limit: 25, resetsAt: null },
        preferences: PREFERENCES,
        clinicName: 'Harbor Orthodontics',
        hasClinicLocation: true,
        ...props,
      }),
    );
  });
  return onDiscover;
}

/** Click the first element whose text matches. */
function click(text: string | RegExp) {
  const match = [...container.querySelectorAll('button, label')].find((el) =>
    typeof text === 'string' ? el.textContent?.includes(text) : text.test(el.textContent ?? ''),
  );
  if (!match) throw new Error(`No clickable element matching ${text}`);
  act(() => {
    (match as HTMLElement).click();
  });
  return match as HTMLElement;
}

function goToStep(step: number) {
  for (let i = 1; i < step; i++) click('Next');
}

function type(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`No input matching ${selector}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function findButton(text: string | RegExp) {
  return [...container.querySelectorAll('button')].find((el) =>
    typeof text === 'string' ? el.textContent?.includes(text) : text.test(el.textContent ?? ''),
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('DiscoveryWizard', () => {
  it('renders the first step', () => {
    render();
    expect(container.textContent).toContain('Select Search Distance');
    expect(container.textContent).toContain('10 miles');
  });

  it('shows the real weekly usage it was given', () => {
    render({ usage: { used: 7, limit: 25, resetsAt: null } });
    goToStep(4);
    expect(container.textContent).toContain('7 of 25 used');
  });

  it('submits the distance and preferences the user chose', async () => {
    const onDiscover = render();

    click('25 miles');
    goToStep(3);
    act(() => container.querySelector<HTMLInputElement>('#requireWebsite')!.click());
    click('Next');

    await act(async () => {
      findButton('Discover Offices')!.click();
    });

    expect(onDiscover).toHaveBeenCalledWith(
      { distance: 25, zipCode: '' },
      expect.objectContaining({ requireWebsite: true }),
    );
  });

  it('passes a ZIP override through as the search location', async () => {
    const onDiscover = render();

    click('Next');
    type('#discovery-zip', '92868');
    goToStep(4 - 1);

    await act(async () => {
      findButton('Discover Offices')!.click();
    });

    expect(onDiscover).toHaveBeenCalledWith(
      expect.objectContaining({ zipCode: '92868' }),
      expect.anything(),
    );
  });

  it('blocks a malformed ZIP instead of searching with it', () => {
    render();
    click('Next');
    type('#discovery-zip', '928');

    expect(container.textContent).toContain('5-digit ZIP code');
    expect(findButton('Next')!.disabled).toBe(true);
  });

  it('strips non-digits from the ZIP field', () => {
    render();
    click('Next');
    type('#discovery-zip', '9a2b8c68');
    expect(container.querySelector<HTMLInputElement>('#discovery-zip')!.value).toBe('92868');
  });

  it('will not search with no clinic address and no ZIP', () => {
    render({ hasClinicLocation: false });
    goToStep(4);

    expect(container.textContent).toContain('Add your clinic address in Settings');
    expect(findButton('Discover Offices')!.disabled).toBe(true);
  });

  it('disables the search once the weekly limit is spent', () => {
    render({ usage: { used: 25, limit: 25, resetsAt: null } });
    goToStep(4);

    expect(container.textContent).toContain('Limit reached');
    expect(findButton('Discover Offices')!.disabled).toBe(true);
  });

  it('explains what it is doing while a search runs', () => {
    render({ isLoading: true });
    expect(container.textContent).toMatch(/Locating your search area/);
  });
});
