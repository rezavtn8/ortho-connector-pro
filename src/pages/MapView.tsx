import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Search } from 'lucide-react';
import { AddressSearch } from '@/components/AddressSearch';
import { MapView as MapComponent } from '@/components/MapView';

interface Office {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function MapView() {
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [searchResults, setSearchResults] = useState<Office[]>([]);
  const [showVisitData, setShowVisitData] = useState(false);

  const handleOfficeSelect = (office: Office | null) => {
    setSelectedOffice(office);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="w-8 h-8 text-blue-600" />
            Map View
          </h1>
          <p className="text-muted-foreground">
            Search and explore office locations with Google Maps integration
          </p>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Location Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address-search">Search for offices or addresses</Label>
              <AddressSearch
                value={selectedOffice?.id}
                onSelect={handleOfficeSelect}
                placeholder="Search offices, addresses, or places..."
              />
            </div>

            {selectedOffice && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  {selectedOffice.name}
                </div>
                {selectedOffice.address && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedOffice.address}
                  </p>
                )}
                {selectedOffice.latitude && selectedOffice.longitude && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Coordinates: {selectedOffice.latitude.toFixed(6)}, {selectedOffice.longitude.toFixed(6)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="show-visits"
                  checked={showVisitData}
                  onChange={(e) => setShowVisitData(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="show-visits" className="text-sm">
                  Show marketing visit data
                </Label>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Quick Actions</h4>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition((position) => {
                        const currentLocation = {
                          id: 'current-location',
                          name: 'Current Location',
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude,
                          address: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
                        };
                        setSelectedOffice(currentLocation);
                      });
                    }
                  }}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Use Current Location
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Interactive Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg overflow-hidden border">
              <MapComponent 
                selectedOfficeId={selectedOffice?.id}
                onOfficeSelect={(officeId) => {
                  // Handle office selection from map
                  console.log('Selected office from map:', officeId);
                }}
                height="600px"
                showVisitData={showVisitData}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Information Panel */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use Map View</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                Search Locations
              </h4>
              <p className="text-sm text-muted-foreground">
                Use Google Places search to find offices, addresses, or any location worldwide.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                View Office Details
              </h4>
              <p className="text-sm text-muted-foreground">
                Click on map markers to see office information and visit history.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-purple-600" />
                Navigation Ready
              </h4>
              <p className="text-sm text-muted-foreground">
                Get directions and plan marketing visit routes efficiently.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}