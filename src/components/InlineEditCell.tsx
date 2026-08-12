import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InlineEditCellProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Renders the resting state in a warning colour when the value is required but empty. */
  invalid?: boolean;
  className?: string;
}

/**
 * Click-to-edit table cell. Renders plain text until focused so a 300-row table
 * does not mount 2,000 <input> elements, then swaps to a real input in place.
 */
export const InlineEditCell = React.memo(
  ({ value, onChange, placeholder = '—', invalid = false, className }: InlineEditCellProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (!isEditing) setDraft(value);
    }, [value, isEditing]);

    useEffect(() => {
      if (isEditing) inputRef.current?.select();
    }, [isEditing]);

    const commit = () => {
      setIsEditing(false);
      if (draft !== value) onChange(draft);
    };

    const cancel = () => {
      setDraft(value);
      setIsEditing(false);
    };

    if (isEditing) {
      return (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          className={cn('h-8 text-sm', className)}
        />
      );
    }

    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        onFocus={() => setIsEditing(true)}
        className={cn(
          'w-full min-h-8 rounded px-2 py-1 text-left text-sm truncate',
          'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
          !value && 'text-muted-foreground',
          invalid && 'text-destructive',
          className,
        )}
        title={value || undefined}
      >
        {value || placeholder}
      </button>
    );
  },
);

InlineEditCell.displayName = 'InlineEditCell';
