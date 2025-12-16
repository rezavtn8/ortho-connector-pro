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
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl">Review Address Corrections</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Review the corrected addresses below. Select which ones to apply to your database.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-6 py-3 bg-muted/30 border-b border-border text-sm flex-wrap">
          <Badge variant="outline" className="gap-1.5 bg-background">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-500" />
            <span className="font-medium">{successfulChanges.length}</span>
            <span className="text-muted-foreground">Changes</span>
          </Badge>
          {failures.length > 0 && (
            <Badge variant="outline" className="gap-1.5 bg-background">
              <XCircle className="w-3.5 h-3.5 text-destructive" />
              <span className="font-medium">{failures.length}</span>
              <span className="text-muted-foreground">Failed</span>
            </Badge>
          )}
          
          {successfulChanges.length > 0 && (
            <div className="ml-auto flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={isConfirming}
                className="h-8"
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                disabled={isConfirming}
                className="h-8"
              >
                Deselect All
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="space-y-4 pb-2">
            {/* No Changes Needed - Show success state */}
            {successfulChanges.length === 0 && failures.length === 0 && noChanges.length > 0 && (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">All Addresses Are Correct!</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  All {noChanges.length} addresses were verified against Google Maps and don't need any changes.
                </p>
              </div>
            )}

            {/* Successful Changes */}
            {successfulChanges.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-green-600 dark:text-green-500 flex items-center gap-2 sticky top-0 bg-background py-2 z-10">
                  <CheckCircle2 className="w-4 h-4" />
                  Addresses Needing Correction ({successfulChanges.length})
                </h3>
                {successfulChanges.map((correction) => (
                  <div
                    key={correction.id}
                    className={cn(
                      "border rounded-lg p-4 transition-all cursor-pointer hover:shadow-sm",
                      selectedIds.has(correction.id)
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border hover:border-primary/50 bg-card"
                    )}
                    onClick={() => toggleSelection(correction.id)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(correction.id)}
                        onChange={() => toggleSelection(correction.id)}
                        className="mt-1 cursor-pointer w-4 h-4 accent-primary"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 space-y-3">
                        <p className="font-semibold text-sm text-foreground">{correction.officeName}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Before:</p>
                            <p className="text-sm text-destructive line-through leading-relaxed">{correction.original}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">After:</p>
                            <p className="text-sm text-green-600 dark:text-green-500 font-medium leading-relaxed">{correction.corrected}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Failures */}
            {failures.length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="text-sm font-semibold text-destructive flex items-center gap-2 sticky top-0 bg-background py-2 z-10">
                  <XCircle className="w-4 h-4" />
                  Failed to Correct ({failures.length})
                </h3>
                {failures.map((correction) => (
                  <div
                    key={correction.id}
                    className="border border-destructive/30 rounded-lg p-4 bg-destructive/5"
                  >
                    <p className="font-semibold text-sm mb-2 text-foreground">{correction.officeName}</p>
                    <p className="text-sm text-muted-foreground mb-2">{correction.original}</p>
                    {correction.error && (
                      <p className="text-xs text-destructive mt-2 font-medium">Error: {correction.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 px-6 py-4 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
            className="min-w-24"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || isConfirming}
            className="gap-2 min-w-32"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Apply {selectedIds.size} {selectedIds.size === 1 ? 'Change' : 'Changes'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
