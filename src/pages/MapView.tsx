import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapView as MapComponent } from '@/components/MapView';

export function MapView() {
  const [searchParams] = useSearchParams();
  
  // Check if we're viewing discovered offices
  const isDiscovered = searchParams.get('discovered') === 'true';
  const idsParam = searchParams.get('ids');
  const officeIds = idsParam ? idsParam.split(',').filter(Boolean) : [];

  return (
    <div className="space-y-6">
      <MapComponent 
        height="600px" 
        mode={isDiscovered ? 'discovered' : 'network'}
        officeIds={officeIds}
      />
    </div>
  );
}
