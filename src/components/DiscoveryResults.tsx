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
  already_in_network?: boolean; // PHASE 1: New field
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
  const [showAlreadyAdded, setShowAlreadyAdded] = useState(false); // PHASE 3: Toggle for already added

  // PHASE 1: Separate offices into categories
  const newOffices = offices.filter(office => !office.imported && !office.already_in_network);
  const alreadyInNetwork = offices.filter(office => office.already_in_network || office.imported);
  const availableOffices = showAlreadyAdded ? offices : newOffices;

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
    const total = offices.length;
    const newCount = newOffices.length;
    const alreadyAddedCount = alreadyInNetwork.length;
    const highRated = newOffices.filter(o => (o.rating || 0) >= 4.0).length;
    const withWebsite = newOffices.filter(o => o.website).length;
    const avgRating = newOffices.length > 0 
      ? newOffices.reduce((sum, o) => sum + (o.rating || 0), 0) / newOffices.filter(o => o.rating).length 
      : 0;
    
    return { total, newCount, alreadyAddedCount, highRated, withWebsite, avgRating };
  };

  const stats = getStats();

  // PHASE 3: Intelligent recommendations
  const getRecommendations = () => {
    const recommendations = [];
    
    if (stats.newCount < 10 && session && session.search_distance < 25) {
      recommendations.push({
        icon: '🎯',
        message: `Try expanding radius to ${session.search_distance + 10} miles`,
        action: 'expand_radius'
      });
    }
    
    if (stats.newCount === 0 && stats.alreadyAddedCount > 0) {
      recommendations.push({
        icon: '✨',
        message: 'All discovered offices are already in your network',
        action: 'show_added'
      });
    }
    
    return recommendations;
  };

  const recommendations = getRecommendations();

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
      {/* PHASE 3: Enhanced Filter Summary Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-blue-600/10 border-primary/30">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Navigation className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Discovery Results</h3>
                  <p className="text-sm text-muted-foreground">{getSearchParametersText()}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {stats.total} Total
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-background/50 rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">New Opportunities</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.newCount}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">Already in Network</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.alreadyAddedCount}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">High Rated (4.0+)</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.highRated}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">With Website</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.withWebsite}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={showAlreadyAdded ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAlreadyAdded(!showAlreadyAdded)}
              >
                {showAlreadyAdded ? 'Hide' : 'Show'} Already Added ({stats.alreadyAddedCount})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PHASE 3: Intelligent Recommendations */}
      {recommendations.length > 0 && (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                💡 Suggestions to Find More Offices
              </h4>
              {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span>{rec.icon}</span>
                  <span>{rec.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {newOffices.length === 0 && !showAlreadyAdded ? (
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
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'rating' | 'distance')}
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
              Showing {availableOffices.length} offices • Sorted by {sortBy}
            </div>
          </div>

          {/* Grid Results Display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedOffices.map((office) => (
              <Card key={office.id} className={`hover:shadow-lg transition-shadow ${
                office.already_in_network || office.imported ? 'opacity-60 border-blue-300 dark:border-blue-800' : ''
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg leading-tight">{office.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {office.office_type}
                        </Badge>
                        {office.distance && (
                          <Badge variant="secondary" className="text-xs">
                            {office.distance.toFixed(1)} mi
                          </Badge>
                        )}
                        {(office.already_in_network || office.imported) && (
                          <Badge className="bg-blue-500 text-white text-xs">
                            ✓ In Network
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

                  {!(office.already_in_network || office.imported) ? (
                    <Button
                      onClick={() => handleAddToNetwork(office)}
                      className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to Network
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Already Added
                    </Button>
                  )}
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