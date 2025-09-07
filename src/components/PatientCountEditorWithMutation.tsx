import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit2, Check, X, Loader2 } from 'lucide-react';
import { getCurrentYearMonth } from '@/lib/database.types';
import { useUpdatePatientCount } from '@/hooks/useQueryData';

interface PatientCountEditorWithMutationProps {
  sourceId: string;
  currentCount: number;
}

export function PatientCountEditorWithMutation({ 
  sourceId, 
  currentCount 
}: PatientCountEditorWithMutationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newCount, setNewCount] = useState(currentCount.toString());
  
  const updatePatientCount = useUpdatePatientCount();
  const currentMonth = getCurrentYearMonth();

  const handleSave = async () => {
    const count = parseInt(newCount);
    if (isNaN(count) || count < 0) return;

    updatePatientCount.mutate(
      { 
        sourceId, 
        count, 
        yearMonth: currentMonth 
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
        onError: () => {
          // Reset to original value on error
          setNewCount(currentCount.toString());
        }
      }
    );
  };

  const handleCancel = () => {
    setNewCount(currentCount.toString());
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={newCount}
          onChange={(e) => setNewCount(e.target.value)}
          className="w-16 h-8 text-center text-sm"
          min="0"
          disabled={updatePatientCount.isPending}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={updatePatientCount.isPending}
          className="h-8 w-8 p-0"
        >
          {updatePatientCount.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3 text-green-600" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={updatePatientCount.isPending}
          className="h-8 w-8 p-0"
        >
          <X className="w-3 h-3 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Badge variant="secondary" className="font-semibold">
        {currentCount}
      </Badge>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit2 className="w-3 h-3" />
      </Button>
    </div>
  );
}