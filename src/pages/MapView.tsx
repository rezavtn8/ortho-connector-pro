import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapView as MapComponent } from '@/components/MapView';

export function MapView() {
  const [searchParams] = useSearchParams();
  
  // Check if we should show discovered offices toggle enabled by default
  const showDiscoveredParam = searchParams.get('showDiscovered') === 'true' || 
                               searchParams.get('discovered') === 'true';

  return (
    <div className="space-y-6">
      <MapComponent 
        height="600px" 
        initialShowDiscovered={showDiscoveredParam}
      />
    </div>
  );
}
