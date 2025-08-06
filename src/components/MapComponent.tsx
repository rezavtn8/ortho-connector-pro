import React, { useEffect, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';

declare global {
  interface Window {
    google: typeof google;
  }
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyAEsFlHg3ZutfqT7c07TSnJ0y3WiKs0qLw';

interface MapProps {
  center: google.maps.LatLngLiteral;
  zoom: number;
  markers?: Array<{
    position: google.maps.LatLngLiteral;
    title: string;
    info?: string;
  }>;
  height?: string;
  className?: string;
}

function Map({ center, zoom, markers = [], height = '400px', className = '' }: MapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map>();

  useEffect(() => {
    if (ref.current && !map) {
      const newMap = new window.google.maps.Map(ref.current, {
        center,
        zoom,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });
      setMap(newMap);
    }
  }, [ref, map, center, zoom]);

  useEffect(() => {
    if (map && markers.length > 0) {
      // Clear existing markers
      markers.forEach(({ position, title, info }) => {
        const marker = new google.maps.Marker({
          position,
          map,
          title,
        });

        if (info) {
          const infoWindow = new google.maps.InfoWindow({
            content: info,
          });

          marker.addListener('click', () => {
            infoWindow.open({
              anchor: marker,
              map,
            });
          });
        }
      });

      // Adjust map bounds to fit all markers
      if (markers.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(({ position }) => bounds.extend(position));
        map.fitBounds(bounds);
      }
    }
  }, [map, markers]);

  return <div ref={ref} style={{ height }} className={`w-full rounded-lg ${className}`} />;
}

function MapWrapper(props: MapProps) {
  const render = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return (
          <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        );
      case Status.FAILURE:
        return (
          <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm text-destructive">Failed to load map</p>
            </div>
          </div>
        );
      case Status.SUCCESS:
        return <Map {...props} />;
    }
  };

  return (
    <Wrapper apiKey={GOOGLE_MAPS_API_KEY} render={render} />
  );
}

export default MapWrapper;