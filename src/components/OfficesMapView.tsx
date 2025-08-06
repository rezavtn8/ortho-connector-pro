import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import MapWrapper from './MapComponent';
import { ReferringOffice, OfficeScore } from '@/lib/database.types';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface OfficesMapViewProps {
  offices: Array<ReferringOffice & { 
    score: OfficeScore; 
    totalReferrals: number;
  }>;
}

export function OfficesMapView({ offices }: OfficesMapViewProps) {
  const { user } = useAuth();
  const [selectedOffice, setSelectedOffice] = useState<ReferringOffice | null>(null);
  const [clinicLocation, setClinicLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Load clinic location from user settings
  useEffect(() => {
    const loadClinicLocation = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('clinic_latitude, clinic_longitude')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading clinic location:', error);
          return;
        }

        if (data?.clinic_latitude && data?.clinic_longitude) {
          setClinicLocation({
            lat: Number(data.clinic_latitude),
            lng: Number(data.clinic_longitude),
          });
        }
      } catch (error) {
        console.error('Error loading clinic location:', error);
      }
    };

    loadClinicLocation();
  }, [user]);

  // Default center if no clinic location is set
  const defaultCenter = {
    lat: 40.7128,
    lng: -74.0060,
  };

  // Convert offices to map markers
  const mapMarkers = [
    // Clinic location marker (if available)
    ...(clinicLocation ? [{
      position: clinicLocation,
      title: 'Your Clinic',
      info: `
        <div class="p-3">
          <h3 class="font-semibold text-primary">🏥 Your Clinic</h3>
          <p class="text-sm text-muted-foreground mt-1">This is your clinic location</p>
        </div>
      `
    }] : []),
    // Office markers
    ...offices
      .filter(office => office.latitude && office.longitude)
      .map(office => ({
        position: {
          lat: Number(office.latitude),
          lng: Number(office.longitude),
        },
        title: office.name,
        info: `
          <div class="p-3 max-w-xs">
            <h3 class="font-semibold text-lg mb-2">${office.name}</h3>
            <div class="space-y-1 text-sm">
              <p class="text-gray-600">${office.address}</p>
              ${office.phone ? `<p>📞 ${office.phone}</p>` : ''}
              ${office.email ? `<p>✉️ ${office.email}</p>` : ''}
              <p><strong>Referrals:</strong> ${office.totalReferrals}</p>
              <p><strong>Score:</strong> <span class="inline-block px-2 py-1 rounded text-xs ${getScoreColor(office.score)}">${office.score}</span></p>
              ${office.website ? `<p><a href="${office.website}" target="_blank" class="text-blue-600 hover:underline">🌐 Website</a></p>` : ''}
            </div>
            <div class="mt-3 pt-2 border-t">
              <button onclick="window.open('/office/${office.id}', '_blank')" class="text-blue-600 hover:underline text-sm font-medium">View Details →</button>
            </div>
          </div>
        `,
      }))
  ];

  const getDirections = (office: ReferringOffice) => {
    const encodedAddress = encodeURIComponent(office.address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  const openInGoogleMaps = (office: ReferringOffice) => {
    const encodedAddress = encodeURIComponent(office.address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  function getScoreColor(score: OfficeScore) {
    switch (score) {
      case 'Strong': return 'bg-green-100 text-green-800';
      case 'Moderate': return 'bg-yellow-100 text-yellow-800';
      case 'Sporadic': return 'bg-orange-100 text-orange-800';
      case 'Cold': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  const getScoreBadgeVariant = (score: OfficeScore) => {
    switch (score) {
      case 'Strong': return 'success';
      case 'Moderate': return 'warning';
      case 'Sporadic': return 'info';
      case 'Cold': return 'destructive';
      default: return 'outline';
    }
  };

  // Determine map center and available offices with coordinates
  const officesWithCoordinates = offices.filter(office => office.latitude && office.longitude);
  const mapCenter = clinicLocation || 
    (officesWithCoordinates.length > 0 ? {
      lat: Number(officesWithCoordinates[0].latitude),
      lng: Number(officesWithCoordinates[0].longitude)
    } : defaultCenter);

  return (
    <div className="space-y-6">
      {!clinicLocation && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-medium">
                Set your clinic location in Settings to see accurate distances and directions.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Offices Map View
            <Badge variant="secondary">{officesWithCoordinates.length} offices with coordinates</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Map */}
            <div className="lg:col-span-2">
              <MapWrapper
                center={mapCenter}
                zoom={mapMarkers.length === 1 ? 15 : 10}
                markers={mapMarkers}
                height="500px"
                className="border rounded-lg"
              />
            </div>

            {/* Office List */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Nearby Offices</h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {offices.slice(0, 10).map((office) => (
                  <Card 
                    key={office.id} 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedOffice?.id === office.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedOffice(office)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-sm leading-tight">{office.name}</h4>
                          <Badge variant={getScoreBadgeVariant(office.score)} className="text-xs">
                            {office.score}
                          </Badge>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">{office.address}</p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {office.totalReferrals} referrals
                          </span>
                          {office.distance_from_clinic && (
                            <span className="text-xs text-muted-foreground">
                              {office.distance_from_clinic.toFixed(1)} mi
                            </span>
                          )}
                        </div>

                        <div className="flex gap-1 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/office/${office.id}`, '_blank');
                            }}
                          >
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              getDirections(office);
                            }}
                          >
                            <Navigation className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              openInGoogleMaps(office);
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}