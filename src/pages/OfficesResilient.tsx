import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePatientSourcesResilient } from '@/hooks/useResilientQuery';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { 
  Building2, 
  Plus, 
  Loader2,
  AlertCircle,
  WifiOff,
  Phone,
  Mail,
  MapPin,
  Globe
} from 'lucide-react';

function OfficesContent() {
  const { data: offices, isLoading, error, retry, isOffline } = usePatientSourcesResilient();

  const officeData = offices?.filter(office => office.source_type === 'Office') || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Partner Offices</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Loading your referral partner offices...
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !offices?.length) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Partner Offices</h1>
          </div>
        </div>
        
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              {isOffline ? <WifiOff className="w-6 h-6 text-destructive" /> : <AlertCircle className="w-6 h-6 text-destructive" />}
            </div>
            <CardTitle>
              {isOffline ? 'You\'re Offline' : 'Failed to Load Offices'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {isOffline 
                ? 'Partner offices are not available while offline. Please reconnect to view your offices.'
                : 'Unable to load your partner offices. Please check your connection and try again.'
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
          <Building2 className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Partner Offices</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Manage your referral partner offices and their contact information
        </p>
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 p-4">
            <WifiOff className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-900">You're currently offline</p>
              <p className="text-sm text-orange-700">Showing cached offices. Some features may not be available.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Office Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Your Partner Offices ({officeData.length})</h2>
        <Button className="gap-2" disabled={isOffline}>
          <Plus className="h-4 w-4" />
          Add Office
        </Button>
      </div>

      {/* Offices List */}
      {officeData.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No partner offices yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first referral partner office to begin tracking referrals.
            </p>
            <Button className="gap-2" disabled={isOffline}>
              <Plus className="h-4 w-4" />
              Add Your First Office
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {officeData.map((office) => (
            <Card key={office.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{office.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={office.is_active ? 'default' : 'secondary'}>
                      {office.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">
                      {office.source_type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    {office.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Address</p>
                          <p className="text-sm text-muted-foreground">{office.address}</p>
                        </div>
                      </div>
                    )}

                    {office.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Phone</p>
                          <p className="text-sm text-muted-foreground">{office.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {office.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-sm text-muted-foreground">{office.email}</p>
                        </div>
                      </div>
                    )}

                    {office.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Website</p>
                          <p className="text-sm text-muted-foreground">{office.website}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {office.notes && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{office.notes}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={isOffline}>
                    View Details
                  </Button>
                  <Button variant="outline" size="sm" disabled={isOffline}>
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" disabled={isOffline}>
                    Patient Counts
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

export function Offices() {
  return (
    <ResilientErrorBoundary showNetworkStatus>
      <OfficesContent />
    </ResilientErrorBoundary>
  );
}