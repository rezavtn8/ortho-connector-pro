import React from 'react';
import { MapView as MapComponent } from '@/components/MapView';

export function MapView() {
  return (
    <div className="space-y-6">

      {/* Simple Map */}
      <MapComponent height="600px" />
    </div>
  );
}