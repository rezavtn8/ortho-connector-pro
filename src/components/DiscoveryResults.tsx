import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Star, Phone, Globe, MapPin, Plus,
  Building2, Users, ArrowUpDown, Navigation, Check
} from 'lucide-react';
import { ImportDiscoveredOfficeDialog } from '@/components/ImportDiscoveredOfficeDialog';

interface DiscoveredOffice {
  id: string;
  place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  office_type: string;
  search_distance: number;
  imported: boolean;
  distance?: number;
}

interface DiscoverySession {
  id: string;
  search_distance: number;
  search_lat: number;
  search_lng: number;
  office_type_filter?: string;
  zip_code_override?: string;
  results_count: number;
  created_at: string;
}

interface DiscoveryResultsProps {
  offices: DiscoveredOffice[];
  session: DiscoverySession | null;
  onAddToNetwork: (office: DiscoveredOffice) => void;
  onOfficeAdded: () => void;
  isLoading?: boolean;
}

export const DiscoveryResults: React.FC<DiscoveryResultsProps> = ({
  offices,
  session,
  onAddToNetwork,
  onOfficeAdded,
  isLoading = false
}) => {
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'name' | 'type'>('distance');
  const [selectedOffice, setSelectedOffice] = useState<DiscoveredOffice | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Filter out already imported offices by default
  const availableOffices = offices.filter(office => !office.imported);

  // Sort offices
  const sortedOffices = [...availableOffices].sort((a, b) => {
    switch (sortBy) {
      case 'distance':
        return (a.distance || 0) - (b.distance || 0);
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'name':
        return a.name.localeCompare(b.name);
      case 'type':
        return a.office_type.localeCompare(b.office_type);
      default:
        return 0;
    }
  });

  const handleAddToNetwork = (office: DiscoveredOffice) => {
    setSelectedOffice(office);
    setShowAddDialog(true);
    onAddToNetwork(office);
  };

  const handleOfficeAdded = () => {
    setSelectedOffice(null);
    setShowAddDialog(false);
    onOfficeAdded();
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground text-sm">No rating</span>;
    
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }
    
    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-4 h-4 fill-yellow-400/50 text-yellow-400" />);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-muted-foreground" />);
    }
    
    return (
      <div className="flex items-center gap-1">
        {stars}
        <span className="text-sm text-muted-foreground ml-1">({rating})</span>
      </div>
    );
  };

  const getSearchParametersText = () => {
    if (!session) return '';
    
    const parts = [
      `${session.search_distance} miles`,
      session.zip_code_override ? `ZIP ${session.zip_code_override}` : 'from clinic',
      session.office_type_filter && session.office_type_filter !== '' ? session.office_type_filter : 'All Types'
    ];
    
    const date = new Date(session.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return `${parts.join(' • ')} • ${date}`;
  };

  const getStats = () => {
    const total = availableOffices.length;
    const highRated = availableOffices.filter(o => (o.rating || 0) >= 4.0).length;
    const avgRating = total > 0 
      ? availableOffices.reduce((sum, o) => sum + (o.rating || 0), 0) / availableOffices.filter(o => o.rating).length 
      : 0;
    
    return { total, highRated, avgRating };
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Discovering offices...</p>
        </div>
      </div>
    );
  }

  if (!session || offices.length === 0) {
    return (
      <Card className="text-center p-8">
        <div className="space-y-4">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">No Discovery Session</h3>
            <p className="text-muted-foreground">
              Use the Discovery Assistant above to find dental offices in your area
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Parameters Display */}
      <Card className="bg-gradient-to-r from-primary/5 to-blue-600/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Navigation className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Search Parameters Used</p>
                <p className="text-sm text-muted-foreground">{getSearchParametersText()}</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {stats.total} offices found
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Available Offices</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-600 rounded-lg">
                <Star className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">High Rated (4.0+)</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.highRated}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Avg Rating</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {availableOffices.length === 0 ? (
        <Card className="text-center p-8">
          <div className="space-y-4">
            <Check className="w-12 h-12 text-green-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">All Offices Already Added</h3>
              <p className="text-muted-foreground">
                All discovered offices have been added to your network
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1 bg-background"
                >
                  <option value="distance">Distance</option>
                  <option value="rating">Rating</option>
                  <option value="name">Name</option>
                  <option value="type">Type</option>
                </select>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {stats.total} offices found • Sorted by {sortBy}
            </div>
          </div>

          {/* Grid Results Display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedOffices.map((office) => (
              <Card key={office.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg leading-tight">{office.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {office.office_type}
                        </Badge>
                        {office.distance && (
                          <Badge variant="secondary" className="text-xs">
                            {office.distance.toFixed(1)} mi
                          </Badge>
                        )}
                      </div>
                    </div>
                    {(office.rating || 0) >= 4.5 && (
                      <Badge className="bg-yellow-500 text-white">
                        ⭐ Top Rated
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {office.rating && renderStars(office.rating)}

                  {office.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{office.address}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {office.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(`tel:${office.phone}`, '_self')}
                      >
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </Button>
                    )}
                    {office.website && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(office.website!, '_blank')}
                      >
                        <Globe className="w-4 h-4 mr-1" />
                        Visit
                      </Button>
                    )}
                  </div>

                  <Button
                    onClick={() => handleAddToNetwork(office)}
                    className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Network
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add to Network Dialog */}
      {selectedOffice && (
        <ImportDiscoveredOfficeDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          prefillData={{
            name: selectedOffice.name,
            address: selectedOffice.address || '',
            phone: selectedOffice.phone || '',
            website: selectedOffice.website || '',
            latitude: selectedOffice.lat,
            longitude: selectedOffice.lng,
            google_place_id: selectedOffice.place_id,
            google_rating: selectedOffice.rating
          }}
          onSourceAdded={handleOfficeAdded}
        />
      )}
    </div>
  );
};