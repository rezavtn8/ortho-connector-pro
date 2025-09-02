import React, { useState, useEffect, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from '@/integrations/supabase/client';
import { Loader } from '@googlemaps/js-api-loader';

interface GooglePlaceResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  rating?: number;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: {
    weekday_text: string[];
  };
}

interface SelectedPlace {
  name: string;
  address: string;
  google_place_id: string;
  latitude?: number;
  longitude?: number;
}

interface ClinicAddressSearchProps {
  value?: string;
  onSelect: (place: SelectedPlace | null) => void;
  placeholder?: string;
}

export function ClinicAddressSearch({ value, onSelect, placeholder = "Search for your clinic address..." }: ClinicAddressSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value || "");
  const [googlePlaces, setGooglePlaces] = useState<GooglePlaceResult[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  // Initialize Google Maps services
  useEffect(() => {
    const initGoogleMaps = async () => {
      const response = await supabase.functions.invoke('get-mapbox-token');
      if (response.error) {
        console.warn('Could not get Google Maps API key from server');
        return;
      }

      const apiKey = response.data?.google_maps_api_key;
      if (!apiKey) {
        console.warn('Google Maps API key not available');
        return;
      }

      try {
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places']
        });

        await loader.load();
        geocoder.current = new google.maps.Geocoder();
        
        // Create a dummy map element for PlacesService
        const mapDiv = document.createElement('div');
        const map = new google.maps.Map(mapDiv);
        placesService.current = new google.maps.places.PlacesService(map);
        
        setGoogleMapsLoaded(true);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
      }
    };

    initGoogleMaps();
  }, []);

  // Search Google Places when user types
  useEffect(() => {
    if (!searchValue || searchValue.length < 3 || !googleMapsLoaded || manualEntry) {
      setGooglePlaces([]);
      return;
    }

    setIsLoadingGoogle(true);
    
    const searchPlaces = async () => {
      const request = {
        input: searchValue,
        types: ['establishment'],
        componentRestrictions: { country: 'us' }
      };

      try {
        const autocompleteService = new google.maps.places.AutocompleteService();
        autocompleteService.getPlacePredictions(request, (results, status) => {
          setIsLoadingGoogle(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setGooglePlaces(results.slice(0, 5));
          } else {
            setGooglePlaces([]);
          }
        });
      } catch (error) {
        console.error('Error searching places:', error);
        setIsLoadingGoogle(false);
        setGooglePlaces([]);
      }
    };

    searchPlaces();
  }, [searchValue, googleMapsLoaded, manualEntry]);

  const handleGooglePlaceSelect = async (place: GooglePlaceResult) => {
    if (!placesService.current) return;

    try {
      setIsLoadingGoogle(true);
      
      // Get place details to fetch additional information
      const placeDetails = await new Promise<GooglePlaceDetails>((resolve, reject) => {
        const request = {
          placeId: place.place_id,
          fields: [
            'name', 
            'formatted_address', 
            'geometry', 
            'rating', 
            'formatted_phone_number', 
            'website', 
            'opening_hours'
          ]
        };

        placesService.current!.getDetails(request, (result, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && result) {
            resolve(result as GooglePlaceDetails);
          } else {
            reject(new Error('Place details fetch failed'));
          }
        });
      });

      const location = placeDetails.geometry.location;
      
      const selectedPlace: SelectedPlace = {
        name: placeDetails.name,
        address: placeDetails.formatted_address,
        google_place_id: place.place_id,
        latitude: location.lat(),
        longitude: location.lng()
      };

      onSelect(selectedPlace);
      setSearchValue(placeDetails.formatted_address);
      setOpen(false);
    } catch (error) {
      console.error('Error fetching Google place details:', error);
      // Fallback to basic information
      const selectedPlace: SelectedPlace = {
        name: place.structured_formatting.main_text,
        address: place.description,
        google_place_id: place.place_id
      };

      onSelect(selectedPlace);
      setSearchValue(place.description);
      setOpen(false);
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleManualEntry = () => {
    setManualEntry(true);
    setOpen(false);
  };

  const handleManualSave = () => {
    if (searchValue) {
      onSelect({
        name: searchValue,
        address: searchValue,
        google_place_id: ''
      });
    }
    setManualEntry(false);
  };

  if (manualEntry) {
    return (
      <div className="space-y-2">
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Enter clinic address manually..."
        />
        <div className="flex gap-2">
          <Button onClick={handleManualSave} size="sm">
            Save Address
          </Button>
          <Button onClick={() => setManualEntry(false)} variant="outline" size="sm">
            Use Search
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {searchValue ? (
            <span className="flex items-center gap-2 truncate">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{searchValue}</span>
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput 
            placeholder="Search clinic addresses..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {googlePlaces.length === 0 && !isLoadingGoogle && searchValue.length >= 3 && (
              <CommandEmpty>
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">No places found.</p>
                  <Button 
                    onClick={handleManualEntry} 
                    variant="outline" 
                    size="sm"
                    className="gap-2"
                  >
                    <MapPin className="h-3 w-3" />
                    Enter address manually
                  </Button>
                </div>
              </CommandEmpty>
            )}
            
            {googlePlaces.length > 0 && (
              <CommandGroup heading="Google Places">
                {googlePlaces.map((place) => (
                  <CommandItem
                    key={place.place_id}
                    value={place.description}
                    onSelect={() => handleGooglePlaceSelect(place)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{place.structured_formatting.main_text}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {place.structured_formatting.secondary_text}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-blue-500 text-xs">
                        <Star className="w-3 h-3" />
                        <span>Google</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchValue.length >= 3 && !isLoadingGoogle && (
              <CommandGroup>
                <CommandItem value="manual-entry" onSelect={handleManualEntry}>
                  <div className="flex items-center gap-2 w-full">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Enter address manually</span>
                  </div>
                </CommandItem>
              </CommandGroup>
            )}

            {isLoadingGoogle && (
              <div className="p-2 text-center text-sm text-muted-foreground">
                Searching Google Places...
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}