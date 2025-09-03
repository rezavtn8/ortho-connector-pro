import React, { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useGoogleMapsApi } from '@/hooks/useGoogleMapsApi';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GooglePlaceResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GooglePlaceDetails {
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  place_id: string;
}

interface SelectedPlace {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  place_id?: string;
  google_place_id?: string; // Add this for compatibility
}

interface ClinicAddressSearchProps {
  value?: string;
  onSelect: (place: SelectedPlace) => void;
  placeholder?: string;
}

export function ClinicAddressSearch({ value, onSelect, placeholder = "Search for your clinic address..." }: ClinicAddressSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(value || "");
  const [googlePlaces, setGooglePlaces] = useState<GooglePlaceResult[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  
  const { apiKey, isLoading: isLoadingApi, error: apiError, retry: retryApi } = useGoogleMapsApi();

  // Initialize Google Maps services when API key is available
  useEffect(() => {
    if (!apiKey || googleMapsLoaded) return;

    const initGoogleMaps = async () => {
      try {
        console.log('ClinicAddressSearch: Initializing Google Maps...');
        
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places']
        });

        await loader.load();
        
        // Initialize services
        geocoder.current = new google.maps.Geocoder();
        autocompleteService.current = new google.maps.places.AutocompleteService();
        
        // Create a dummy map element for PlacesService
        const mapDiv = document.createElement('div');
        const map = new google.maps.Map(mapDiv);
        placesService.current = new google.maps.places.PlacesService(map);
        
        setGoogleMapsLoaded(true);
        console.log('ClinicAddressSearch: Google Maps initialized successfully');
        
      } catch (error) {
        console.error('ClinicAddressSearch: Error loading Google Maps:', error);
        setGoogleMapsLoaded(false);
      }
    };

    initGoogleMaps();
  }, [apiKey, googleMapsLoaded]);

  // Search for Google Places
  useEffect(() => {
    if (!searchValue || searchValue.length < 3 || !googleMapsLoaded || !autocompleteService.current) {
      setGooglePlaces([]);
      return;
    }

    const searchPlaces = async () => {
      setIsLoadingPlaces(true);
      try {
        const request = {
          input: searchValue,
          types: ['establishment'],
          componentRestrictions: { country: 'us' }
        };

        autocompleteService.current!.getQueryPredictions(request, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            // Map Google's QueryAutocompletePrediction to our GooglePlaceResult interface
            const mappedResults = results.map(result => ({
              place_id: result.place_id || '',
              description: result.description,
              structured_formatting: {
                main_text: (result as any).structured_formatting?.main_text || result.description.split(',')[0],
                secondary_text: (result as any).structured_formatting?.secondary_text || result.description.split(',').slice(1).join(',').trim()
              }
            }));
            setGooglePlaces(mappedResults.slice(0, 5));
          } else {
            console.warn('ClinicAddressSearch: Places search failed:', status);
            setGooglePlaces([]);
          }
          setIsLoadingPlaces(false);
        });
      } catch (error) {
        console.error('ClinicAddressSearch: Error searching places:', error);
        setGooglePlaces([]);
        setIsLoadingPlaces(false);
      }
    };

    const debounceTimer = setTimeout(searchPlaces, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchValue, googleMapsLoaded]);

  const handleGooglePlaceSelect = async (place: GooglePlaceResult) => {
    if (!placesService.current) {
      console.error('ClinicAddressSearch: PlacesService not initialized');
      return;
    }

    try {
      console.log('ClinicAddressSearch: Fetching place details for:', place.place_id);
      
      const request = {
        placeId: place.place_id,
        fields: ['name', 'formatted_address', 'geometry', 'place_id']
      };

      placesService.current.getDetails(request, (result, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result?.name && result?.formatted_address) {
          const selectedPlace: SelectedPlace = {
            name: result.name,
            address: result.formatted_address,
            latitude: result.geometry?.location.lat() || 0,
            longitude: result.geometry?.location.lng() || 0,
            place_id: result.place_id || place.place_id,
            google_place_id: result.place_id || place.place_id
          };
          
          console.log('ClinicAddressSearch: Selected place:', selectedPlace);
          setSearchValue(selectedPlace.name);
          setOpen(false);
          onSelect(selectedPlace);
        } else {
          console.error('ClinicAddressSearch: Failed to get place details:', status);
          // Fallback to basic information
          const fallbackPlace: SelectedPlace = {
            name: place.structured_formatting.main_text,
            address: place.description,
            latitude: 0,
            longitude: 0,
            place_id: place.place_id,
            google_place_id: place.place_id
          };
          
          setSearchValue(fallbackPlace.name);
          setOpen(false);
          onSelect(fallbackPlace);
        }
      });
    } catch (error) {
      console.error('ClinicAddressSearch: Error getting place details:', error);
    }
  };

  const handleManualEntry = () => {
    setManualEntry(true);
    setOpen(false);
  };

  const handleManualSave = () => {
    if (searchValue.trim()) {
      const manualPlace: SelectedPlace = {
        name: searchValue.trim(),
        address: searchValue.trim(),
        latitude: 0,
        longitude: 0
      };
      
      onSelect(manualPlace);
      setManualEntry(false);
    }
  };

  const handleManualCancel = () => {
    setSearchValue(value || "");
    setManualEntry(false);
  };

  // Manual entry mode
  if (manualEntry) {
    return (
      <div className="space-y-2">
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Enter clinic name and address manually"
          className="w-full"
        />
        <div className="flex gap-2">
          <Button onClick={handleManualSave} size="sm">
            Save
          </Button>
          <Button onClick={handleManualCancel} variant="outline" size="sm">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (apiError) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Google Maps unavailable: {apiError}</span>
            <Button 
              onClick={retryApi} 
              size="sm" 
              variant="outline"
              className="ml-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
        <Button 
          onClick={handleManualEntry} 
          variant="outline" 
          className="w-full"
        >
          Enter Address Manually
        </Button>
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
          className="w-full justify-between text-left font-normal"
          disabled={isLoadingApi}
        >
          {isLoadingApi ? (
            <div className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading Google Maps...
            </div>
          ) : (
            <>
              <span className={searchValue ? "text-foreground" : "text-muted-foreground"}>
                {searchValue || placeholder}
              </span>
              <MapPin className="ml-2 h-4 w-4 shrink-0" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {isLoadingPlaces && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching...
              </div>
            )}
            
            {!isLoadingPlaces && googlePlaces.length === 0 && searchValue && (
              <CommandEmpty>
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    No places found
                  </p>
                  <Button 
                    onClick={handleManualEntry}
                    variant="outline" 
                    size="sm"
                  >
                    Enter Manually
                  </Button>
                </div>
              </CommandEmpty>
            )}

            {googlePlaces.length > 0 && (
              <CommandGroup>
                {googlePlaces.map((place) => (
                  <CommandItem
                    key={place.place_id}
                    onSelect={() => handleGooglePlaceSelect(place)}
                    className="cursor-pointer"
                  >
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {place.structured_formatting.main_text}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {place.structured_formatting.secondary_text}
                      </span>
                    </div>
                  </CommandItem>
                ))}
                <CommandItem onSelect={handleManualEntry} className="cursor-pointer border-t">
                  <div className="flex items-center text-sm text-muted-foreground">
                    Can't find your clinic? Enter manually
                  </div>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}