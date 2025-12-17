import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMarketingVisits } from '@/hooks/useMarketingVisits';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { MarketingVisitDialog } from '@/components/MarketingVisitDialog';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Car, 
  Plus, 
  Loader2,
  AlertCircle,
  WifiOff,
  Calendar,
  MapPin,
  User,
  Star,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function MarketingVisitsContent() {
  const { data: visits = [], isLoading, error, retry, isOffline } = useMarketingVisits();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['marketing-visits'] });
  };

  const handleEdit = (visit: any) => {
    setEditingVisit(visit);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingVisit(null);
    setDialogOpen(true);
  };

  const handleDelete = async (visitId: string) => {
    if (!confirm('Are you sure you want to delete this visit?')) return;
    
    setDeletingId(visitId);
    try {
      const { error } = await supabase
        .from('marketing_visits')
        .delete()
        .eq('id', visitId);

      if (error) throw error;

      toast({
        title: "Visit Deleted",
        description: "Marketing visit has been deleted successfully"
      });
      
      queryClient.invalidateQueries({ queryKey: ['marketing-visits'] });
    } catch (error) {
      console.error('Error deleting visit:', error);
      toast({
        title: "Error",
        description: "Failed to delete marketing visit",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !visits?.length) {
    return (
      <div className="space-y-6">
        
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              {isOffline ? <WifiOff className="w-6 h-6 text-destructive" /> : <AlertCircle className="w-6 h-6 text-destructive" />}
            </div>
            <CardTitle>
              {isOffline ? 'You\'re Offline' : 'Failed to Load Visits'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {isOffline 
                ? 'Marketing visits are not available while offline. Please reconnect to view your visits.'
                : 'Unable to load your marketing visits. Please check your connection and try again.'
              }
            </p>
            <Button onClick={retry} disabled={isOffline} className="gap-2">
              <Loader2 className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Offline indicator */}
      {isOffline && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 p-4">
            <WifiOff className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-900">You're currently offline</p>
              <p className="text-sm text-orange-700">Showing cached visits. Some features may not be available.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Visit Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Visits ({visits.length})</h2>
        <Button className="gap-2" disabled={isOffline} onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Log Visit
        </Button>
      </div>

      <MarketingVisitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        visit={editingVisit}
        onSuccess={handleSuccess}
      />

      {/* Visits List */}
      {visits.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No visits logged yet</h3>
            <p className="text-muted-foreground mb-4">
              Start tracking your marketing visits to build stronger relationships with referral sources.
            </p>
            <Button className="gap-2" disabled={isOffline} onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              Log Your First Visit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visits.map((visit) => (
            <Card key={visit.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base truncate">
                        {visit.patient_sources?.name || 'Unknown Office'}
                      </h3>
                      <Badge variant={visit.visited ? 'default' : 'secondary'} className="shrink-0 text-xs">
                        {visit.visited ? 'Done' : 'Planned'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(visit.visit_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {visit.rep_name}
                      </span>
                      <Badge variant="outline" className="text-xs py-0">
                        {visit.visit_type}
                      </Badge>
                      {visit.star_rating && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          {visit.star_rating}/5
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={isOffline} 
                      onClick={() => handleEdit(visit)}
                      className="h-8 px-2"
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={isOffline || deletingId === visit.id} 
                      onClick={() => handleDelete(visit.id)}
                      className="h-8 px-2 text-destructive hover:text-destructive"
                    >
                      {deletingId === visit.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {(visit.contact_person || visit.materials_handed_out?.length > 0 || visit.follow_up_notes) && (
                  <div className="space-y-2 mt-3 pt-3 border-t">
                    {visit.contact_person && (
                      <p className="text-xs">
                        <span className="font-medium">Contact:</span> {visit.contact_person}
                      </p>
                    )}
                    
                    {visit.materials_handed_out && visit.materials_handed_out.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {visit.materials_handed_out.map((material: string) => (
                          <Badge key={material} variant="secondary" className="text-xs py-0">
                            {material}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {visit.follow_up_notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {visit.follow_up_notes}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketingVisits() {
  return (
    <ResilientErrorBoundary showNetworkStatus>
      <MarketingVisitsContent />
    </ResilientErrorBoundary>
  );
}