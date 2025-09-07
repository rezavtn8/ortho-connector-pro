import React, { useState, useEffect, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from '@googlemaps/js-api-loader';

interface Office {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_rating?: number | null;
  google_place_id?: string | null;
  phone?: string | null;
  website?: string | null;
  opening_hours?: string | null;
}

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

interface AddressSearchProps {
  value?: string;
  onSelect: (office: Office | null) => void;
  placeholder?: string;
}

export function AddressSearch({ value, onSelect, placeholder = "Search offices..." }: AddressSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [offices, setOffices] = useState<Office[]>([]);
  const [googlePlaces, setGooglePlaces] = useState<GooglePlaceResult[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  // Initialize Google Maps services
  useEffect(() => {
    let isMounted = true;
    
    const initGoogleMaps = async () => {
      try {
        // Get API key securely from edge function
        const response = await supabase.functions.invoke('get-google-maps-key', {
          method: 'GET'
        });
        if (response.error) {
          console.warn('Could not get Google Maps API key from server:', response.error);
          return;
        }

        const apiKey = response.data?.google_maps_api_key;
        if (!apiKey) {
          console.warn('Google Maps API key not available from server');
          return;
        }

        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places']
        });

        await loader.load();
        
        if (!isMounted) return;
        
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
    
    return () => {
      isMounted = false;
      // Clean up Google Maps services
      geocoder.current = null;
      placesService.current = null;
      setGoogleMapsLoaded(false);
    };
  }, []);

  // Load existing offices from database
  useEffect(() => {
    const loadOffices = async () => {
      const { data, error } = await supabase
        .from('patient_sources')
        .select('id, name, address, latitude, longitude')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setOffices(data);
      }
    };

    loadOffices();
  }, []);

  // Search Google Places when user types
  useEffect(() => {
    if (!searchValue || searchValue.length < 3 || !googleMapsLoaded) {
      setGooglePlaces([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingGoogle(true);
    
    const searchPlaces = async () => {
      const request = {
        input: searchValue,
        types: ['establishment'],
        componentRestrictions: { country: 'us' }
      };

      try {
        // Use AutocompleteService (works despite deprecation warning)
        const autocompleteService = new google.maps.places.AutocompleteService();
        autocompleteService.getPlacePredictions(request, (results, status) => {
          if (!isCurrent) return;
          
          setIsLoadingGoogle(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setGooglePlaces(results.slice(0, 5));
          } else {
            setGooglePlaces([]);
          }
        });
      } catch (error) {
        console.error('Error searching places:', error);
        if (isCurrent) {
          setIsLoadingGoogle(false);
          setGooglePlaces([]);
        }
      }
    };

    const timeoutId = setTimeout(searchPlaces, 300); // Debounce search

    return () => {
      isCurrent = false;
      clearTimeout(timeoutId);
    };
  }, [searchValue, googleMapsLoaded]);

  // Filter existing offices based on search
  const filteredOffices = offices.filter(office => 
    office.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    office.address?.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleGooglePlaceSelect = async (place: GooglePlaceResult) => {
    if (!placesService.current) return;

    try {
      setIsLoadingGoogle(true);
      
      // First get place details to fetch rating and other information
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
      
      const newOffice: Office = {
        id: `google-${place.place_id}`, // Use Google place ID to avoid duplicates
        name: placeDetails.name,
        address: placeDetails.formatted_address,
        latitude: location.lat(),
        longitude: location.lng(),
        google_rating: placeDetails.rating || null,
        google_place_id: place.place_id,
        phone: placeDetails.formatted_phone_number || null,
        website: placeDetails.website || null,
        opening_hours: placeDetails.opening_hours?.weekday_text.join('; ') || null
      };

      console.log('Selected Google Place:', newOffice);
      onSelect(newOffice);
      setSearchValue(newOffice.name);
      setOpen(false);
    } catch (error) {
      console.error('Error fetching Google place details:', error);
      // Fallback to basic geocoding if place details fail
      try {
        const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.current!.geocode({ placeId: place.place_id }, (results, status) => {
            if (status === 'OK' && results) {
              resolve(results);
            } else {
              reject(new Error('Geocoding failed'));
            }
          });
        });

        const result = results[0];
        const location = result.geometry.location;
        
        const newOffice: Office = {
          id: `google-${place.place_id}`,
          name: place.structured_formatting.main_text,
          address: result.formatted_address,
          latitude: location.lat(),
          longitude: location.lng(),
          google_place_id: place.place_id
        };

        onSelect(newOffice);
        setSearchValue(newOffice.name);
        setOpen(false);
      } catch (fallbackError) {
        console.error('Error with fallback geocoding:', fallbackError);
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleOfficeSelect = (office: Office) => {
    onSelect(office);
    setSearchValue(office.name);
    setOpen(false);
  };

  const selectedOffice = offices.find(office => office.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedOffice ? (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {selectedOffice.name}
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
            placeholder="Search offices or addresses..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {filteredOffices.length === 0 && googlePlaces.length === 0 && !isLoadingGoogle && (
              <CommandEmpty>No offices found.</CommandEmpty>
            )}
            
            {filteredOffices.length > 0 && (
              <CommandGroup heading="Registered Offices">
                {filteredOffices.map((office) => (
                  <CommandItem
                    key={office.id}
                    value={office.name}
                    onSelect={() => handleOfficeSelect(office)}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{office.name}</div>
                        {office.address && (
                          <div className="text-sm text-muted-foreground">{office.address}</div>
                        )}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === office.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
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