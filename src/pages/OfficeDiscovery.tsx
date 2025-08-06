import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Navigation, Phone, Mail, Globe, Star, List, MapIcon, Crosshair, AlertCircle } from 'lucide-react';
import MapWrapper from '@/components/MapComponent';
import { sampleClinics, filterClinics, CLINIC_SPECIALTIES, Clinic } from '@/lib/sampleClinics';
import { useToast } from '@/hooks/use-toast';

export function OfficeDiscovery() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All Specialties');
  const [searchRadius, setSearchRadius] = useState(10);
  const [filteredClinics, setFilteredClinics] = useState<(Clinic & { distance: number })[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [currentView, setCurrentView] = useState<'map' | 'list'>('map');
  const { toast } = useToast();

  // Default location (NYC area)
  const defaultLocation = { lat: 40.7128, lng: -74.0060 };

  useEffect(() => {
    const location = userLocation || defaultLocation;
    const filtered = filterClinics(sampleClinics, location.lat, location.lng, searchRadius, selectedSpecialty);
    setFilteredClinics(filtered);
  }, [userLocation, searchRadius, selectedSpecialty]);

  const getUserLocation = () => {
    setIsLoadingLocation(true);
    
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Please enter your address manually.",
        variant: "destructive",
      });
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoadingLocation(false);
        toast({
          title: "Location detected",
          description: "Found your current location successfully.",
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLoadingLocation(false);
        toast({
          title: "Location access denied",
          description: "Please enter your address manually or check location permissions.",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  const geocodeAddress = async (address: string) => {
    // This would typically use Google Geocoding API
    // For demo purposes, we'll simulate with NYC coordinates
    if (address.toLowerCase().includes('new york') || address.toLowerCase().includes('nyc')) {
      setUserLocation({ lat: 40.7128, lng: -74.0060 });
      toast({
        title: "Address found",
        description: "Set location to New York area.",
      });
    } else {
      toast({
        title: "Address geocoding",
        description: "For demo purposes, defaulting to NYC area. In production, this would use Google Geocoding API.",
      });
      setUserLocation({ lat: 40.7128, lng: -74.0060 });
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualAddress.trim()) {
      geocodeAddress(manualAddress);
    }
  };

  // Prepare map markers
  const mapMarkers = [
    // User location marker
    ...(userLocation ? [{
      position: userLocation,
      title: 'Your Location',
      info: `
        <div class="p-3">
          <h3 class="font-semibold text-primary">📍 Your Location</h3>
          <p class="text-sm text-muted-foreground mt-1">This is your current location</p>
        </div>
      `
    }] : []),
    // Clinic markers
    ...filteredClinics.map(clinic => ({
      position: { lat: clinic.latitude, lng: clinic.longitude },
      title: clinic.name,
      info: `
        <div class="p-4 max-w-sm">
          <div class="flex items-start justify-between mb-2">
            <h3 class="font-semibold text-lg">${clinic.name}</h3>
            <span class="text-xs bg-primary/10 text-primary px-2 py-1 rounded">${clinic.specialty}</span>
          </div>
          <div class="space-y-2 text-sm">
            <p class="flex items-center gap-1">
              <span class="text-muted-foreground">📍</span>
              ${clinic.address}
            </p>
            ${clinic.phone ? `<p class="flex items-center gap-1">
              <span class="text-muted-foreground">📞</span>
              ${clinic.phone}
            </p>` : ''}
            ${clinic.rating ? `<p class="flex items-center gap-1">
              <span class="text-muted-foreground">⭐</span>
              ${clinic.rating}/5.0
            </p>` : ''}
            <p class="flex items-center gap-1">
              <span class="text-muted-foreground">📏</span>
              ${clinic.distance.toFixed(1)} miles away
            </p>
          </div>
          <div class="mt-3 pt-2 border-t">
            <p class="text-xs text-muted-foreground">${clinic.description}</p>
          </div>
        </div>
      `
    }))
  ];

  const mapCenter = userLocation || defaultLocation;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Office Discovery
            <Badge variant="secondary">{filteredClinics.length} clinics found</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Location Controls */}
            <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>Your Location</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={getUserLocation}
                    disabled={isLoadingLocation}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Crosshair className="h-4 w-4" />
                    {isLoadingLocation ? 'Locating...' : 'Auto-Detect'}
                  </Button>
                  {userLocation && (
                    <Badge variant="success">Location detected</Badge>
                  )}
                </div>
                <form onSubmit={handleAddressSubmit} className="flex gap-2">
                  <Input
                    placeholder="Or enter address manually..."
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" variant="outline" size="sm">
                    Set
                  </Button>
                </form>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Specialty</Label>
                  <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINIC_SPECIALTIES.map(specialty => (
                        <SelectItem key={specialty} value={specialty}>
                          {specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Search Radius</Label>
                  <Select value={searchRadius.toString()} onValueChange={(value) => setSearchRadius(Number(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 miles</SelectItem>
                      <SelectItem value="10">10 miles</SelectItem>
                      <SelectItem value="25">25 miles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* View Toggle */}
            <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as 'map' | 'list')}>
              <TabsList>
                <TabsTrigger value="map" className="gap-2">
                  <MapIcon className="h-4 w-4" />
                  Map View
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2">
                  <List className="h-4 w-4" />
                  List View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="map" className="mt-4">
                <div className="h-[600px] rounded-lg overflow-hidden border">
                  <MapWrapper
                    center={mapCenter}
                    zoom={filteredClinics.length === 0 ? 12 : 11}
                    markers={mapMarkers}
                    height="100%"
                  />
                </div>
              </TabsContent>

              <TabsContent value="list" className="mt-4">
                <div className="grid gap-4 max-h-[600px] overflow-y-auto">
                  {filteredClinics.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No clinics found</h3>
                        <p className="text-muted-foreground">
                          Try expanding your search radius or selecting a different specialty.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredClinics.map(clinic => (
                      <Card key={clinic.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">{clinic.name}</h3>
                              <Badge variant="secondary" className="mt-1">
                                {clinic.specialty}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-primary">
                                {clinic.distance.toFixed(1)} mi
                              </div>
                              {clinic.rating && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  {clinic.rating}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <p className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              {clinic.address}
                            </p>
                            
                            {clinic.phone && (
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                {clinic.phone}
                              </p>
                            )}

                            {clinic.email && (
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {clinic.email}
                              </p>
                            )}

                            {clinic.website && (
                              <p className="flex items-center gap-2 text-muted-foreground">
                                <Globe className="h-4 w-4" />
                                <a href={clinic.website} target="_blank" rel="noopener noreferrer" 
                                   className="text-primary hover:underline">
                                  Visit Website
                                </a>
                              </p>
                            )}
                          </div>

                          {clinic.description && (
                            <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                              {clinic.description}
                            </p>
                          )}

                          <div className="flex gap-2 mt-4">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const encodedAddress = encodeURIComponent(clinic.address);
                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
                              }}
                            >
                              Get Directions
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedClinic(clinic)}
                            >
                              View Details
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}