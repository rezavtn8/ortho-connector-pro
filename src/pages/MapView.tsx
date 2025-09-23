import React from 'react';
import { MapView as MapComponent } from '@/components/MapView';
import { MapPin } from 'lucide-react';

export function MapView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <MapPin className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Map View</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          View your clinic and referring offices on an interactive map
        </p>
      </div>

      {/* Simple Map */}
      <MapComponent height="600px" />
    </div>
  );
}