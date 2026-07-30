/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

 
declare namespace google {
  namespace maps {
    class Geocoder {
      geocode(
        request: { placeId?: string; address?: string },
        callback: (results: GeocoderResult[] | null, status: string) => void
      ): void;
    }

    interface GeocoderResult {
      formatted_address: string;
      geometry: {
        location: LatLng;
      };
      place_id: string;
    }

    class LatLng {
      lat(): number;
      lng(): number;
    }

    class Map {
      constructor(el: HTMLElement, opts?: any);
    }

    namespace places {
      class AutocompleteService {
        getPlacePredictions(
          request: any,
          callback: (results: any[] | null, status: string) => void
        ): void;
        getQueryPredictions(
          request: any,
          callback: (results: any[] | null, status: string) => void
        ): void;
      }

      class PlacesService {
        constructor(attrContainer: HTMLElement | Map);
        getDetails(
          request: any,
          callback: (result: any | null, status: string) => void
        ): void;
        textSearch(
          request: any,
          callback: (results: any[] | null, status: string) => void
        ): void;
      }

      const PlacesServiceStatus: {
        OK: string;
        ZERO_RESULTS: string;
        ERROR: string;
      };
    }
  }
}

interface Window {
  google: typeof google;
}
