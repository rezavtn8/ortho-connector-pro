import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Minus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAddDailyPatients } from '@/hooks/useDailyPatients';
import { SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';

interface PatientSource {
  id: string;
  name: string;
  source_type: SourceType;
  is_active: boolean;
}

interface SourceEntry {
  source_id: string;
  count: number;
  selected: boolean;
}

interface AddDailyPatientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  onSuccess?: () => void;
}

export function AddDailyPatientsDialog({
  open,
  onOpenChange,
  initialDate,
  onSuccess
}: AddDailyPatientsDialogProps) {
  const [date, setDate] = useState<Date>(initialDate || new Date());
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [sourceEntries, setSourceEntries] = useState<Record<string, SourceEntry>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  
  const addDailyPatients = useAddDailyPatients();

  useEffect(() => {
    if (open) {
      loadSources();
      if (initialDate) {
        setDate(initialDate);
      }
    }
  }, [open, initialDate]);

  const loadSources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_sources')
        .select('id, name, source_type, is_active')
        .eq('is_active', true)
        .order('source_type')
        .order('name');

      if (error) throw error;

      setSources(data || []);
      
      // Initialize entries
      const entries: Record<string, SourceEntry> = {};
      (data || []).forEach(source => {
        entries[source.id] = {
          source_id: source.id,
          count: 1,
          selected: false
        };
      });
      setSourceEntries(entries);
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSource = (sourceId: string) => {
    setSourceEntries(prev => ({
      ...prev,
      [sourceId]: {
        ...prev[sourceId],
        selected: !prev[sourceId].selected
      }
    }));
  };

  const handleCountChange = (sourceId: string, delta: number) => {
    setSourceEntries(prev => ({
      ...prev,
      [sourceId]: {
        ...prev[sourceId],
        count: Math.max(1, prev[sourceId].count + delta),
        selected: true
      }
    }));
  };

  const handleSubmit = async () => {
    const selectedEntries = Object.values(sourceEntries).filter(e => e.selected);
    
    if (selectedEntries.length === 0) {
      return;
    }

    const inputs = selectedEntries.map(entry => ({
      source_id: entry.source_id,
      date: date,
      count: entry.count,
      notes: notes || undefined
    }));

    await addDailyPatients.mutateAsync(inputs);
    
    // Reset form
    setNotes('');
    const resetEntries: Record<string, SourceEntry> = {};
    sources.forEach(source => {
      resetEntries[source.id] = {
        source_id: source.id,
        count: 1,
        selected: false
      };
    });
    setSourceEntries(resetEntries);
    
    onSuccess?.();
    onOpenChange(false);
  };

  const selectedCount = Object.values(sourceEntries).filter(e => e.selected).length;
  const totalPatients = Object.values(sourceEntries)
    .filter(e => e.selected)
    .reduce((sum, e) => sum + e.count, 0);

  // Group sources by type
  const groupedSources = sources.reduce((acc, source) => {
    const type = source.source_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(source);
    return acc;
  }, {} as Record<string, PatientSource[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Daily Patients
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Source Selection */}
          <div className="space-y-2">
            <Label>Select Sources & Patient Counts</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[300px] border rounded-md p-3">
                <div className="space-y-4">
                  {Object.entries(groupedSources).map(([type, typeSources]) => {
                    const config = SOURCE_TYPE_CONFIG[type as SourceType];
                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <span>{config?.icon || '📌'}</span>
                          <span>{config?.label || type}</span>
                        </div>
                        <div className="space-y-1 pl-6">
                          {typeSources.map(source => {
                            const entry = sourceEntries[source.id];
                            if (!entry) return null;
                            
                            return (
                              <div
                                key={source.id}
                                className={cn(
                                  "flex items-center justify-between p-2 rounded-md transition-colors",
                                  entry.selected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                                )}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <Checkbox
                                    checked={entry.selected}
                                    onCheckedChange={() => handleToggleSource(source.id)}
                                  />
                                  <span className="text-sm truncate">{source.name}</span>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => handleCountChange(source.id, -1)}
                                    disabled={entry.count <= 1}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="w-8 text-center text-sm font-medium">
                                    {entry.count}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => handleCountChange(source.id, 1)}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about these patients..."
              rows={2}
            />
          </div>

          {/* Summary */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
              <Badge variant="secondary">{selectedCount} sources</Badge>
              <span className="text-sm text-muted-foreground">•</span>
              <Badge variant="default">{totalPatients} patients</Badge>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedCount === 0 || addDailyPatients.isPending}
            >
              {addDailyPatients.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add {totalPatients} Patient{totalPatients !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
