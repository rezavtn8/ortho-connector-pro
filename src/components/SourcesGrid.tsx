import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { PatientSource } from '@/lib/database.types';
import { SourceCard } from '@/components/SourceCard';

interface SourcesGridProps {
  title: string;
  icon: React.ElementType;
  sources: PatientSource[];
  selectedSources: string[];
  editingSource: string | null;
  editForm: Partial<PatientSource>;
  loading: boolean;
  getPatientCounts: (sourceId: string) => { thisMonth: number; total: number };
  onSelectSource: (sourceId: string, checked: boolean) => void;
  onEditSource: (source: PatientSource) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteSources: (sourceIds: string[]) => void;
  onToggleActive: (sourceId: string, isActive: boolean) => void;
  onEditFormChange: (updates: Partial<PatientSource>) => void;
  onUpdatePatients: () => void;
  onViewSource: (sourceId: string) => void;
}

export function SourcesGrid({
  title,
  icon: Icon,
  sources,
  selectedSources,
  editingSource,
  editForm,
  loading,
  getPatientCounts,
  onSelectSource,
  onEditSource,
  onSaveEdit,
  onCancelEdit,
  onDeleteSources,
  onToggleActive,
  onEditFormChange,
  onUpdatePatients,
  onViewSource
}: SourcesGridProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading...</p>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="text-center py-8">
        <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No {title.toLowerCase()} found</p>
      </div>
    );
  }

  const selectedInTable = sources.filter(s => selectedSources.includes(s.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {title} ({sources.length})
        </h3>
        {selectedInTable.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedInTable.length} selected
            </span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDeleteSources(selectedInTable.map(s => s.id))}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {sources.map((source) => {
          const { thisMonth, total } = getPatientCounts(source.id);
          return (
            <SourceCard
              key={source.id}
              source={source}
              thisMonth={thisMonth}
              total={total}
              isSelected={selectedSources.includes(source.id)}
              isEditing={editingSource === source.id}
              editForm={editForm}
              onSelect={(checked) => onSelectSource(source.id, checked)}
              onEdit={() => onEditSource(source)}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onDelete={() => onDeleteSources([source.id])}
              onToggleActive={(isActive) => onToggleActive(source.id, isActive)}
              onEditFormChange={onEditFormChange}
              onUpdatePatients={onUpdatePatients}
              onView={() => onViewSource(source.id)}
            />
          );
        })}
      </div>
    </div>
  );
}