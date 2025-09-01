import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, Phone, Users } from "lucide-react";

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

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'Strong': return 'bg-green-500';
      case 'Moderate': return 'bg-yellow-500';  
      case 'Sporadic': return 'bg-gray-500';
      default: return 'bg-gray-300';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading map data...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Basic Map Container */}
      <Card style={{ height }} className="overflow-hidden">
        {clinic ? (
          <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-green-50">
            {/* Map Header */}
            <div className="p-4 bg-white border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-medium">{clinic.name}</h3>
                    <p className="text-sm text-muted-foreground">{clinic.address}</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {offices.length} Referring Offices
                </div>
              </div>
            </div>

            {/* Simple Map View */}
            <div className="flex-1 relative p-6">
              {/* Clinic Center */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                <div className="bg-blue-600 text-white p-3 rounded-full shadow-lg">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded shadow text-xs font-medium">
                  Your Clinic
                </div>
              </div>

              {/* Referring Offices Around Clinic */}
              {offices.map((office, index) => {
                // Position offices in a circle around the clinic
                const angle = (index / offices.length) * 2 * Math.PI;
                const radius = 120; // Distance from center
                const x = Math.cos(angle) * radius + 50; // 50% center + offset
                const y = Math.sin(angle) * radius + 50; // 50% center + offset
                
                return (
                  <div
                    key={office.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                    style={{
                      left: `${Math.max(10, Math.min(90, x))}%`,
                      top: `${Math.max(10, Math.min(90, y))}%`
                    }}
                    onClick={() => setSelectedOffice(office)}
                  >
                    <div className={`${getStrengthColor(office.strength)} text-white p-2 rounded-full shadow-md hover:scale-110 transition-transform`}>
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white px-2 py-0.5 rounded shadow text-xs font-medium whitespace-nowrap max-w-32 truncate">
                      {office.name}
                    </div>
                    {office.currentMonthReferrals > 0 && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {office.currentMonthReferrals}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Connection Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {offices.map((office, index) => {
                  const angle = (index / offices.length) * 2 * Math.PI;
                  const radius = 120;
                  const x = Math.cos(angle) * radius + 50;
                  const y = Math.sin(angle) * radius + 50;
                  
                  return (
                    <line
                      key={office.id}
                      x1="50%"
                      y1="50%"
                      x2={`${Math.max(10, Math.min(90, x))}%`}
                      y2={`${Math.max(10, Math.min(90, y))}%`}
                      stroke={office.currentMonthReferrals > 0 ? '#10b981' : '#e5e7eb'}
                      strokeWidth={office.currentMonthReferrals > 0 ? '2' : '1'}
                      strokeDasharray={office.currentMonthReferrals > 0 ? '0' : '5,5'}
                      opacity={0.6}
                    />
                  );
                })}
              </svg>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-white p-3 rounded shadow">
                <div className="text-xs font-medium mb-2">Office Strength</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Strong</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Moderate</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    <span>Sporadic</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                    <span>Cold</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No clinic location set</p>
            </div>
          </div>
        )}
      </Card>

      {/* Office Details */}
      {selectedOffice && (
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-medium">{selectedOffice.name}</h4>
              <p className="text-sm text-muted-foreground">{selectedOffice.address}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedOffice(null)}
            >
              ×
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium">This Month</span>
              </div>
              <p className="text-lg font-bold text-blue-600">{selectedOffice.currentMonthReferrals}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-green-600" />
                <span className="font-medium">Total</span>
              </div>
              <p className="text-lg font-bold text-green-600">{selectedOffice.totalReferrals}</p>
            </div>
          </div>
          
          <div className="mt-3 flex items-center gap-2">
            <div className={`w-3 h-3 ${getStrengthColor(selectedOffice.strength)} rounded-full`}></div>
            <span className="text-sm font-medium">{selectedOffice.strength} Referrer</span>
          </div>
          
          {selectedOffice.phone && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{selectedOffice.phone}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}