import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMarketingVisits } from '@/hooks/useMarketingVisits';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { MarketingVisitDialog } from '@/components/MarketingVisitDialog';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Car, 
  Plus, 
  Loader2,
  AlertCircle,
  WifiOff,
  Calendar,
  MapPin,
  User,
  Star
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function MarketingVisitsContent() {
  const { data: visits = [], isLoading, error, retry, isOffline } = useMarketingVisits();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<any>(null);
  const queryClient = useQueryClient();

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <Car className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Marketing Visits</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Loading your marketing visits...
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !visits?.length) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <Car className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Marketing Visits</h1>
          </div>
        </div>
        
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
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <Car className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Marketing Visits</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Track your outreach visits to referral sources
        </p>
      </div>

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
        <div className="grid gap-4">
          {visits.map((visit) => (
            <Card key={visit.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {visit.patient_sources?.name || 'Unknown Office'}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={visit.visited ? 'default' : 'secondary'}>
                      {visit.visited ? 'Completed' : 'Planned'}
                    </Badge>
                    <Badge variant="outline">
                      {visit.visit_type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Visit Date</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(visit.visit_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Rep</p>
                      <p className="text-sm text-muted-foreground">
                        {visit.rep_name}
                      </p>
                    </div>
                  </div>

                  {visit.star_rating && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Rating</p>
                        <p className="text-sm text-muted-foreground">
                          {visit.star_rating}/5 stars
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {visit.patient_sources?.address && (
                  <div className="flex items-start gap-2 mt-4">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">
                        {visit.patient_sources.address}
                      </p>
                    </div>
                  </div>
                )}

                {visit.contact_person && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-1">Contact Person</p>
                    <p className="text-sm text-muted-foreground">{visit.contact_person}</p>
                  </div>
                )}

                {visit.materials_handed_out && visit.materials_handed_out.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Materials Handed Out</p>
                    <div className="flex flex-wrap gap-2">
                      {visit.materials_handed_out.map((material: string) => (
                        <Badge key={material} variant="secondary">
                          {material}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {visit.follow_up_notes && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{visit.follow_up_notes}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={isOffline} onClick={() => handleEdit(visit)}>
                    Edit
                  </Button>
                </div>
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