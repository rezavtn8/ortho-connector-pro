import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, X, Plus, Minus, Calendar } from 'lucide-react';
import { formatYearMonth } from '@/lib/database.types';
import { useSourceTrackingMode } from '@/hooks/useSourceTrackingMode';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MonthlyPatientRowProps {
  sourceId: string;
  yearMonth: string;
  count: number;
  onAdjust: (yearMonth: string, delta: number) => Promise<void>;
  onUpdate: (yearMonth: string, newCount: number) => Promise<void>;
}

export function MonthlyPatientRow({ 
  sourceId, 
  yearMonth, 
  count, 
  onAdjust, 
  onUpdate 
}: MonthlyPatientRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(count);
  const { isEditable, dailyEntryCount, isLoading } = useSourceTrackingMode(sourceId, yearMonth);

  const handleSave = async () => {
    await onUpdate(yearMonth, editValue);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (!isEditable) return;
    setEditValue(count);
    setIsEditing(true);
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {formatYearMonth(yearMonth)}
          {!isEditable && !isLoading && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Calendar className="w-3 h-3" />
                    Daily
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    Tracked via {dailyEntryCount} daily {dailyEntryCount === 1 ? 'entry' : 'entries'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Edit daily entries to change this total
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        {isEditing && isEditable ? (
          <div className="flex items-center justify-center gap-2">
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
              className="w-20"
              min="0"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
            >
              <Save className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={handleStartEdit}
                  className={`font-semibold ${!isEditable ? 'cursor-default' : ''}`}
                  disabled={!isEditable}
                >
                  {count}
                </Button>
              </TooltipTrigger>
              {!isEditable && (
                <TooltipContent>
                  <p className="text-xs">Auto-calculated from daily entries</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
      <TableCell className="text-center">
        {isEditable ? (
          <div className="flex justify-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAdjust(yearMonth, -1)}
              disabled={count <= 0}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAdjust(yearMonth, 1)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            via Daily Patients
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}