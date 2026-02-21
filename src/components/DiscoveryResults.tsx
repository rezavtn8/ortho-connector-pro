import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Star, Phone, Globe, MapPin, Plus,
  Building2, Users, ArrowUpDown, Navigation, Check, Trash2, FolderOpen
} from 'lucide-react';
import { ImportDiscoveredOfficeDialog } from '@/components/ImportDiscoveredOfficeDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  search_distance: number;
  imported: boolean;
  distance?: number;
  already_in_network?: boolean;
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
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onStartOver?: () => void;
  activeGroupName?: string;
}

export const DiscoveryResults: React.FC<DiscoveryResultsProps> = ({
  offices,
  session,
  onAddToNetwork,
  onOfficeAdded,
  isLoading = false,
  selectedIds = [],
  onSelectionChange,
  onStartOver,
  activeGroupName
}) => {
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'name' | 'type'>('distance');
  const [selectedOffice, setSelectedOffice] = useState<DiscoveredOffice | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAlreadyAdded, setShowAlreadyAdded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Normalize office type for display
  const normalizeOfficeType = (type: string | null | undefined): string => {
    if (!type || type === 'Unknown' || type.trim() === '') return 'Dental Office';
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getOfficeTypeBadgeClass = (type: string): string => {
    const normalized = type.toLowerCase();
    if (normalized.includes('orthodon')) return 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    if (normalized.includes('pediatric') || normalized.includes('children')) return 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300 border-green-200 dark:border-green-800';
    if (normalized.includes('oral') || normalized.includes('surgeon')) return 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-800';
    if (normalized.includes('periodon')) return 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    if (normalized.includes('endodon')) return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
    return 'bg-muted text-muted-foreground border-border';
  };

  // Separate offices into categories
  const newOffices = offices.filter(office => !office.imported && !office.already_in_network);
  const alreadyInNetwork = offices.filter(office => office.already_in_network || office.imported);
  const availableOffices = showAlreadyAdded ? offices : newOffices;

  // Sort offices
  const sortedOffices = [...availableOffices].sort((a, b) => {
    switch (sortBy) {
      case 'distance':
        return (a.distance || 0) - (b.distance || 0);
      case 'rating':
        return (b.google_rating || 0) - (a.google_rating || 0);
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

  // Selection handlers
  const handleSelectAll = () => {
    if (onSelectionChange) {
      const allIds = newOffices.map(o => o.id);
      onSelectionChange(allIds);
    }
  };

  const handleDeselectAll = () => {
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (onSelectionChange) {
      if (selectedIds.includes(id)) {
        onSelectionChange(selectedIds.filter(i => i !== id));
      } else {
        onSelectionChange([...selectedIds, id]);
      }
    }
  };

  const isAllSelected = newOffices.length > 0 && newOffices.every(o => selectedIds.includes(o.id));

  const renderStars = (rating: number | null, reviewCount: number | null) => {
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
        <span className="text-sm text-muted-foreground ml-1">
          {rating}
          {reviewCount && <span className="text-xs"> ({reviewCount} reviews)</span>}
        </span>
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
    const highRated = newOffices.filter(o => (o.google_rating || 0) >= 4.0).length;
    const withWebsite = newOffices.filter(o => o.website).length;
    const avgRating = newOffices.length > 0 
      ? newOffices.reduce((sum, o) => sum + (o.google_rating || 0), 0) / newOffices.filter(o => o.google_rating).length 
      : 0;
    
    return { total, newCount, alreadyAddedCount, highRated, withWebsite, avgRating };
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
            <h3 className="text-lg font-semibold">No Discoveries Yet</h3>
            <p className="text-muted-foreground">
              Use the Discovery Assistant to find dental offices in your area
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold text-lg">{stats.newCount} Offices Available</h3>
              <p className="text-sm text-muted-foreground">{getSearchParametersText()}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">High Rated (4.0+)</p>
                <p className="text-lg font-bold">{stats.highRated}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">With Website</p>
                <p className="text-lg font-bold">{stats.withWebsite}</p>
              </div>
              {stats.alreadyAddedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAlreadyAdded(!showAlreadyAdded)}
                >
                  {showAlreadyAdded ? 'Hide' : 'Show'} In Network ({stats.alreadyAddedCount})
                </Button>
              )}
              {onStartOver && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {activeGroupName && offices.length === 0 ? (
        <Card className="text-center p-8">
          <div className="space-y-4">
            <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">"{activeGroupName}" is Empty</h3>
              <p className="text-muted-foreground">
                Select offices from "All Offices" and use the "Group" button to add them here.
              </p>
            </div>
          </div>
        </Card>
      ) : newOffices.length === 0 && !showAlreadyAdded ? (
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
          {/* Controls with Selection */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {/* Selection controls */}
              {onSelectionChange && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => {
                      if (checked) handleSelectAll();
                      else handleDeselectAll();
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
                  </span>
                </div>
              )}
              
              {/* Sort control */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-8 w-[120px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Distance</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="type">Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Showing {availableOffices.length} offices
            </div>
          </div>

          {/* Grid Results Display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedOffices.map((office) => {
              const isSelected = selectedIds.includes(office.id);
              const isInNetwork = office.already_in_network || office.imported;
              
              return (
                <Card 
                  key={office.id} 
                  className={`hover:shadow-lg transition-all ${
                    isInNetwork ? 'opacity-60 border-blue-300 dark:border-blue-800' : ''
                  } ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {onSelectionChange && !isInNetwork && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(office.id)}
                          className="mt-1"
                        />
                      )}
                      
                      <div className="flex-1">
                        <CardTitle className="text-lg leading-tight">{office.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className={`text-xs border ${getOfficeTypeBadgeClass(office.office_type)}`}>
                            {normalizeOfficeType(office.office_type)}
                          </Badge>
                          {office.distance && (
                            <Badge variant="secondary" className="text-xs">
                              {office.distance.toFixed(1)} mi
                            </Badge>
                          )}
                          {isInNetwork && (
                            <Badge className="bg-blue-500 text-white text-xs">
                              ✓ In Network
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {(office.google_rating || 0) >= 4.5 && (
                        <Badge className="bg-yellow-500 text-white shrink-0">
                          ⭐ Top Rated
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {office.google_rating && renderStars(office.google_rating, office.user_ratings_total)}

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

                    {!isInNetwork ? (
                      <Button
                        onClick={() => handleAddToNetwork(office)}
                        className="w-full"
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
              );
            })}
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
            latitude: selectedOffice.latitude,
            longitude: selectedOffice.longitude,
            google_place_id: selectedOffice.google_place_id,
            google_rating: selectedOffice.google_rating
          }}
          onSourceAdded={handleOfficeAdded}
        />
      )}

      {/* Clear All Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Discovered Offices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all discovered offices from your list. Groups will also be emptied. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onStartOver?.();
                setShowClearConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
