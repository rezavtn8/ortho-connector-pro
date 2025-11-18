import React, { createContext, useContext, ReactNode } from 'react';
import { useBrandSettings, BrandSettings } from '@/hooks/useBrandSettings';

interface BrandContextType {
  settings: BrandSettings;
  loading: boolean;
  saving: boolean;
  updateSettings: (updates: Partial<BrandSettings>) => Promise<boolean>;
  refetchSettings: () => Promise<void>;
  applyBrandColors: () => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export const BrandProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const brandSettings = useBrandSettings();

  return (
    <BrandContext.Provider value={brandSettings}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
};
