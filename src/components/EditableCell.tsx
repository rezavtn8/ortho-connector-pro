import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface EditableCellProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const EditableCell = React.memo(({ value, onChange, className = '' }: EditableCellProps) => {
  const [localValue, setLocalValue] = useState(value);

  // Sync local state when external value changes (e.g., reset)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  return (
    <Input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`h-8 text-sm border-transparent hover:border-input focus:border-input ${className}`}
    />
  );
});

EditableCell.displayName = 'EditableCell';
