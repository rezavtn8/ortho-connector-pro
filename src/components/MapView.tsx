import React, { useEffect, useState, useRef, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Building2, Phone, Users, RefreshCw, Map, Layers, Filter, Clock } from "lucide-react";
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useMapData, Office, Clinic } from '@/hooks/useMapData';
import { createOfficeMarker, createClinicMarker } from '@/components/map/MapMarker';
import 'mapbox-gl/dist/mapbox-gl.css';


export function MapView({ height = "600px" }: { height?: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  const { token: mapboxToken, isLoading: tokenLoading, error: tokenError } = useMapboxToken();
  const { offices, clinic, isLoading: dataLoading, error: dataError, refetch } = useMapData();
  
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [mapStyle, setMapStyle] = useState<'light' | 'dark' | 'navigation'>('light');
  const [showConnections, setShowConnections] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const isLoading = tokenLoading || dataLoading;

  // Filter offices based on category
  const filteredOffices = useMemo(() => {
    if (categoryFilter === 'all') {
      return offices;
    }
    return offices.filter(office => office.category === categoryFilter);
  }, [offices, categoryFilter]);

  // Helper functions
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'VIP': return '#8b5cf6'; // purple-500
      case 'Strong': return '#10b981'; // green-500
      case 'Moderate': return '#f97316'; // orange-500  
      case 'Sporadic': return '#ef4444'; // red-500
      default: return '#9ca3af'; // gray-400
    }
  };

  const getCategorySize = (category: string) => {
    switch (category) {
      case 'VIP': return { width: 48, height: 48, iconSize: 24 };
      case 'Strong': return { width: 48, height: 48, iconSize: 24 };
      case 'Moderate': return { width: 36, height: 36, iconSize: 18 };
      case 'Sporadic': return { width: 28, height: 28, iconSize: 14 };
      default: return { width: 28, height: 28, iconSize: 14 };
    }
  };

  const getMapboxStyle = () => {
    switch (mapStyle) {
      case 'dark':
        return 'mapbox://styles/mapbox/dark-v11';
      case 'navigation':
        return 'mapbox://styles/mapbox/navigation-day-v1';
      default:
        return 'mapbox://styles/mapbox/light-v11';
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !clinic) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapboxStyle(),
      center: [clinic.longitude, clinic.latitude],
      zoom: 10
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add markers once map loads
    map.current.on('load', () => {
      addMarkersAndConnections();
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken, clinic]);

  // Update map style when changed
  useEffect(() => {
    if (map.current) {
      map.current.setStyle(getMapboxStyle());
      // Remove existing styledata listeners to prevent duplicates
      map.current.off('styledata', addMarkersAndConnections);
      map.current.on('styledata', () => {
        if (map.current?.isStyleLoaded()) {
          addMarkersAndConnections();
        }
      });
    }
  }, [mapStyle]);

  // Update connections when toggled - only if style is loaded
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      addMarkersAndConnections();
    }
  }, [showConnections, filteredOffices]);

  const addMarkersAndConnections = () => {
    if (!map.current || !clinic) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Safely check and remove existing connections source
    try {
      if (map.current.isStyleLoaded() && map.current.getSource('connections')) {
        map.current.removeLayer('connections');
        map.current.removeSource('connections');
      }
    } catch (error) {
      console.warn('Error removing existing connections source:', error);
    }

    // Add clinic marker
    const clinicEl = createClinicMarker();
    const clinicPopup = new mapboxgl.Popup({ offset: 25 })
      .setHTML(`
        <div class="p-3">
          <div class="flex items-center gap-2 mb-2">
            <svg class="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span class="font-semibold">${clinic.name}</span>
          </div>
          <p class="text-sm text-gray-600">${clinic.address}</p>
          <div class="mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Your Clinic</div>
        </div>
      `);

    const clinicMarker = new mapboxgl.Marker(clinicEl)
      .setLngLat([clinic.longitude, clinic.latitude])
      .setPopup(clinicPopup)
      .addTo(map.current);
    
    markersRef.current.push(clinicMarker);

    // Add office markers
    filteredOffices.forEach((office) => {
      if (!office.latitude || !office.longitude) return;

      const color = getCategoryColor(office.category);
      const officeEl = createOfficeMarker(office, () => setSelectedOffice(office));
      
      const officePopup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div class="p-3 min-w-[250px]">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-4 h-4 rounded-full" style="background-color: ${color}"></div>
              <span class="font-semibold">${office.name}</span>
            </div>
            <p class="text-sm text-gray-600 mb-3">${office.address || ''}</p>
            
            <div class="grid grid-cols-2 gap-3 mb-3">
              <div class="text-center">
                <p class="text-xs text-gray-500">This Month</p>
                <p class="font-bold text-blue-600">${office.currentMonthReferrals}</p>
              </div>
              <div class="text-center">
                <p class="text-xs text-gray-500">Total Lifetime</p>
                <p class="font-bold text-green-600">${office.totalReferrals}</p>
              </div>
            </div>
            
            <div class="flex items-center justify-between mb-2">
              <span class="px-2 py-1 text-xs border rounded font-medium" style="border-color: ${color}; color: ${color}">
                ${office.category}
              </span>
              ${office.phone ? `<span class="text-xs text-gray-500">${office.phone}</span>` : ''}
            </div>
            
            ${office.lastActiveMonth ? `
              <div class="flex items-center gap-1 text-xs text-gray-500">
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                Last active: ${office.lastActiveMonth}
              </div>
            ` : ''}
          </div>
        `);

      const marker = new mapboxgl.Marker(officeEl)
        .setLngLat([office.longitude, office.latitude])
        .setPopup(officePopup)
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });

    // Add connection lines for filtered offices
    if (showConnections) {
      const connections = filteredOffices
        .filter(office => office.latitude && office.longitude && office.currentMonthReferrals > 0)
        .map(office => ({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [clinic.longitude, clinic.latitude],
              [office.longitude!, office.latitude!]
            ]
          },
          properties: {
            category: office.category,
            count: office.currentMonthReferrals
          }
        }));

      if (connections.length > 0) {
        map.current!.addSource('connections', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: connections
          }
        });

        map.current!.addLayer({
          id: 'connections',
          type: 'line',
          source: 'connections',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'category'], 'VIP'], '#8b5cf6',
              ['==', ['get', 'category'], 'Strong'], '#10b981',
              ['==', ['get', 'category'], 'Moderate'], '#f97316',
              ['==', ['get', 'category'], 'Sporadic'], '#ef4444',
              '#9ca3af'
            ],
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              1, 2,
              10, 8
            ],
            'line-opacity': 0.7
          }
        });
      }
    }

    // Fit bounds to show all markers
    if (filteredOffices.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([clinic.longitude, clinic.latitude]);
      filteredOffices.forEach(office => {
        if (office.latitude && office.longitude) {
          bounds.extend([office.longitude, office.latitude]);
        }
      });
      map.current!.fitBounds(bounds, { padding: 50 });
    }
  };


  // Show a message that the Mapbox token needs to be configured
  if (!mapboxToken) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <div>
              <p className="font-medium mb-2">Mapbox Token Required</p>
              <p className="text-sm text-muted-foreground mb-4">
                A Mapbox public token is needed to display the map. Please add your token to the Supabase Edge Function secrets.
              </p>
              <p className="text-xs text-muted-foreground">
                Get your token from: <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mapbox.com</a>
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!clinic && !isLoading) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No clinic location configured</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map Controls Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Map className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold">{clinic?.name || 'Map View'}</h3>
                <p className="text-sm text-muted-foreground">
                  {filteredOffices.length} of {offices.length} referring offices
                </p>
              </div>
            </div>
            
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="VIP">🟣 VIP</SelectItem>
                  <SelectItem value="Strong">🟢 Strong</SelectItem>
                  <SelectItem value="Moderate">🟠 Moderate</SelectItem>
                  <SelectItem value="Sporadic">🔴 Sporadic</SelectItem>
                  <SelectItem value="Cold">⚪ Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Map Style Selector */}
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1">
                {[
                  { key: 'light', label: 'Light' },
                  { key: 'dark', label: 'Dark' },
                  { key: 'navigation', label: 'Navigation' }
                ].map((style) => (
                  <Button
                    key={style.key}
                    size="sm"
                    variant={mapStyle === style.key ? 'default' : 'outline'}
                    onClick={() => setMapStyle(style.key as typeof mapStyle)}
                    className="text-xs px-2 py-1 h-7"
                  >
                    {style.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowConnections(!showConnections)}
              className={showConnections ? 'bg-primary/10' : ''}
            >
              <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              Connections
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={refetch}
              disabled={isLoading}
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Interactive Map */}
      <Card style={{ height }} className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Loading map data...</p>
            </div>
          </div>
        ) : !mapboxToken ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Map unavailable - Mapbox token not configured</p>
            </div>
          </div>
        ) : clinic ? (
          <div ref={mapContainer} className="w-full h-full" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No clinic location configured</p>
            </div>
          </div>
        )}
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold mb-2">Office Category Legend</h4>
            <div className="flex flex-wrap gap-4">
              {[
                { category: 'VIP', icon: '🟣', description: '20+ total, 8+ this month', color: '#8b5cf6' },
                { category: 'Strong', icon: '🟢', description: '5+ recent referrals', color: '#10b981' },
                { category: 'Moderate', icon: '🟠', description: '2-4 recent referrals', color: '#f97316' },
                { category: 'Sporadic', icon: '🔴', description: 'Some referral history', color: '#ef4444' },
                { category: 'Cold', icon: '⚪', description: 'No recent referrals', color: '#9ca3af' }
              ].map(({ category, icon, description, color }) => (
                <div key={category} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: color }}
                  />
                  <div>
                    <span className="font-medium text-sm">{icon} {category}</span>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium">Active Offices</p>
            <p className="text-2xl font-bold text-primary">{filteredOffices.length}</p>
          </div>
        </div>
      </Card>

      {/* Selected Office Details */}
      {selectedOffice && (
        <Card className="p-4 border-l-4" style={{ borderLeftColor: getCategoryColor(selectedOffice.category) }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getCategoryColor(selectedOffice.category) }}
                />
                <h4 className="font-bold text-lg">{selectedOffice.name}</h4>
                <Badge 
                  variant="outline" 
                  style={{ 
                    borderColor: getCategoryColor(selectedOffice.category),
                    color: getCategoryColor(selectedOffice.category)
                  }}
                >
                  {selectedOffice.category}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{selectedOffice.address}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedOffice(null)}
            >
              ×
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium">This Month</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{selectedOffice.currentMonthReferrals}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium">Total Lifetime</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{selectedOffice.totalReferrals}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-medium">Last Active</span>
              </div>
              <p className="text-sm font-medium text-orange-600">
                {selectedOffice.lastActiveMonth || 'Never'}
              </p>
            </div>
          </div>
          
          {selectedOffice.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
              <Phone className="h-4 w-4" />
              <span>{selectedOffice.phone}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}