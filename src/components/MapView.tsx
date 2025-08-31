import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Calendar } from "lucide-react";

interface Office {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source_type: string;
}

interface MapViewProps {
  selectedOfficeId?: string;
  onOfficeSelect?: (officeId: string) => void;
  height?: string;
  showVisitData?: boolean;
}

export function MapView({ 
  selectedOfficeId, 
  onOfficeSelect, 
  height = "400px",
  showVisitData = false 
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});

  // Load offices from database
  useEffect(() => {
    const loadOffices = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('patient_sources')
        .select('id, name, address, latitude, longitude, source_type')
        .eq('is_active', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (!error && data) {
        setOffices(data);
      }

      // Load visit counts if needed
      if (showVisitData) {
        const { data: visitData } = await supabase
          .from('marketing_visits')
          .select('office_id')
          .eq('visited', true);

        if (visitData) {
          const counts = visitData.reduce((acc, visit) => {
            acc[visit.office_id] = (acc[visit.office_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          setVisitCounts(counts);
        }
      }

      setIsLoading(false);
    };

    loadOffices();
  }, [showVisitData]);

  // Initialize Google Map
  useEffect(() => {
    if (!mapRef.current || offices.length === 0) return;

    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
          version: 'weekly',
          libraries: ['marker']
        });

        await loader.load();

        // Create map
        const map = new google.maps.Map(mapRef.current!, {
          zoom: 10,
          center: { lat: 40.7128, lng: -74.0060 }, // Default to NYC
          mapTypeId: 'roadmap',
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        mapInstanceRef.current = map;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        // Create markers for each office
        const bounds = new google.maps.LatLngBounds();
        
        offices.forEach((office) => {
          if (office.latitude && office.longitude) {
            const position = { lat: office.latitude, lng: office.longitude };
            
            const marker = new google.maps.Marker({
              position,
              map,
              title: office.name,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: office.id === selectedOfficeId ? '#3b82f6' : '#64748b',
                fillOpacity: 0.8,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            });

            // Create info window
            const infoContent = `
              <div class="p-2 min-w-[200px]">
                <div class="font-semibold text-sm mb-1">${office.name}</div>
                <div class="text-xs text-gray-600 mb-2">${office.address || 'No address'}</div>
                <div class="flex items-center gap-1 text-xs">
                  <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">${office.source_type}</span>
                  ${showVisitData && visitCounts[office.id] ? 
                    `<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">${visitCounts[office.id]} visits</span>` : 
                    ''
                  }
                </div>
              </div>
            `;

            const infoWindow = new google.maps.InfoWindow({
              content: infoContent
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
              if (onOfficeSelect) {
                onOfficeSelect(office.id);
              }
            });

            // Highlight selected office
            if (office.id === selectedOfficeId) {
              infoWindow.open(map, marker);
            }

            markersRef.current.push(marker);
            bounds.extend(position);
          }
        });

        // Fit map to show all markers
        if (offices.length > 1) {
          map.fitBounds(bounds);
        } else if (offices.length === 1 && offices[0].latitude && offices[0].longitude) {
          map.setCenter({ lat: offices[0].latitude, lng: offices[0].longitude });
          map.setZoom(15);
        }

      } catch (error) {
        console.error('Error loading Google Maps:', error);
      }
    };

    initMap();
  }, [offices, selectedOfficeId, onOfficeSelect, showVisitData, visitCounts]);

  if (isLoading) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (offices.length === 0) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <h3 className="text-lg font-medium mb-1">No offices with locations</h3>
            <p className="text-sm text-muted-foreground">
              Add addresses to your offices to see them on the map
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span className="text-sm font-medium">{offices.length} offices</span>
        </div>
        {showVisitData && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">
              {Object.values(visitCounts).reduce((a, b) => a + b, 0)} total visits
            </span>
          </div>
        )}
      </div>
      
      <Card className="overflow-hidden">
        <div 
          ref={mapRef} 
          style={{ height }}
          className="w-full"
        />
      </Card>
    </div>
  );
}