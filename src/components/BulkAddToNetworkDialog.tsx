import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Loader2, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface DiscoveredOffice {
  id: string;
  google_place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  google_rating: number | null;
  user_ratings_total: number | null;
  latitude: number | null;
  longitude: number | null;
  office_type: string;
  distance?: number;
}

interface BulkAddToNetworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offices: DiscoveredOffice[];
  onComplete: () => void;
}

interface ImportResult {
  id: string;
  name: string;
  success: boolean;
  error?: string;
}

export function BulkAddToNetworkDialog({
  open,
  onOpenChange,
  offices,
  onComplete
}: BulkAddToNetworkDialogProps) {
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [currentOffice, setCurrentOffice] = useState<string>('');

  const handleImport = async () => {
    if (!user || offices.length === 0) return;

    setIsImporting(true);
    setProgress(0);
    setResults([]);

    const importResults: ImportResult[] = [];

    // Get user's clinic_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('clinic_id')
      .eq('user_id', user.id)
      .single();

    for (let i = 0; i < offices.length; i++) {
      const office = offices[i];
      setCurrentOffice(office.name);
      setProgress(((i + 1) / offices.length) * 100);

      try {
        // Insert into patient_sources
        const { error: insertError } = await supabase
          .from('patient_sources')
          .insert({
            name: office.name,
            address: office.address,
            phone: office.phone,
            website: office.website,
            google_place_id: office.google_place_id,
            google_rating: office.google_rating,
            latitude: office.latitude,
            longitude: office.longitude,
            distance_miles: office.distance,
            source_type: 'Office',
            created_by: user.id,
            clinic_id: profile?.clinic_id,
            notes: `Imported from discovery. Type: ${office.office_type}`
          });

        if (insertError) throw insertError;

        // Mark as imported in discovered_offices
        await supabase
          .from('discovered_offices')
          .update({ imported: true })
          .eq('id', office.id);

        importResults.push({
          id: office.id,
          name: office.name,
          success: true
        });
      } catch (error: any) {
        console.error(`Error importing ${office.name}:`, error);
        importResults.push({
          id: office.id,
          name: office.name,
          success: false,
          error: error.message || 'Unknown error'
        });
      }

      setResults([...importResults]);
    }

    setIsImporting(false);
    setCurrentOffice('');

    const successCount = importResults.filter(r => r.success).length;
    const failCount = importResults.filter(r => !r.success).length;

    toast({
      title: "Import Complete",
      description: `Successfully added ${successCount} offices${failCount > 0 ? `. ${failCount} failed.` : '.'}`,
      variant: failCount > 0 ? "destructive" : "default"
    });
  };

  const handleClose = () => {
    if (!isImporting) {
      setProgress(0);
      setResults([]);
      setCurrentOffice('');
      onOpenChange(false);
      if (results.some(r => r.success)) {
        onComplete();
      }
    }
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Add {offices.length} Offices to Network
          </DialogTitle>
          <DialogDescription>
            Import selected discovered offices into your network for tracking and campaigns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Office List Preview */}
          {!isImporting && results.length === 0 && (
            <ScrollArea className="h-[200px] rounded-md border p-3">
              <div className="space-y-2">
                {offices.map(office => (
                  <div key={office.id} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{office.name}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {office.office_type}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Progress */}
          {isImporting && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Importing {currentOffice}...
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {Math.round(progress)}% complete
              </p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && !isImporting && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 justify-center">
                {successCount > 0 && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">{successCount} added</span>
                  </div>
                )}
                {failCount > 0 && (
                  <div className="flex items-center gap-1 text-destructive">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{failCount} failed</span>
                  </div>
                )}
              </div>
              
              <ScrollArea className="h-[150px] rounded-md border p-3">
                <div className="space-y-2">
                  {results.map(result => (
                    <div key={result.id} className="flex items-center gap-2 text-sm">
                      {result.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <span className={`truncate ${!result.success ? 'text-destructive' : ''}`}>
                        {result.name}
                      </span>
                      {result.error && (
                        <span className="text-xs text-muted-foreground truncate">
                          - {result.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          {results.length === 0 ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isImporting}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Add ${offices.length} Offices`
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
