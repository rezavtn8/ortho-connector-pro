import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Phone, Globe, Loader2, Building2 } from 'lucide-react';

interface FilledDetail {
  id: string;
  officeName: string;
  original: {
    phone: string | null;
    website: string | null;
  };
  filled: {
    phone: string | null;
    website: string | null;
  };
  success: boolean;
  changed: boolean;
  error?: string;
}

interface FillDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: FilledDetail[];
  onConfirm: (selectedIds: string[]) => Promise<void>;
}

export function FillDetailsDialog({ open, onOpenChange, details, onConfirm }: FillDetailsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const { successfulChanges, failures, noChanges } = useMemo(() => {
    const successfulChanges = details.filter(d => d.success && d.changed);
    const failures = details.filter(d => !d.success);
    const noChanges = details.filter(d => d.success && !d.changed);
    return { successfulChanges, failures, noChanges };
  }, [details]);

  // Auto-select all successful changes
  useState(() => {
    setSelectedIds(successfulChanges.map(d => d.id));
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(successfulChanges.map(d => d.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsApplying(true);
    try {
      await onConfirm(selectedIds);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Fill Missing Office Details
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 py-4 min-h-0">
          <div className="space-y-4 pb-2">
            {/* No Changes Needed */}
            {successfulChanges.length === 0 && failures.length === 0 && noChanges.length > 0 && (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">All Details Already Complete!</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  All {noChanges.length} offices already have their phone and website information filled in.
                </p>
              </div>
            )}

            {/* Successful Changes */}
            {successfulChanges.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Found Details ({successfulChanges.length})
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll}>Deselect All</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {successfulChanges.map((detail) => (
                    <div
                      key={detail.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.includes(detail.id)}
                        onCheckedChange={() => toggleSelection(detail.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{detail.officeName}</p>
                        <div className="mt-2 space-y-1.5">
                          {detail.filled.phone && detail.filled.phone !== detail.original.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Phone:</span>
                              <span className="text-green-600 dark:text-green-400">{detail.filled.phone}</span>
                              {detail.original.phone && (
                                <span className="text-xs text-muted-foreground">(was: {detail.original.phone})</span>
                              )}
                            </div>
                          )}
                          {detail.filled.website && detail.filled.website !== detail.original.website && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Website:</span>
                              <span className="text-green-600 dark:text-green-400 truncate max-w-[300px]">
                                {detail.filled.website}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failures */}
            {failures.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Could Not Find ({failures.length})
                </h3>
                <div className="space-y-2">
                  {failures.map((detail) => (
                    <div
                      key={detail.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5"
                    >
                      <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{detail.officeName}</p>
                        <p className="text-xs text-destructive mt-1">{detail.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Already Complete */}
            {noChanges.length > 0 && successfulChanges.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2 text-muted-foreground">
                  Already Complete ({noChanges.length})
                </h3>
                <p className="text-sm text-muted-foreground">
                  {noChanges.length} offices already have all details filled or no new data was found.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {selectedIds.length} of {successfulChanges.length} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={selectedIds.length === 0 || isApplying}>
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                `Apply ${selectedIds.length} Updates`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
