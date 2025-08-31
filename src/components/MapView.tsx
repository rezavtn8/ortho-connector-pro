import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Users, Calendar, Filter, X, Gift, UserPlus, Star, Phone, Mail, Globe, MessageSquare, TrendingUp, Building2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Office {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source_type: string;
  notes?: string | null;
  currentMonthReferrals: number;
  totalReferrals: number;
  lastReferralDate?: string | null;
  strength: 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  monthlyData: { month: string; count: number }[];
  treatmentTypes: string[];
}

interface Clinic {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface FilterState {
  strength: string[];
  treatmentTypes: string[];
  lastReferralDays: number;
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
  height = "600px",
  showVisitData = false 
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredOffice, setHoveredOffice] = useState<Office | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [filters, setFilters] = useState<FilterState>({
    strength: ['Strong', 'Moderate', 'Sporadic', 'Cold'],
    treatmentTypes: [],
    lastReferralDays: 90
  });

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
            id, name, address, phone, email, website, latitude, longitude, 
            source_type, notes, is_active
          `)
          .eq('is_active', true)
          .eq('source_type', 'Office')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (sources) {
          // Get current month referrals and calculate strength for each office
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
              
              // Get last referral date
              const lastReferralData = monthlyData?.find(m => m.patient_count > 0);
              const lastReferralDate = lastReferralData?.year_month;

              // Calculate strength using database function
              const { data: strengthData } = await supabase
                .rpc('calculate_source_score', { source_id_param: source.id });
              
              const strength = strengthData || 'Cold';

              // Format monthly data for chart
              const chartData = (monthlyData || [])
                .slice(0, 6)
                .reverse()
                .map(m => ({
                  month: new Date(m.year_month + '-01').toLocaleDateString('en-US', { month: 'short' }),
                  count: m.patient_count
                }));

              return {
                ...source,
                currentMonthReferrals,
                totalReferrals,
                lastReferralDate,
                strength: strength as Office['strength'],
                monthlyData: chartData,
                treatmentTypes: ['Root Canal', 'Surgery', 'Orthodontics'] // Placeholder
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

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapRef.current || isLoading) return;

    const initMap = async () => {
      try {
        // Get Mapbox token from Supabase secrets
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error || !data?.token) {
          console.error('Error getting Mapbox token:', error);
          // Fallback to a default token or show error
          return;
        }

        mapboxgl.accessToken = data.token;

        const map = new mapboxgl.Map({
          container: mapRef.current!,
          style: 'mapbox://styles/mapbox/light-v11',
          center: clinic ? [clinic.longitude, clinic.latitude] : [-74.0060, 40.7128],
          zoom: clinic ? 12 : 9,
          pitch: 0,
          bearing: 0
        });

        mapInstanceRef.current = map;

        map.on('load', () => {
          // Add clinic marker if available
          if (clinic) {
            const clinicEl = document.createElement('div');
            clinicEl.className = 'clinic-marker';
            clinicEl.innerHTML = `
              <div class="clinic-pin">
                <div class="clinic-icon">🏥</div>
                <div class="clinic-pulse"></div>
              </div>
            `;
            
            new mapboxgl.Marker(clinicEl)
              .setLngLat([clinic.longitude, clinic.latitude])
              .setPopup(new mapboxgl.Popup({ offset: 25 })
                .setHTML(`
                  <div class="p-3">
                    <div class="font-semibold text-primary">${clinic.name}</div>
                    <div class="text-sm text-muted-foreground">${clinic.address}</div>
                    <div class="text-xs text-blue-600 mt-1">Your Clinic</div>
                  </div>
                `))
              .addTo(map);
          }

          // Add office markers
          addOfficeMarkers(map);
        });

        // Handle mouse move for tooltip positioning
        map.on('mousemove', (e) => {
          const rect = mapRef.current!.getBoundingClientRect();
          setMousePosition({ x: e.point.x + rect.left, y: e.point.y + rect.top });
        });

      } catch (error) {
        console.error('Error initializing Mapbox:', error);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [clinic, isLoading]);

  // Add office markers to map
  const addOfficeMarkers = (map: mapboxgl.Map) => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const filteredOffices = getFilteredOffices();

    filteredOffices.forEach((office) => {
      if (office.latitude && office.longitude) {
        const markerEl = createMarkerElement(office);
        
        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([office.longitude, office.latitude])
          .addTo(map);

        // Add hover events
        markerEl.addEventListener('mouseenter', () => setHoveredOffice(office));
        markerEl.addEventListener('mouseleave', () => setHoveredOffice(null));
        
        // Add click event
        markerEl.addEventListener('click', () => {
          setSelectedOffice(office);
          if (onOfficeSelect) onOfficeSelect(office.id);
        });

        markersRef.current.push(marker);
      }
    });
  };

  // Create marker element with dynamic styling
  const createMarkerElement = (office: Office) => {
    const el = document.createElement('div');
    
    // Pin size based on referrals - make it more prominent for high patient load
    const baseSize = 24;
    const maxSize = 48;
    const size = Math.max(baseSize, Math.min(maxSize, baseSize + (office.currentMonthReferrals * 3)));
    
    // Border color based on strength
    const strengthColors = {
      Strong: '#10b981', // green
      Moderate: '#f59e0b', // yellow
      Sporadic: '#6b7280', // grey
      Cold: '#94a3b8' // light grey
    };
    
    // Check if there was a referral in past 30 days
    const hasRecentReferral = office.lastReferralDate && 
      new Date(office.lastReferralDate + '-01') > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Show patient count instead of treatment icon for better visibility
    const displayText = office.currentMonthReferrals > 0 ? office.currentMonthReferrals.toString() : '0';

    el.className = 'office-marker';
    el.innerHTML = `
      <div class="office-pin ${hasRecentReferral ? 'pulse' : ''}" style="
        width: ${size}px; 
        height: ${size}px; 
        border-color: ${strengthColors[office.strength]};
        background: white;
        border: 3px solid ${strengthColors[office.strength]};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: relative;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: all 0.2s ease;
        font-weight: bold;
        font-size: ${Math.min(size * 0.35, 14)}px;
        color: ${strengthColors[office.strength]};
      ">
        ${displayText}
        ${hasRecentReferral ? `
          <div class="ping-animation" style="
            position: absolute;
            top: -3px;
            left: -3px;
            right: -3px;
            bottom: -3px;
            border: 2px solid ${strengthColors[office.strength]};
            border-radius: 50%;
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
        ` : ''}
      </div>
    `;

    // Add hover effects
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.1)';
    });
    
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)';
    });

    return el;
  };

  // Filter offices based on current filter state
  const getFilteredOffices = () => {
    return offices.filter(office => {
      // Filter by strength
      if (!filters.strength.includes(office.strength)) return false;
      
      // Filter by last referral date
      if (office.lastReferralDate) {
        const lastReferral = new Date(office.lastReferralDate + '-01');
        const daysSince = (Date.now() - lastReferral.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > filters.lastReferralDays) return false;
      } else if (filters.lastReferralDays < 365) {
        return false; // No referrals ever, but filter requires recent referrals
      }
      
      // Filter by treatment types (if any selected)
      if (filters.treatmentTypes.length > 0) {
        const hasMatchingTreatment = filters.treatmentTypes.some(type => 
          office.treatmentTypes.includes(type)
        );
        if (!hasMatchingTreatment) return false;
      }
      
      return true;
    });
  };

  // Update markers when filters change
  useEffect(() => {
    if (mapInstanceRef.current) {
      addOfficeMarkers(mapInstanceRef.current);
    }
  }, [filters, offices]);

  const formatLastReferralDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

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

  return (
    <div className="relative space-y-4">
      {/* Map Container */}
      <div className="relative">
        <div 
          ref={mapRef} 
          style={{ height }}
          className="w-full rounded-lg border shadow-sm"
        />

        {/* Floating Filter Panel */}
        <div className="absolute top-4 left-4 z-10">
          <Card className={`transition-all duration-200 ${showFilters ? 'w-80' : 'w-auto'}`}>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                {showFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {showFilters && (
                <>
                  <Separator className="my-3" />
                  
                  <div className="space-y-4">
                    {/* Strength Filter */}
                    <div>
                      <Label className="text-sm font-medium">Referral Strength</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {['Strong', 'Moderate', 'Sporadic', 'Cold'].map((strength) => (
                          <div key={strength} className="flex items-center space-x-2">
                            <Switch
                              checked={filters.strength.includes(strength)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFilters(prev => ({
                                    ...prev,
                                    strength: [...prev.strength, strength]
                                  }));
                                } else {
                                  setFilters(prev => ({
                                    ...prev,
                                    strength: prev.strength.filter(s => s !== strength)
                                  }));
                                }
                              }}
                            />
                            <Label className="text-sm">{strength}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Last Referral Filter */}
                    <div>
                      <Label className="text-sm font-medium">Last Referral</Label>
                      <Select 
                        value={filters.lastReferralDays.toString()}
                        onValueChange={(value) => setFilters(prev => ({
                          ...prev,
                          lastReferralDays: parseInt(value)
                        }))}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">Last 30 days</SelectItem>
                          <SelectItem value="60">Last 60 days</SelectItem>
                          <SelectItem value="90">Last 90 days</SelectItem>
                          <SelectItem value="180">Last 6 months</SelectItem>
                          <SelectItem value="365">Last year</SelectItem>
                          <SelectItem value="9999">All time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Map Stats */}
        <div className="absolute top-4 right-4 z-10">
          <Card className="p-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span>{clinic?.name || 'Clinic'}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{getFilteredOffices().length} offices</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredOffice && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: mousePosition.x + 10,
            top: mousePosition.y - 10
          }}
        >
          <Card className="p-3 shadow-lg border bg-background">
            <div className="space-y-1">
              <div className="font-medium">{hoveredOffice.name}</div>
              <div className="text-sm text-muted-foreground">
                {hoveredOffice.currentMonthReferrals} referrals this month
              </div>
              <div className="text-xs text-muted-foreground">
                Last: {formatLastReferralDate(hoveredOffice.lastReferralDate)}
              </div>
              <Badge 
                variant={hoveredOffice.strength === 'Strong' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {hoveredOffice.strength}
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {/* Office Detail Panel */}
      {selectedOffice && (
        <div className="fixed right-0 top-0 h-full w-96 z-40 bg-background border-l shadow-lg">
          <ScrollArea className="h-full">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedOffice.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedOffice.address}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOffice(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-6">
                {selectedOffice.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOffice.phone}</span>
                  </div>
                )}
                {selectedOffice.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOffice.email}</span>
                  </div>
                )}
                {selectedOffice.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOffice.website}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="p-3">
                  <div className="text-2xl font-bold text-primary">
                    {selectedOffice.currentMonthReferrals}
                  </div>
                  <div className="text-sm text-muted-foreground">This Month</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold">
                    {selectedOffice.totalReferrals}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </Card>
              </div>

              {/* Strength Badge */}
              <div className="mb-6">
                <Badge 
                  variant={selectedOffice.strength === 'Strong' ? 'default' : 'secondary'}
                  className="mb-2"
                >
                  {selectedOffice.strength} Referrer
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Last referral: {formatLastReferralDate(selectedOffice.lastReferralDate)}
                </p>
              </div>

              {/* Monthly Trend Chart */}
              <Card className="p-4 mb-6">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  6-Month Trend
                </h4>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={selectedOffice.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Notes */}
              {selectedOffice.notes && (
                <Card className="p-4 mb-6">
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedOffice.notes}</p>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button className="w-full" variant="default">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Log Entry
                </Button>
                <Button className="w-full" variant="outline">
                  <Gift className="h-4 w-4 mr-2" />
                  Send Gift
                </Button>
                <Button className="w-full" variant="outline">
                  <Star className="h-4 w-4 mr-2" />
                  Mark as VIP
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* CSS Styles - Add keyframes animation to global CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes ping {
            75%, 100% {
              transform: scale(2);
              opacity: 0;
            }
          }
          
          .clinic-pin {
            position: relative;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-foreground)));
            border: 4px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          
          .clinic-icon {
            font-size: 24px;
          }
          
          .clinic-pulse {
            position: absolute;
            top: -4px;
            left: -4px;
            right: -4px;
            bottom: -4px;
            border: 3px solid hsl(var(--primary));
            border-radius: 50%;
            animation: ping 3s cubic-bezier(0, 0, 0.2, 1) infinite;
            opacity: 0.3;
          }
        `
      }} />
    </div>
  );
}