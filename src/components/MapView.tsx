import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card } from "@/components/ui/card";
import { MapPin, RefreshCw } from "lucide-react";
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useMapData } from '@/hooks/useMapData';
import 'mapbox-gl/dist/mapbox-gl.css';

export function MapView({ height = "600px" }: { height?: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  const { token: mapboxToken, isLoading: tokenLoading } = useMapboxToken();
  const { offices, clinic, isLoading: dataLoading } = useMapData();
  
  const isLoading = tokenLoading || dataLoading;

  // Simple marker creation
  const createSimpleMarker = (lng: number, lat: number, color: string, isClinic = false) => {
    const el = document.createElement('div');
    el.style.width = isClinic ? '30px' : '20px';
    el.style.height = isClinic ? '30px' : '20px';
    el.style.backgroundColor = color;
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';
    el.style.cursor = 'pointer';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    
    return new mapboxgl.Marker(el).setLngLat([lng, lat]);
  };

  // Initialize and update map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !clinic) return;

    // Clear existing map
    if (map.current) {
      map.current.remove();
    }

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [clinic.longitude, clinic.latitude],
      zoom: 10
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add markers when map loads
    map.current.on('load', () => {
      // Add clinic marker
      const clinicMarker = createSimpleMarker(
        clinic.longitude,
        clinic.latitude,
        '#2563eb',
        true
      );
      
      clinicMarker
        .setPopup(new mapboxgl.Popup().setHTML(`<div class="p-2"><strong>${clinic.name}</strong><br/>${clinic.address}</div>`))
        .addTo(map.current!);

      // Add office markers
      offices.forEach((office) => {
        if (!office.latitude || !office.longitude) return;

        const color = office.category === 'VIP' ? '#8b5cf6' :
                     office.category === 'Strong' ? '#10b981' :
                     office.category === 'Moderate' ? '#f97316' :
                     office.category === 'Sporadic' ? '#ef4444' : '#9ca3af';

        const officeMarker = createSimpleMarker(
          office.longitude,
          office.latitude,
          color
        );
        
        officeMarker
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <strong>${office.name}</strong><br/>
              ${office.address || ''}<br/>
              <small>Referrals: ${office.currentMonthReferrals} this month</small>
            </div>
          `))
          .addTo(map.current!);
      });

      // Fit map to show all markers
      if (offices.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([clinic.longitude, clinic.latitude]);
        offices.forEach(office => {
          if (office.latitude && office.longitude) {
            bounds.extend([office.longitude, office.latitude]);
          }
        });
        map.current!.fitBounds(bounds, { padding: 50 });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken, clinic, offices]);

  // Show error states
  if (!mapboxToken) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <div>
              <p className="font-medium mb-2">Mapbox Token Required</p>
              <p className="text-sm text-muted-foreground mb-4">
                Please add your Mapbox token to Supabase Edge Function secrets.
              </p>
              <p className="text-xs text-muted-foreground">
                Get your token at <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">mapbox.com</a>
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (!clinic) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium">Please configure your clinic location in Settings</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div 
        ref={mapContainer} 
        style={{ height }}
        className="w-full"
      />
    </Card>
  );
}