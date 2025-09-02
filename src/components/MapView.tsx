import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Phone, Users, RefreshCw, Map, Layers } from "lucide-react";
import 'leaflet/dist/leaflet.css';

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
}

interface Clinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export function MapView({ height = "600px" }: { height?: string }) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'terrain'>('street');
  const [showConnections, setShowConnections] = useState(true);

  // Load clinic and office data
  const loadData = useCallback(async () => {
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

          return {
            ...source,
            currentMonthReferrals,
            totalReferrals,
            strength: strength as Office['strength']
          };
        });
        
        setOffices(officesWithData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper functions
  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'Strong': return '#10b981'; // green-500
      case 'Moderate': return '#eab308'; // yellow-500  
      case 'Sporadic': return '#f97316'; // orange-500
      default: return '#9ca3af'; // gray-400
    }
  };

  const getTileLayer = () => {
    switch (mapStyle) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  const createCustomIcon = (strength: string, count: number) => {
    const color = getStrengthColor(strength);
    return divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
        ">
          <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          ${count > 0 ? `
            <div style="
              position: absolute;
              top: -8px;
              right: -8px;
              background-color: #ef4444;
              color: white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: bold;
              border: 2px solid white;
            ">${count}</div>
          ` : ''}
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });
  };

  const createClinicIcon = () => {
    return divIcon({
      html: `
        <div style="
          background-color: #2563eb;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 4px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          animation: pulse 2s infinite;
        ">
          <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 40]
    });
  };

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

  const center: [number, number] = clinic 
    ? [clinic.latitude, clinic.longitude] 
    : [39.8283, -98.5795]; // Center of US as fallback
  
  const bounds = clinic && offices.length > 0 
    ? [
        [clinic.latitude, clinic.longitude] as [number, number],
        ...offices.map(office => [office.latitude!, office.longitude!] as [number, number])
      ] as [number, number][]
    : undefined;

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
                  {offices.length} referring offices
                </p>
              </div>
            </div>
            
            {/* Map Style Selector */}
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1">
                {['street', 'satellite', 'terrain'].map((style) => (
                  <Button
                    key={style}
                    size="sm"
                    variant={mapStyle === style ? 'default' : 'outline'}
                    onClick={() => setMapStyle(style as typeof mapStyle)}
                    className="capitalize text-xs px-2 py-1 h-7"
                  >
                    {style}
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
              disabled={isLoading}
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
        ) : clinic ? (
          <MapContainer
            center={center}
            zoom={10}
            bounds={bounds}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              url={getTileLayer()}
              attribution={
                mapStyle === 'street' 
                  ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  : '&copy; <a href="https://www.esri.com/">Esri</a>'
              }
            />
            
            {/* Clinic Marker */}
            <Marker 
              position={[clinic.latitude, clinic.longitude]} 
              icon={createClinicIcon()}
            >
              <Popup>
                <div className="p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{clinic.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{clinic.address}</p>
                  <Badge variant="secondary" className="mt-2">Your Clinic</Badge>
                </div>
              </Popup>
            </Marker>

            {/* Office Markers */}
            {offices.map((office) => {
              if (!office.latitude || !office.longitude) return null;
              
              return (
                <Marker
                  key={office.id}
                  position={[office.latitude, office.longitude]}
                  icon={createCustomIcon(office.strength, office.currentMonthReferrals)}
                  eventHandlers={{
                    click: () => setSelectedOffice(office)
                  }}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: getStrengthColor(office.strength) }}
                        />
                        <span className="font-semibold">{office.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{office.address}</p>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">This Month</p>
                          <p className="font-bold text-primary">{office.currentMonthReferrals}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="font-bold text-green-600">{office.totalReferrals}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant="outline" 
                          style={{ 
                            borderColor: getStrengthColor(office.strength),
                            color: getStrengthColor(office.strength)
                          }}
                        >
                          {office.strength}
                        </Badge>
                        {office.phone && (
                          <span className="text-xs text-muted-foreground">{office.phone}</span>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Connection Lines */}
            {showConnections && offices.map((office) => {
              if (!office.latitude || !office.longitude || office.currentMonthReferrals === 0) return null;
              
              return (
                <Polyline
                  key={`connection-${office.id}`}
                  positions={[
                    [clinic.latitude, clinic.longitude],
                    [office.latitude, office.longitude]
                  ]}
                  color={getStrengthColor(office.strength)}
                  weight={Math.max(2, Math.min(6, office.currentMonthReferrals))}
                  opacity={0.6}
                  dashArray={office.strength === 'Cold' ? '10, 10' : undefined}
                />
              );
            })}
          </MapContainer>
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
            <h4 className="font-semibold mb-2">Referral Strength Legend</h4>
            <div className="flex flex-wrap gap-4">
              {[
                { strength: 'Strong', description: '5+ recent referrals' },
                { strength: 'Moderate', description: '2-4 recent referrals' },
                { strength: 'Sporadic', description: 'Some referral history' },
                { strength: 'Cold', description: 'No recent referrals' }
              ].map(({ strength, description }) => (
                <div key={strength} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: getStrengthColor(strength) }}
                  />
                  <div>
                    <span className="font-medium text-sm">{strength}</span>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium">Total Active Offices</p>
            <p className="text-2xl font-bold text-primary">{offices.length}</p>
          </div>
        </div>
      </Card>

      {/* Selected Office Details */}
      {selectedOffice && (
        <Card className="p-4 border-l-4" style={{ borderLeftColor: getStrengthColor(selectedOffice.strength) }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: getStrengthColor(selectedOffice.strength) }}
                />
                <h4 className="font-bold text-lg">{selectedOffice.name}</h4>
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
                <span className="text-xs font-medium">Total</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{selectedOffice.totalReferrals}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <MapPin className="h-4 w-4" style={{ color: getStrengthColor(selectedOffice.strength) }} />
                <span className="text-xs font-medium">Status</span>
              </div>
              <Badge 
                variant="outline" 
                style={{ 
                  borderColor: getStrengthColor(selectedOffice.strength),
                  color: getStrengthColor(selectedOffice.strength)
                }}
              >
                {selectedOffice.strength}
              </Badge>
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