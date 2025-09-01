import React from 'react';
import { MapView as MapComponent } from '@/components/MapView';
import { MapPin } from 'lucide-react';

export function MapView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="w-8 h-8 text-blue-600" />
          Map View
        </h1>
        <p className="text-muted-foreground">
          View your clinic and referring offices
        </p>
      </div>

      {/* Simple Map */}
      <MapComponent height="600px" />
    </div>
  );
}