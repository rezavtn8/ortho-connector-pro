import React from 'react';
import { UnifiedSourceDialog } from './UnifiedSourceDialog';

interface ImportDiscoveredOfficeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSourceAdded: () => void;
  prefillData: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    google_place_id?: string | null;
    google_rating?: number | null;
    office_type?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
}

// Wrapper component for importing discovered offices
export function ImportDiscoveredOfficeDialog({
  open,
  onOpenChange,
  onSourceAdded,
  prefillData
}: ImportDiscoveredOfficeDialogProps) {
  return (
    <UnifiedSourceDialog
      open={open}
      onOpenChange={onOpenChange}
      onSourceAdded={onSourceAdded}
      mode="import-discovered"
      prefillData={{
        ...prefillData,
        notes: prefillData.office_type ? `Discovered as: ${prefillData.office_type}` : undefined
      }}
      defaultSourceType="Office"
    />
  );
}
