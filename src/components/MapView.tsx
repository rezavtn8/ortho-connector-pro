import React, { useEffect, useState, useCallback, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Building2, Phone, Users, RefreshCw, Map, Layers, Filter, Clock } from "lucide-react";
import 'mapbox-gl/dist/mapbox-gl.css';

interface Office {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  currentMonthReferrals: number;
  totalReferrals: number;
  strength: 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  category: 'VIP' | 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  lastActiveMonth?: string | null;
}

interface Clinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export function MapView({ height = "600px" }: { height?: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [filteredOffices, setFilteredOffices] = useState<Office[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [mapStyle, setMapStyle] = useState<'light' | 'dark' | 'navigation'>('light');
  const [showConnections, setShowConnections] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(0);

  // Get Mapbox token
  useEffect(() => {
    const getMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data.token);
      } catch (error) {
        console.error('Error getting Mapbox token:', error);
      }
    };
    getMapboxToken();
  }, []);

  // Load clinic and office data with throttling
  const loadData = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefresh < 300000) { // 5 minutes throttle
      console.log('Refresh throttled - please wait 5 minutes between refreshes');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user's clinic
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id, clinic_name, clinic_address, clinic_latitude, clinic_longitude')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile && profile.clinic_latitude && profile.clinic_longitude) {
        setClinic({
          id: profile.clinic_id || 'clinic',
          name: profile.clinic_name || 'My Clinic',
          address: profile.clinic_address || '',
          latitude: profile.clinic_latitude,
          longitude: profile.clinic_longitude
        });
      }

      // Load referring offices with batch queries for better performance
      const { data: sources } = await supabase
        .from('patient_sources')
        .select('id, name, address, phone, latitude, longitude, source_type')
        .eq('is_active', true)
        .eq('source_type', 'Office')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (sources) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const sourceIds = sources.map(s => s.id);
        
        // Batch load monthly data
        const { data: monthlyData } = await supabase
          .from('monthly_patients')
          .select('source_id, year_month, patient_count')
          .in('source_id', sourceIds);

        // Batch load strength scores
        const strengthPromises = sourceIds.map(id =>
          supabase.rpc('calculate_source_score', { source_id_param: id })
        );
        const strengthResults = await Promise.all(strengthPromises);

        // Process offices
        const officesWithData = sources.map((source, index) => {
          const sourceMonthlyData = monthlyData?.filter(m => m.source_id === source.id) || [];
          const currentMonthData = sourceMonthlyData.find(m => m.year_month === currentMonth);
          const currentMonthReferrals = currentMonthData?.patient_count || 0;
          const totalReferrals = sourceMonthlyData.reduce((sum, m) => sum + m.patient_count, 0);
          const strength = strengthResults[index]?.data || 'Cold';

          // Find last active month
          const lastActiveData = sourceMonthlyData
            .filter(m => m.patient_count > 0)
            .sort((a, b) => b.year_month.localeCompare(a.year_month))[0];
          const lastActiveMonth = lastActiveData?.year_month || null;

          // Determine category based on enhanced criteria
          let category: Office['category'];
          if (totalReferrals >= 20 && currentMonthReferrals >= 8) {
            category = 'VIP';
          } else {
            category = strength as Office['category'];
          }

          return {
            ...source,
            currentMonthReferrals,
            totalReferrals,
            strength: strength as Office['strength'],
            category,
            lastActiveMonth
          };
        });
        
        setOffices(officesWithData);
        setLastRefresh(now);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    
    setIsLoading(false);
  }, [lastRefresh]);

  useEffect(() => {
    loadData();
  }, []);

  // Filter offices based on category
  useEffect(() => {
    if (categoryFilter === 'all') {
      setFilteredOffices(offices);
    } else {
      setFilteredOffices(offices.filter(office => office.category === categoryFilter));
    }
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

    console.log('Adding markers and connections - map style loaded:', map.current.isStyleLoaded());

    // Clear existing markers and sources safely
    const markers = document.querySelectorAll('.mapboxgl-marker');
    markers.forEach(marker => marker.remove());

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
    const clinicEl = document.createElement('div');
    clinicEl.innerHTML = `
      <div style="
        background-color: #2563eb;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        border: 4px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        cursor: pointer;
      ">
        <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </div>
    `;

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

    new mapboxgl.Marker(clinicEl)
      .setLngLat([clinic.longitude, clinic.latitude])
      .setPopup(clinicPopup)
      .addTo(map.current);

    // Add office markers
    filteredOffices.forEach((office) => {
      if (!office.latitude || !office.longitude) return;

      const color = getCategoryColor(office.category);
      const size = getCategorySize(office.category);
      const officeEl = document.createElement('div');
      officeEl.innerHTML = `
        <div style="
          background-color: ${color};
          width: ${size.width}px;
          height: ${size.height}px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          position: relative;
          cursor: pointer;
        ">
          <svg width="${size.iconSize}" height="${size.iconSize}" fill="white" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          ${office.currentMonthReferrals > 0 ? `
            <div style="
              position: absolute;
              top: -8px;
              right: -8px;
              background-color: #ef4444;
              color: white;
              border-radius: 50%;
              width: 22px;
              height: 22px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: bold;
              border: 2px solid white;
            ">${office.currentMonthReferrals}</div>
          ` : ''}
        </div>
      `;

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

      // Handle marker click
      officeEl.addEventListener('click', () => {
        setSelectedOffice(office);
      });
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

  const canRefresh = () => {
    const now = Date.now();
    return (now - lastRefresh) >= 300000; // 5 minutes
  };

  const getRefreshCountdown = () => {
    const now = Date.now();
    const timeLeft = 300000 - (now - lastRefresh);
    return Math.ceil(timeLeft / 60000); // minutes
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
              onClick={loadData}
              disabled={isLoading || !canRefresh()}
              title={!canRefresh() ? `Wait ${getRefreshCountdown()} more minutes` : 'Refresh data'}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              {!canRefresh() ? `${getRefreshCountdown()}m` : 'Refresh'}
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