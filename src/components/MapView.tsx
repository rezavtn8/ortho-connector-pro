import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, RefreshCw, Building2, Users, TrendingUp, Calendar, Star, Globe, Phone } from "lucide-react";
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useMapData } from '@/hooks/useMapData';
import { useDiscoveredMapData } from '@/hooks/useDiscoveredMapData';
import { useIsMobile } from '@/hooks/use-mobile';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapViewProps {
  height?: string;
  mode?: 'network' | 'discovered';
  officeIds?: string[];
}

export function MapView({ height = "600px", mode = 'network', officeIds = [] }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const isMobile = useIsMobile();
  
  const { token: mapboxToken, isLoading: tokenLoading } = useMapboxToken();
  
  // Use the appropriate data hook based on mode
  const networkData = useMapData();
  const discoveredData = useDiscoveredMapData(mode === 'discovered' ? officeIds : []);
  
  const isDiscoveredMode = mode === 'discovered';
  const { offices: networkOffices, clinic: networkClinic, isLoading: networkLoading } = networkData;
  const { offices: discoveredOffices, clinic: discoveredClinic, isLoading: discoveredLoading } = discoveredData;
  
  const clinic = isDiscoveredMode ? discoveredClinic : networkClinic;
  const isLoading = tokenLoading || (isDiscoveredMode ? discoveredLoading : networkLoading);

  // Calculate stats based on mode
  const networkStats = {
    total: networkOffices.length,
    vip: networkOffices.filter(o => o.category === 'VIP').length,
    strong: networkOffices.filter(o => o.category === 'Strong').length,
    moderate: networkOffices.filter(o => o.category === 'Moderate').length,
    sporadic: networkOffices.filter(o => o.category === 'Sporadic').length,
    cold: networkOffices.filter(o => o.category === 'Cold').length,
    totalReferrals: networkOffices.reduce((sum, o) => sum + o.currentMonthReferrals, 0),
    activeThisMonth: networkOffices.filter(o => o.currentMonthReferrals > 0).length
  };

  const discoveredStats = {
    total: discoveredOffices.length,
    excellent: discoveredOffices.filter(o => o.ratingCategory === 'Excellent').length,
    good: discoveredOffices.filter(o => o.ratingCategory === 'Good').length,
    average: discoveredOffices.filter(o => o.ratingCategory === 'Average').length,
    low: discoveredOffices.filter(o => o.ratingCategory === 'Low').length,
    withWebsite: discoveredOffices.filter(o => o.website).length,
    avgRating: discoveredOffices.length > 0 
      ? (discoveredOffices.reduce((sum, o) => sum + (o.google_rating || 0), 0) / discoveredOffices.length).toFixed(1)
      : '0'
  };

  const networkLegend = [
    { color: '#8b5cf6', label: 'VIP', description: '20+ lifetime, 8+ this month', count: networkStats.vip },
    { color: '#10b981', label: 'Strong', description: '5+ in 3 months, active', count: networkStats.strong },
    { color: '#f97316', label: 'Moderate', description: '2+ in 3 months', count: networkStats.moderate },
    { color: '#ef4444', label: 'Sporadic', description: 'Some history, less active', count: networkStats.sporadic },
    { color: '#9ca3af', label: 'Cold', description: 'No recent activity', count: networkStats.cold },
  ];

  const discoveredLegend = [
    { color: '#10b981', label: 'Excellent', description: '4.5+ stars', count: discoveredStats.excellent },
    { color: '#f97316', label: 'Good', description: '4.0 - 4.4 stars', count: discoveredStats.good },
    { color: '#eab308', label: 'Average', description: '3.5 - 3.9 stars', count: discoveredStats.average },
    { color: '#9ca3af', label: 'Low', description: 'Below 3.5 stars', count: discoveredStats.low },
  ];

  const legendItems = isDiscoveredMode ? discoveredLegend : networkLegend;

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

  // Get color for discovered office based on rating
  const getDiscoveredOfficeColor = (ratingCategory: string) => {
    switch (ratingCategory) {
      case 'Excellent': return '#10b981';
      case 'Good': return '#f97316';
      case 'Average': return '#eab308';
      default: return '#9ca3af';
    }
  };

  // Get color for network office based on category
  const getNetworkOfficeColor = (category: string) => {
    switch (category) {
      case 'VIP': return '#8b5cf6';
      case 'Strong': return '#10b981';
      case 'Moderate': return '#f97316';
      case 'Sporadic': return '#ef4444';
      default: return '#9ca3af';
    }
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

      if (isDiscoveredMode) {
        // Add discovered office markers
        discoveredOffices.forEach((office) => {
          if (!office.latitude || !office.longitude) return;

          const color = getDiscoveredOfficeColor(office.ratingCategory);

          const officeMarker = createSimpleMarker(
            office.longitude,
            office.latitude,
            color
          );
          
          const ratingDisplay = office.google_rating ? `⭐ ${office.google_rating}` : 'No rating';
          const distanceDisplay = office.distance_miles ? `${office.distance_miles.toFixed(1)} mi` : '';
          
          officeMarker
            .setPopup(new mapboxgl.Popup().setHTML(`
              <div class="p-2">
                <strong>${office.name}</strong><br/>
                ${office.office_type ? `<small class="text-gray-600">${office.office_type}</small><br/>` : ''}
                ${office.address || ''}<br/>
                <div class="mt-1 flex items-center gap-2 text-sm">
                  <span>${ratingDisplay}</span>
                  ${distanceDisplay ? `<span>• ${distanceDisplay}</span>` : ''}
                </div>
                ${office.phone ? `<div class="mt-1 text-sm">📞 ${office.phone}</div>` : ''}
                ${office.website ? `<div class="mt-1"><a href="${office.website}" target="_blank" class="text-blue-600 text-sm hover:underline">Visit Website</a></div>` : ''}
              </div>
            `))
            .addTo(map.current!);
        });

        // Fit bounds for discovered offices
        if (discoveredOffices.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([clinic.longitude, clinic.latitude]);
          discoveredOffices.forEach(office => {
            if (office.latitude && office.longitude) {
              bounds.extend([office.longitude, office.latitude]);
            }
          });
          map.current!.fitBounds(bounds, { padding: 50 });
        }
      } else {
        // Add network office markers
        networkOffices.forEach((office) => {
          if (!office.latitude || !office.longitude) return;

          const color = getNetworkOfficeColor(office.category);

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

        // Fit bounds for network offices
        if (networkOffices.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([clinic.longitude, clinic.latitude]);
          networkOffices.forEach(office => {
            if (office.latitude && office.longitude) {
              bounds.extend([office.longitude, office.latitude]);
            }
          });
          map.current!.fitBounds(bounds, { padding: 50 });
        }
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken, clinic, networkOffices, discoveredOffices, isDiscoveredMode]);

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
      {/* Mode indicator for discovered offices */}
      {isDiscoveredMode && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
            Discovered Offices
          </Badge>
          <span>Viewing {discoveredOffices.length} selected office{discoveredOffices.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isDiscoveredMode ? (
          <>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{discoveredStats.total}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Selected Offices</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{discoveredStats.avgRating}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Avg Rating</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{discoveredStats.excellent}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Highly Rated</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{discoveredStats.withWebsite}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">With Website</p>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{networkStats.total}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Offices</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{networkStats.totalReferrals}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">This Month</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{networkStats.activeThisMonth}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Active Offices</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 sm:p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{networkStats.vip + networkStats.strong}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Top Performers</p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Map and Legend Layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Map */}
        <div className="lg:col-span-3 order-1">
          <Card className="overflow-hidden">
            <div 
              ref={mapContainer} 
              style={{ height: isMobile ? '400px' : height }}
              className="w-full"
            />
          </Card>
        </div>

        {/* Legend */}
        <div className="space-y-4 order-0 lg:order-2">
          <Card className="p-3 sm:p-4">
            <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {isDiscoveredMode ? 'Rating Categories' : 'Office Categories'}
            </h3>
            
            <div className="space-y-2 sm:space-y-3">
              {legendItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div 
                      className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <p className="font-medium text-xs sm:text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">{item.description}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {item.count}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3 sm:p-4">
            <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Map Legend</h3>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full"></div>
                </div>
                <span>Your Clinic</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-400 rounded-full border-2 border-white shadow-sm"></div>
                <span>{isDiscoveredMode ? 'Discovered Offices' : 'Referring Offices'}</span>
              </div>
            </div>
            
            <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                {isDiscoveredMode 
                  ? 'Click on any marker to view office details, rating, and contact info.'
                  : 'Click on any marker to view details about the office and referral history.'}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
