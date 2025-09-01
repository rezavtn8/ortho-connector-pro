import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, Phone, Users, ZoomIn, ZoomOut, Navigation, RotateCcw } from "lucide-react";

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
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [mapBounds, setMapBounds] = useState({ minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 });

  // Load clinic and office data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        // Load user's clinic
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('clinic_id, clinic_name, clinic_address, clinic_latitude, clinic_longitude')
          .eq('user_id', (await supabase.auth.getUser()).data?.user?.id)
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

        // Load referring offices with referral data
        const { data: sources } = await supabase
          .from('patient_sources')
          .select(`
            id, name, address, phone, latitude, longitude, source_type
          `)
          .eq('is_active', true)
          .eq('source_type', 'Office')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (sources) {
          // Get referral data for each office
          const officesWithData = await Promise.all(
            sources.map(async (source) => {
              const currentMonth = new Date().toISOString().slice(0, 7);
              
              // Get monthly referral data
              const { data: monthlyData } = await supabase
                .from('monthly_patients')
                .select('year_month, patient_count')
                .eq('source_id', source.id)
                .order('year_month', { ascending: false })
                .limit(12);

              // Calculate current month referrals
              const currentMonthData = monthlyData?.find(m => m.year_month === currentMonth);
              const currentMonthReferrals = currentMonthData?.patient_count || 0;
              
              // Calculate total referrals
              const totalReferrals = monthlyData?.reduce((sum, m) => sum + m.patient_count, 0) || 0;
              
              // Calculate strength
              const { data: strengthData } = await supabase
                .rpc('calculate_source_score', { source_id_param: source.id });
              
              const strength = strengthData || 'Cold';

              return {
                ...source,
                currentMonthReferrals,
                totalReferrals,
                strength: strength as Office['strength']
              };
            })
          );
          
          setOffices(officesWithData);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
      
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Calculate map bounds and positioning
  useEffect(() => {
    if (clinic && offices.length > 0) {
      const allPoints = [
        { lat: clinic.latitude, lng: clinic.longitude },
        ...offices.map(office => ({ lat: office.latitude!, lng: office.longitude! }))
      ];
      
      const lats = allPoints.map(p => p.lat);
      const lngs = allPoints.map(p => p.lng);
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      // Add padding to bounds
      const latPadding = (maxLat - minLat) * 0.3;
      const lngPadding = (maxLng - minLng) * 0.3;
      
      setMapBounds({
        minLat: minLat - latPadding,
        maxLat: maxLat + latPadding,
        minLng: minLng - lngPadding,
        maxLng: maxLng + lngPadding
      });
    }
  }, [clinic, offices]);

  // Helper functions
  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'Strong': return 'bg-green-500 border-green-600';
      case 'Moderate': return 'bg-yellow-500 border-yellow-600';  
      case 'Sporadic': return 'bg-orange-500 border-orange-600';
      default: return 'bg-gray-400 border-gray-500';
    }
  };

  const coordsToScreen = (lat: number, lng: number) => {
    if (!mapBounds.minLat || !mapBounds.maxLat) return { x: 50, y: 50 };
    
    const x = ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * 100;
    const y = ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * 100;
    
    return { 
      x: Math.max(2, Math.min(98, x + panOffset.x)), 
      y: Math.max(2, Math.min(98, y + panOffset.y)) 
    };
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.3, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.3, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  if (isLoading) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading geographic data...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Interactive Map Container */}
      <Card style={{ height }} className="overflow-hidden relative">
        {clinic ? (
          <>
            {/* Map Controls */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={handleZoomIn}
                className="w-8 h-8 p-0"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={handleZoomOut}
                className="w-8 h-8 p-0"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={handleReset}
                className="w-8 h-8 p-0"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Map Header */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-b z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-medium">{clinic.name}</h3>
                    <p className="text-xs text-muted-foreground">{offices.length} Referring Offices</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Zoom: {zoom.toFixed(1)}x
                </div>
              </div>
            </div>

            {/* Map Canvas */}
            <div 
              className="h-full relative overflow-hidden bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50"
              style={{ 
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out'
              }}
            >
              {/* Map Grid */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Street-like Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                <line x1="0%" y1="25%" x2="100%" y2="25%" stroke="#64748b" strokeWidth="1"/>
                <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#64748b" strokeWidth="2"/>
                <line x1="0%" y1="75%" x2="100%" y2="75%" stroke="#64748b" strokeWidth="1"/>
                <line x1="25%" y1="0%" x2="25%" y2="100%" stroke="#64748b" strokeWidth="1"/>
                <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#64748b" strokeWidth="2"/>
                <line x1="75%" y1="0%" x2="75%" y2="100%" stroke="#64748b" strokeWidth="1"/>
              </svg>

              {/* Clinic Location */}
              {(() => {
                const clinicPos = coordsToScreen(clinic.latitude, clinic.longitude);
                return (
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-15"
                    style={{
                      left: `${clinicPos.x}%`,
                      top: `${clinicPos.y}%`
                    }}
                  >
                    <div className="bg-blue-600 text-white p-4 rounded-full shadow-xl border-4 border-white">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full shadow text-xs font-bold whitespace-nowrap">
                      {clinic.name}
                    </div>
                    <div className="absolute inset-0 bg-blue-600 rounded-full animate-ping opacity-20"></div>
                  </div>
                );
              })()}

              {/* Referring Offices */}
              {offices.map((office) => {
                if (!office.latitude || !office.longitude) return null;
                
                const officePos = coordsToScreen(office.latitude, office.longitude);
                const clinicPos = coordsToScreen(clinic.latitude, clinic.longitude);
                
                return (
                  <React.Fragment key={office.id}>
                    {/* Connection Line */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-5">
                      <line
                        x1={`${clinicPos.x}%`}
                        y1={`${clinicPos.y}%`}
                        x2={`${officePos.x}%`}
                        y2={`${officePos.y}%`}
                        stroke={office.currentMonthReferrals > 0 ? '#10b981' : '#d1d5db'}
                        strokeWidth={office.currentMonthReferrals > 0 ? '3' : '1'}
                        strokeDasharray={office.currentMonthReferrals > 0 ? '0' : '4,4'}
                        opacity={office.currentMonthReferrals > 0 ? 0.8 : 0.3}
                      />
                    </svg>

                    {/* Office Marker */}
                    <div
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
                      style={{
                        left: `${officePos.x}%`,
                        top: `${officePos.y}%`
                      }}
                      onClick={() => setSelectedOffice(office)}
                    >
                      <div className={`${getStrengthColor(office.strength)} text-white p-3 rounded-full shadow-lg border-2 group-hover:scale-110 transition-transform`}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      
                      {/* Office Name */}
                      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded shadow text-xs font-medium whitespace-nowrap max-w-32 truncate border">
                        {office.name}
                      </div>
                      
                      {/* Referral Count Badge */}
                      {office.currentMonthReferrals > 0 && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold border-2 border-white animate-pulse">
                          {office.currentMonthReferrals}
                        </div>
                      )}

                      {/* Hover Tooltip */}
                      <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        {office.strength} • {office.totalReferrals} total referrals
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur p-3 rounded-lg shadow-lg border z-10">
              <div className="text-xs font-bold mb-2 text-gray-700">Referral Strength</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-green-500 rounded-full border border-green-600"></div>
                  <span className="font-medium">Strong (5+ recent)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full border border-yellow-600"></div>
                  <span className="font-medium">Moderate (2-4 recent)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-orange-500 rounded-full border border-orange-600"></div>
                  <span className="font-medium">Sporadic (some history)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-gray-400 rounded-full border border-gray-500"></div>
                  <span className="font-medium">Cold (no recent)</span>
                </div>
              </div>
            </div>

          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No clinic location configured</p>
            </div>
          </div>
        )}
      </Card>

      {/* Office Details Panel */}
      {selectedOffice && (
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 ${getStrengthColor(selectedOffice.strength).split(' ')[0]} rounded-full`}></div>
                <h4 className="font-bold text-lg">{selectedOffice.name}</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{selectedOffice.address}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedOffice(null)}
              className="ml-2"
            >
              ×
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-3">
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
                <MapPin className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium">Strength</span>
              </div>
              <p className="text-sm font-bold text-purple-600">{selectedOffice.strength}</p>
            </div>
          </div>
          
          {selectedOffice.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
              <Phone className="h-4 w-4" />
              <span>{selectedOffice.phone}</span>
              <Button size="sm" variant="outline" className="ml-auto">
                <Phone className="h-3 w-3 mr-1" />
                Call
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}