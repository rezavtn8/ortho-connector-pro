import React, { useState, useEffect, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from '@googlemaps/js-api-loader';

interface Office {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface GooglePlaceResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
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
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);

  // Initialize Google Maps services
  useEffect(() => {
    const initGoogleMaps = async () => {
      try {
        const loader = new Loader({
          apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
          version: 'weekly',
          libraries: ['places']
        });

        await loader.load();
        autocompleteService.current = new google.maps.places.AutocompleteService();
        geocoder.current = new google.maps.Geocoder();
      } catch (error) {
        console.error('Error loading Google Maps:', error);
      }
    };

    initGoogleMaps();
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
    if (!searchValue || searchValue.length < 3 || !autocompleteService.current) {
      setGooglePlaces([]);
      return;
    }

    setIsLoadingGoogle(true);
    
    const request = {
      input: searchValue,
      types: ['establishment'],
      componentRestrictions: { country: 'us' } // Adjust country as needed
    };

    autocompleteService.current.getPlacePredictions(request, (results, status) => {
      setIsLoadingGoogle(false);
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        setGooglePlaces(results.slice(0, 5)); // Limit to 5 results
      } else {
        setGooglePlaces([]);
      }
    });
  }, [searchValue]);

  // Filter existing offices based on search
  const filteredOffices = offices.filter(office => 
    office.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    office.address?.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleGooglePlaceSelect = async (place: GooglePlaceResult) => {
    if (!geocoder.current) return;

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
        id: 'new-' + Date.now(), // Temporary ID for new places
        name: place.structured_formatting.main_text,
        address: result.formatted_address,
        latitude: location.lat(),
        longitude: location.lng()
      };

      onSelect(newOffice);
      setSearchValue(newOffice.name);
      setOpen(false);
    } catch (error) {
      console.error('Error geocoding place:', error);
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
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium">{place.structured_formatting.main_text}</div>
                        <div className="text-sm text-muted-foreground">
                          {place.structured_formatting.secondary_text}
                        </div>
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