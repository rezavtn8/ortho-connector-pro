import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, RefreshCw, Building2, Users, TrendingUp, Calendar } from "lucide-react";
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useMapData } from '@/hooks/useMapData';
import 'mapbox-gl/dist/mapbox-gl.css';

export function MapView({ height = "600px" }: { height?: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  const { token: mapboxToken, isLoading: tokenLoading } = useMapboxToken();
  const { offices, clinic, isLoading: dataLoading } = useMapData();
  
  const isLoading = tokenLoading || dataLoading;

  // Calculate office statistics
  const officeStats = {
    total: offices.length,
    vip: offices.filter(o => o.category === 'VIP').length,
    strong: offices.filter(o => o.category === 'Strong').length,
    moderate: offices.filter(o => o.category === 'Moderate').length,
    sporadic: offices.filter(o => o.category === 'Sporadic').length,
    cold: offices.filter(o => o.category === 'Cold').length,
    totalReferrals: offices.reduce((sum, o) => sum + o.currentMonthReferrals, 0),
    activeThisMonth: offices.filter(o => o.currentMonthReferrals > 0).length
  };

  const legendItems = [
    { color: '#8b5cf6', label: 'VIP', description: '20+ lifetime, 8+ this month', count: officeStats.vip },
    { color: '#10b981', label: 'Strong', description: '5+ in 3 months, active', count: officeStats.strong },
    { color: '#f97316', label: 'Moderate', description: '2+ in 3 months', count: officeStats.moderate },
    { color: '#ef4444', label: 'Sporadic', description: 'Some history, less active', count: officeStats.sporadic },
    { color: '#9ca3af', label: 'Cold', description: 'No recent activity', count: officeStats.cold },
  ];

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
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{officeStats.total}</p>
              <p className="text-sm text-muted-foreground">Total Offices</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{officeStats.totalReferrals}</p>
              <p className="text-sm text-muted-foreground">This Month</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-2xl font-bold">{officeStats.activeThisMonth}</p>
              <p className="text-sm text-muted-foreground">Active Offices</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-2xl font-bold">{officeStats.vip + officeStats.strong}</p>
              <p className="text-sm text-muted-foreground">Top Performers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Map and Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div 
              ref={mapContainer} 
              style={{ height }}
              className="w-full"
            />
          </Card>
        </div>

        {/* Legend */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Office Categories
            </h3>
            
            <div className="space-y-3">
              {legendItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {item.count}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Map Legend</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span>Your Clinic</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-400 rounded-full border-2 border-white shadow-sm"></div>
                <span>Referring Offices</span>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Click on any marker to view details about the office and referral history.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}