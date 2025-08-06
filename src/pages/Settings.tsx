import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Save, Crosshair, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MapWrapper from '@/components/MapComponent';

interface ClinicSettings {
  clinic_name: string;
  clinic_address: string;
  clinic_latitude: number | null;
  clinic_longitude: number | null;
}

export function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>({
    clinic_name: '',
    clinic_address: '',
    clinic_latitude: null,
    clinic_longitude: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (user) {
      loadClinicSettings();
    }
  }, [user]);

  const loadClinicSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('clinic_name, clinic_address, clinic_latitude, clinic_longitude')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setClinicSettings({
          clinic_name: data.clinic_name || '',
          clinic_address: data.clinic_address || '',
          clinic_latitude: data.clinic_latitude ? Number(data.clinic_latitude) : null,
          clinic_longitude: data.clinic_longitude ? Number(data.clinic_longitude) : null,
        });
      }
    } catch (error) {
      console.error('Error loading clinic settings:', error);
      toast({
        title: "Error loading settings",
        description: "Could not load your clinic settings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocation = () => {
    setIsLocating(true);
    
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Please enter coordinates manually.",
        variant: "destructive",
      });
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setClinicSettings(prev => ({
          ...prev,
          clinic_latitude: position.coords.latitude,
          clinic_longitude: position.coords.longitude,
        }));
        setIsLocating(false);
        toast({
          title: "Location detected",
          description: "Your current location has been set.",
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
        toast({
          title: "Location access denied",
          description: "Please enter coordinates manually or check location permissions.",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  const geocodeAddress = async (address: string) => {
    // In production, this would use Google Geocoding API
    // For demo purposes, we'll simulate with common addresses
    const addressLower = address.toLowerCase();
    
    if (addressLower.includes('new york') || addressLower.includes('nyc') || addressLower.includes('manhattan')) {
      return { lat: 40.7128, lng: -74.0060 };
    } else if (addressLower.includes('brooklyn')) {
      return { lat: 40.6782, lng: -73.9442 };
    } else if (addressLower.includes('queens')) {
      return { lat: 40.7282, lng: -73.7949 };
    } else if (addressLower.includes('bronx')) {
      return { lat: 40.8448, lng: -73.8648 };
    } else if (addressLower.includes('staten island')) {
      return { lat: 40.5795, lng: -74.1502 };
    } else {
      // Default to NYC center
      return { lat: 40.7128, lng: -74.0060 };
    }
  };

  const handleAddressGeocoding = async () => {
    if (!clinicSettings.clinic_address.trim()) {
      toast({
        title: "Address required",
        description: "Please enter an address to geocode.",
        variant: "destructive",
      });
      return;
    }

    try {
      const coordinates = await geocodeAddress(clinicSettings.clinic_address);
      setClinicSettings(prev => ({
        ...prev,
        clinic_latitude: coordinates.lat,
        clinic_longitude: coordinates.lng,
      }));
      
      toast({
        title: "Address geocoded",
        description: "Coordinates have been set based on your address.",
      });
    } catch (error) {
      toast({
        title: "Geocoding failed",
        description: "Could not find coordinates for this address.",
        variant: "destructive",
      });
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          clinic_name: clinicSettings.clinic_name,
          clinic_address: clinicSettings.clinic_address,
          clinic_latitude: clinicSettings.clinic_latitude,
          clinic_longitude: clinicSettings.clinic_longitude,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your clinic settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error saving settings",
        description: "Could not save your clinic settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasLocation = clinicSettings.clinic_latitude && clinicSettings.clinic_longitude;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Clinic Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Clinic Information */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinic_name">Clinic Name</Label>
                <Input
                  id="clinic_name"
                  value={clinicSettings.clinic_name}
                  onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_name: e.target.value }))}
                  placeholder="Enter your clinic name..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clinic_address">Clinic Address</Label>
                <Input
                  id="clinic_address"
                  value={clinicSettings.clinic_address}
                  onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_address: e.target.value }))}
                  placeholder="Enter your clinic address..."
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddressGeocoding}
                  disabled={!clinicSettings.clinic_address.trim()}
                >
                  Get Coordinates from Address
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={clinicSettings.clinic_latitude || ''}
                    onChange={(e) => setClinicSettings(prev => ({ 
                      ...prev, 
                      clinic_latitude: e.target.value ? Number(e.target.value) : null 
                    }))}
                    placeholder="40.7128"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={clinicSettings.clinic_longitude || ''}
                    onChange={(e) => setClinicSettings(prev => ({ 
                      ...prev, 
                      clinic_longitude: e.target.value ? Number(e.target.value) : null 
                    }))}
                    placeholder="-74.0060"
                  />
                </div>
              </div>

              <Button
                onClick={getCurrentLocation}
                disabled={isLocating}
                variant="outline"
                className="w-full gap-2"
              >
                <Crosshair className="h-4 w-4" />
                {isLocating ? 'Detecting Location...' : 'Use Current Location'}
              </Button>

              <div className="flex items-center gap-2">
                {hasLocation ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Location coordinates set</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-yellow-600">No location set - required for map features</span>
                  </>
                )}
              </div>
            </div>

            {/* Map Preview */}
            <div className="space-y-2">
              <Label>Location Preview</Label>
              <div className="h-64 rounded-lg overflow-hidden border">
                {hasLocation ? (
                  <MapWrapper
                    center={{
                      lat: clinicSettings.clinic_latitude!,
                      lng: clinicSettings.clinic_longitude!,
                    }}
                    zoom={15}
                    markers={[{
                      position: {
                        lat: clinicSettings.clinic_latitude!,
                        lng: clinicSettings.clinic_longitude!,
                      },
                      title: clinicSettings.clinic_name || 'Your Clinic',
                      info: `
                        <div class="p-3">
                          <h3 class="font-semibold text-primary">${clinicSettings.clinic_name || 'Your Clinic'}</h3>
                          <p class="text-sm text-muted-foreground mt-1">${clinicSettings.clinic_address || 'Clinic location'}</p>
                        </div>
                      `
                    }]}
                    height="100%"
                  />
                ) : (
                  <div className="h-full bg-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Set coordinates to preview location</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={saveSettings} 
              disabled={isSaving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}