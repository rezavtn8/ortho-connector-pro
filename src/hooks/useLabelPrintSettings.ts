import { useCallback, useEffect, useState } from 'react';
import type { LabelCustomization } from '@/components/LabelCustomizationDialog';

export type LabelNameFormat = 'office' | 'contact';

export interface LabelPrintSettings {
  templateKey: string;
  copies: number;
  startOffset: number;
  nameFormat: LabelNameFormat;
  customization: LabelCustomization;
}

export const DEFAULT_CUSTOMIZATION: LabelCustomization = {
  showLogo: false,
  showReturnAddress: false,
  showBranding: false,
  showFromLabel: true,
  showToLabel: true,
  logoSizeMultiplier: 1.0,
  fontSizeMultiplier: 1.0,
  fromFontSizeMultiplier: 1.0,
  lineSpacing: 'normal',
  toAlignment: 'center',
  fromPosition: 'top-left',
  layoutMode: 'auto',
  useAutoOptimization: true,
};

const DEFAULTS: LabelPrintSettings = {
  templateKey: '5160',
  copies: 1,
  startOffset: 0,
  nameFormat: 'office',
  customization: DEFAULT_CUSTOMIZATION,
};

const STORAGE_KEY = 'nexora.mailing-labels.print-settings.v1';

function read(): LabelPrintSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LabelPrintSettings>;
    return {
      ...DEFAULTS,
      ...parsed,
      customization: { ...DEFAULT_CUSTOMIZATION, ...(parsed.customization ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Print setup persisted across sessions, so a practice that always runs Avery 5163
 * with its logo does not re-pick it every time.
 *
 * `logoUrl` is deliberately dropped before writing: an uploaded logo is a base64
 * data URL that can be ~2 MB on its own and would blow the 5 MB localStorage quota.
 * The customization dialog re-hydrates the clinic logo from Settings on open.
 */
export function useLabelPrintSettings() {
  const [settings, setSettings] = useState<LabelPrintSettings>(read);

  useEffect(() => {
    try {
      const { customization, ...rest } = settings;
      const { logoUrl: _logoUrl, ...persistableCustomization } = customization;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...rest, customization: persistableCustomization }),
      );
    } catch {
      // Quota or private-browsing failures are not worth interrupting the user for.
    }
  }, [settings]);

  const update = useCallback((patch: Partial<LabelPrintSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  return { settings, update, reset };
}
