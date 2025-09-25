import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { ImportDataDialog } from '@/components/ImportDataDialog';

interface SourcesFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onDataChange: () => void;
}

export function SourcesFilters({ searchTerm, onSearchChange, onDataChange }: SourcesFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sources..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <ImportDataDialog onImportComplete={onDataChange} />
    </div>
  );
}