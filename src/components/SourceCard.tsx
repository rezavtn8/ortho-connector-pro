import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PatientSource, SOURCE_TYPE_CONFIG } from '@/lib/database.types';
import { Eye, Edit, Trash2, Power, Check, X } from 'lucide-react';
import { PatientCountEditor } from '@/components/PatientCountEditor';

interface SourceCardProps {
  source: PatientSource;
  thisMonth: number;
  total: number;
  isSelected: boolean;
  isEditing: boolean;
  editForm: Partial<PatientSource>;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onToggleActive: (isActive: boolean) => void;
  onEditFormChange: (updates: Partial<PatientSource>) => void;
  onUpdatePatients: () => void;
  onView: () => void;
}

export function SourceCard({
  source,
  thisMonth,
  total,
  isSelected,
  isEditing,
  editForm,
  onSelect,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onToggleActive,
  onEditFormChange,
  onUpdatePatients,
  onView
}: SourceCardProps) {
  const config = SOURCE_TYPE_CONFIG[source.source_type];

  return (
    <Card className={`transition-all duration-200 ${isSelected ? 'ring-2 ring-primary/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => onEditFormChange({ name: e.target.value })}
                  placeholder="Source name"
                  className="w-full text-sm border rounded px-2 py-1"
                />
                {editForm.address !== undefined && (
                  <input
                    type="text"
                    value={editForm.address || ''}
                    onChange={(e) => onEditFormChange({ address: e.target.value })}
                    placeholder="Address"
                    className="w-full text-sm border rounded px-2 py-1"
                  />
                )}
              </div>
            ) : (
              <div>
                <CardTitle className="text-base font-medium truncate">{source.name}</CardTitle>
                {source.address && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {source.address}
                  </p>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(e.target.checked)}
              className="rounded"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Type and Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <select
                value={editForm.source_type || source.source_type}
                onChange={(e) => onEditFormChange({ source_type: e.target.value as any })}
                className="text-sm border rounded px-2 py-1"
              >
                {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <span>{config.icon}</span>
                <span className="text-sm">{config.label}</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={source.is_active ? "default" : "secondary"}>
              {source.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleActive(!source.is_active)}
              title={source.is_active ? 'Deactivate' : 'Activate'}
              className="p-1 h-auto"
            >
              <Power className={`w-3 h-3 ${source.is_active ? 'text-green-600' : 'text-gray-400'}`} />
            </Button>
          </div>
        </div>

        {/* Patient Counts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">This Month</div>
            <PatientCountEditor
              sourceId={source.id}
              currentCount={thisMonth}
              onUpdate={onUpdatePatients}
            />
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">{total}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-2 pt-2 border-t">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={onSaveEdit}
                title="Save changes"
                className="text-green-600 hover:text-green-700"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancelEdit}
                title="Cancel"
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={onView}
                title="View details"
                className="hover:text-primary"
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                title="Edit"
                className="hover:text-primary"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                title="Delete"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}