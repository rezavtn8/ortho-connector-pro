import React from 'react';
import { UnifiedSourceDialog } from './UnifiedSourceDialog';

interface AddOfficeDialogProps {
  onOfficeAdded: () => void;
}

// Wrapper component for backward compatibility - defaults to Office type
export const AddOfficeDialog: React.FC<AddOfficeDialogProps> = ({ onOfficeAdded }) => {
  return (
    <UnifiedSourceDialog
      onSourceAdded={onOfficeAdded}
      defaultSourceType="Office"
    />
  );
};

// Export alias for backward compatibility
export const AddSourceDialog = AddOfficeDialog;