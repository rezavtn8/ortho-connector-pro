import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddressCorrection {
  id: string;
  officeName: string;
  original: string | null;
  corrected: string;
  success: boolean;
  error?: string;
  changed: boolean;
}

interface AddressCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corrections: AddressCorrection[];
  onConfirm: (selectedIds: string[]) => Promise<void>;
}

export function AddressCorrectionDialog({
  open,
  onOpenChange,
  corrections,
  onConfirm,
}: AddressCorrectionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(corrections.filter(c => c.success && c.changed).map(c => c.id))
  );
  const [isConfirming, setIsConfirming] = useState(false);

  const successfulChanges = corrections.filter(c => c.success && c.changed);
  const noChanges = corrections.filter(c => c.success && !c.changed);
  const failures = corrections.filter(c => !c.success);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(successfulChanges.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(Array.from(selectedIds));
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Address Corrections</DialogTitle>
          <DialogDescription>
            Review the corrected addresses below. Select which ones to apply to your database.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-600" />
            {successfulChanges.length} Changes
          </Badge>
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="w-3 h-3 text-yellow-600" />
            {noChanges.length} No Change
          </Badge>
          {failures.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <XCircle className="w-3 h-3 text-red-600" />
              {failures.length} Failed
            </Badge>
          )}
          
          {successfulChanges.length > 0 && (
            <div className="ml-auto flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={isConfirming}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                disabled={isConfirming}
              >
                Deselect All
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 pr-4 max-h-[50vh] overflow-y-auto">
          <div className="space-y-4 pb-4">
            {/* Successful Changes */}
            {successfulChanges.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-green-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Corrected Addresses ({successfulChanges.length})
                </h3>
                {successfulChanges.map((correction) => (
                  <div
                    key={correction.id}
                    className={cn(
                      "border rounded-lg p-4 transition-colors cursor-pointer",
                      selectedIds.has(correction.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => toggleSelection(correction.id)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(correction.id)}
                        onChange={() => toggleSelection(correction.id)}
                        className="mt-1 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-sm">{correction.officeName}</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Before:</p>
                            <p className="text-red-600 line-through">{correction.original}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">After:</p>
                            <p className="text-green-600 font-medium">{correction.corrected}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No Changes */}
            {noChanges.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-yellow-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Already Correct ({noChanges.length})
                </h3>
                {noChanges.map((correction) => (
                  <div
                    key={correction.id}
                    className="border border-border rounded-lg p-4 bg-muted/30"
                  >
                    <p className="font-medium text-sm mb-1">{correction.officeName}</p>
                    <p className="text-sm text-muted-foreground">{correction.original}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Failures */}
            {failures.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Failed to Correct ({failures.length})
                </h3>
                {failures.map((correction) => (
                  <div
                    key={correction.id}
                    className="border border-red-200 rounded-lg p-4 bg-red-50 dark:bg-red-950/20"
                  >
                    <p className="font-medium text-sm mb-1">{correction.officeName}</p>
                    <p className="text-sm text-muted-foreground mb-1">{correction.original}</p>
                    {correction.error && (
                      <p className="text-xs text-red-600 mt-2">Error: {correction.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || isConfirming}
            className="gap-2"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                Apply {selectedIds.size} Selected {selectedIds.size === 1 ? 'Change' : 'Changes'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
