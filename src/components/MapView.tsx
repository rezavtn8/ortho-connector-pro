import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, RefreshCw, Building2, Users, TrendingUp, Calendar, Star, Globe, Phone, ExternalLink, Compass, FolderOpen } from "lucide-react";
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useMapData } from '@/hooks/useMapData';
import { useDiscoveredMapData } from '@/hooks/useDiscoveredMapData';
import { useDiscoveredGroups } from '@/hooks/useDiscoveredGroups';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapViewProps {
  height?: string;
  initialShowDiscovered?: boolean;
  initialGroupId?: string;
}

export function MapView({ height = "600px", initialShowDiscovered = false, initialGroupId }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [showDiscovered, setShowDiscovered] = useState(initialShowDiscovered);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const map = useRef<mapboxgl.Map | null>(null);
  const isMobile = useIsMobile();
  
  const { token: mapboxToken, isLoading: tokenLoading } = useMapboxToken();
  const { groups, getGroupMemberIds } = useDiscoveredGroups();
  
  // Always load network data
  const networkData = useMapData();
  // Load discovered offices - filter by group if selected
  const discoveredData = useDiscoveredMapData(
    selectedGroupId ? groupMemberIds : [],
    showDiscovered && !selectedGroupId
  );
  
  const { offices: networkOffices, clinic, isLoading: networkLoading } = networkData;
  const { offices: discoveredOffices, isLoading: discoveredLoading } = discoveredData;
  
  const isLoading = tokenLoading || networkLoading || (showDiscovered && discoveredLoading);

  // Load group member IDs when group is selected
  useEffect(() => {
    if (selectedGroupId) {
      getGroupMemberIds(selectedGroupId).then(ids => setGroupMemberIds(ids));
    } else {
      setGroupMemberIds([]);
    }
  }, [selectedGroupId]);

  // Calculate stats
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
  };

  const networkLegend = [
    { color: '#8b5cf6', label: 'VIP', description: '20+ lifetime, 8+ this month', count: networkStats.vip },
    { color: '#10b981', label: 'Strong', description: '5+ in 3 months, active', count: networkStats.strong },
    { color: '#f97316', label: 'Moderate', description: '2+ in 3 months', count: networkStats.moderate },
    { color: '#ef4444', label: 'Sporadic', description: 'Some history, less active', count: networkStats.sporadic },
    { color: '#9ca3af', label: 'Cold', description: 'No recent activity', count: networkStats.cold },
  ];

  const discoveredLegend = [
    { color: '#10b981', label: 'Excellent', description: '4.5+ stars', count: discoveredStats.excellent, isDashed: true },
    { color: '#f97316', label: 'Good', description: '4.0 - 4.4 stars', count: discoveredStats.good, isDashed: true },
    { color: '#eab308', label: 'Average', description: '3.5 - 3.9 stars', count: discoveredStats.average, isDashed: true },
    { color: '#9ca3af', label: 'Low', description: 'Below 3.5 stars', count: discoveredStats.low, isDashed: true },
  ];

  // Create marker for network offices (solid)
  const createNetworkMarker = (lng: number, lat: number, color: string) => {
    const el = document.createElement('div');
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.backgroundColor = color;
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';
    el.style.cursor = 'pointer';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    
    return new mapboxgl.Marker(el).setLngLat([lng, lat]);
  };

  // Create marker for discovered offices (dashed border, different shape)
  const createDiscoveredMarker = (lng: number, lat: number, color: string) => {
    const el = document.createElement('div');
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.backgroundColor = color + '40'; // Semi-transparent fill
    el.style.borderRadius = '50%';
    el.style.border = `3px dashed ${color}`;
    el.style.cursor = 'pointer';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    
    return new mapboxgl.Marker(el).setLngLat([lng, lat]);
  };

  // Create clinic marker
  const createClinicMarker = (lng: number, lat: number) => {
    const el = document.createElement('div');
    el.style.width = '30px';
    el.style.height = '30px';
    el.style.backgroundColor = '#2563eb';
    el.style.borderRadius = '50%';
    el.style.border = '3px solid white';
    el.style.cursor = 'pointer';
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    
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

    // Clear existing map safely
    if (map.current) {
      try {
        map.current.remove();
      } catch (e) {
        // Ignore cleanup errors
      }
      map.current = null;
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
      const clinicMarker = createClinicMarker(clinic.longitude, clinic.latitude);
      
      clinicMarker
        .setPopup(new mapboxgl.Popup().setHTML(`<div class="p-2"><strong>${clinic.name}</strong><br/>${clinic.address}</div>`))
        .addTo(map.current!);

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([clinic.longitude, clinic.latitude]);

      // Add network office markers (solid circles)
      networkOffices.forEach((office) => {
        if (!office.latitude || !office.longitude) return;

        const color = getNetworkOfficeColor(office.category);
        const officeMarker = createNetworkMarker(office.longitude, office.latitude, color);
        
        officeMarker
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <strong>${office.name}</strong><br/>
              <span class="text-xs px-1 py-0.5 rounded" style="background: ${color}20; color: ${color}">${office.category}</span><br/>
              ${office.address || ''}<br/>
              <small>Referrals: ${office.currentMonthReferrals} this month</small>
            </div>
          `))
          .addTo(map.current!);
        
        bounds.extend([office.longitude, office.latitude]);
      });

      // Add discovered office markers if toggle is on (dashed circles)
      if (showDiscovered) {
        discoveredOffices.forEach((office) => {
          if (!office.latitude || !office.longitude) return;

          const color = getDiscoveredOfficeColor(office.ratingCategory);
          const officeMarker = createDiscoveredMarker(office.longitude, office.latitude, color);
          
          const ratingDisplay = office.google_rating ? `⭐ ${office.google_rating}` : 'No rating';
          const distanceDisplay = office.distance_miles ? `${office.distance_miles.toFixed(1)} mi` : '';
          
          officeMarker
            .setPopup(new mapboxgl.Popup().setHTML(`
              <div class="p-2">
                <div class="flex items-center gap-1 mb-1">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">Discovered</span>
                </div>
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
          
          bounds.extend([office.longitude, office.latitude]);
        });
      }

      // Fit bounds to show all markers
      if (networkOffices.length > 0 || (showDiscovered && discoveredOffices.length > 0)) {
        map.current!.fitBounds(bounds, { padding: 50 });
      }
    });

    return () => {
      if (map.current) {
        try {
          map.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        map.current = null;
      }
    };
  }, [mapboxToken, clinic, networkOffices, discoveredOffices, showDiscovered]);

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
      {/* Toggle for discovered offices */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Switch 
            id="show-discovered"
            checked={showDiscovered} 
            onCheckedChange={(val) => { setShowDiscovered(val); if (!val) setSelectedGroupId(null); }} 
          />
          <Label htmlFor="show-discovered" className="flex items-center gap-2 cursor-pointer">
            <Compass className="h-4 w-4 text-teal-600" />
            Show Discovered Offices
          </Label>
          {showDiscovered && (
            <Select value={selectedGroupId || 'all'} onValueChange={(val) => setSelectedGroupId(val === 'all' ? null : val)}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All discovered" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Discovered</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="h-3 w-3" />
                      {g.name} ({g.member_count || 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showDiscovered && discoveredOffices.length > 0 && (
            <Badge variant="secondary" className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
              {discoveredOffices.length} discovered
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{networkStats.total} network offices</Badge>
        </div>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            <div>
              <p className="text-lg sm:text-2xl font-bold">{networkStats.total}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Network Offices</p>
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
        
        {showDiscovered ? (
          <Card className="p-3 sm:p-4 border-teal-200 dark:border-teal-800">
            <div className="flex items-center space-x-2">
              <Compass className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{discoveredStats.total}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Discovered</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-3 sm:p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{networkStats.vip + networkStats.strong}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Top Performers</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Map and Legend */}
      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="lg:col-span-3 order-1">
          <Card className="overflow-hidden">
            <div 
              ref={mapContainer} 
              style={{ height: isMobile ? '400px' : height }}
              className="w-full"
            />
          </Card>
        </div>

        <div className="space-y-4 order-0 lg:order-2">
          {/* Network Offices Legend */}
          <Card className="p-3 sm:p-4">
            <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Network Offices
            </h3>
            
            <div className="space-y-2 sm:space-y-3">
              {networkLegend.map((item) => (
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

          {/* Discovered Offices Legend - only show when toggle is on */}
          {showDiscovered && (
            <Card className="p-3 sm:p-4 border-teal-200 dark:border-teal-800">
              <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                <Compass className="h-4 w-4 text-teal-600" />
                Discovered Offices
              </h3>
              
              <div className="space-y-2 sm:space-y-3">
                {discoveredLegend.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div 
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded-full"
                        style={{ 
                          backgroundColor: item.color + '40',
                          border: `2px dashed ${item.color}`
                        }}
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
              
              <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                Dashed markers indicate discovered offices not yet in your network.
              </p>
            </Card>
          )}

          {/* Map Legend */}
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
                <span>Network Office (solid)</span>
              </div>
              {showDiscovered && (
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded-full"
                    style={{ 
                      backgroundColor: '#9ca3af40',
                      border: '2px dashed #9ca3af'
                    }}
                  ></div>
                  <span>Discovered Office (dashed)</span>
                </div>
              )}
            </div>
            
            <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Click on any marker to view details.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
