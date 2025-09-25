import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PatientSource, SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { Trash2, Edit, Eye, Check, X, Power } from 'lucide-react';
import { PatientCountEditor } from '@/components/PatientCountEditor';

interface SourcesTableProps {
  title: string;
  icon: React.ElementType;
  sources: PatientSource[];
  selectedSources: string[];
  editingSource: string | null;
  editForm: Partial<PatientSource>;
  loading: boolean;
  getPatientCounts: (sourceId: string) => { thisMonth: number; total: number };
  onSelectAll: (sources: PatientSource[], checked: boolean) => void;
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

export function SourcesTable({
  title,
  icon: Icon,
  sources,
  selectedSources,
  editingSource,
  editForm,
  loading,
  getPatientCounts,
  onSelectAll,
  onSelectSource,
  onEditSource,
  onSaveEdit,
  onCancelEdit,
  onDeleteSources,
  onToggleActive,
  onEditFormChange,
  onUpdatePatients,
  onViewSource
}: SourcesTableProps) {
  const isAllSelected = sources.length > 0 && sources.every(s => selectedSources.includes(s.id));
  const selectedInTable = sources.filter(s => selectedSources.includes(s.id));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No {title.toLowerCase()} found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title} ({sources.length})
          </CardTitle>
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
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => onSelectAll(sources, checked as boolean)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">This Month</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => {
                const { thisMonth, total } = getPatientCounts(source.id);
                const config = SOURCE_TYPE_CONFIG[source.source_type];
                const isEditing = editingSource === source.id;
                const isSelected = selectedSources.includes(source.id);
                
                return (
                  <TableRow key={source.id} className={isSelected ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onSelectSource(source.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editForm.name || ''}
                            onChange={(e) => onEditFormChange({ name: e.target.value })}
                            placeholder="Source name"
                            className="text-sm"
                          />
                          {editForm.address !== undefined && (
                            <Input
                              value={editForm.address || ''}
                              onChange={(e) => onEditFormChange({ address: e.target.value })}
                              placeholder="Address"
                              className="text-sm"
                            />
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">{source.name}</div>
                          {source.address && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {source.address}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <select
                          value={editForm.source_type || source.source_type}
                          onChange={(e) => onEditFormChange({ source_type: e.target.value as SourceType })}
                          className="text-sm border rounded px-2 py-1"
                        >
                          {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>
                              {config.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{config.icon}</span>
                          <span className="text-sm">{config.label}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={source.is_active ? "default" : "secondary"}>
                        {source.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <PatientCountEditor
                        sourceId={source.id}
                        currentCount={thisMonth}
                        onUpdate={onUpdatePatients}
                      />
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {total}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={onSaveEdit}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={onCancelEdit}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onViewSource(source.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEditSource(source)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onToggleActive(source.id, !source.is_active)}
                              className="h-8 w-8 p-0"
                            >
                              <Power className={`h-4 w-4 ${source.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}