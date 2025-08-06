import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Navigation } from 'lucide-react';
import MapWrapper from './MapComponent';
import { ReferringOffice } from '@/lib/database.types';

interface OfficeMapModalProps {
  office: ReferringOffice | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OfficeMapModal({ office, isOpen, onClose }: OfficeMapModalProps) {
  if (!office) return null;

  const officeLocation = {
    lat: office.latitude ? Number(office.latitude) : 40.7128,
    lng: office.longitude ? Number(office.longitude) : -74.0060,
  };

  const markers = [
    {
      position: officeLocation,
      title: office.name,
      info: `
        <div class="p-2">
          <h3 class="font-semibold text-lg">${office.name}</h3>
          <p class="text-sm text-gray-600 mt-1">${office.address}</p>
          ${office.phone ? `<p class="text-sm mt-1">📞 ${office.phone}</p>` : ''}
          ${office.website ? `<p class="text-sm mt-1">🌐 <a href="${office.website}" target="_blank" class="text-blue-600 hover:underline">Website</a></p>` : ''}
        </div>
      `,
    },
  ];

  const openInGoogleMaps = () => {
    const encodedAddress = encodeURIComponent(office.address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  const getDirections = () => {
    const encodedAddress = encodeURIComponent(office.address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{office.name} - Location</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={getDirections}>
                <Navigation className="h-4 w-4 mr-2" />
                Directions
              </Button>
              <Button variant="outline" size="sm" onClick={openInGoogleMaps}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Maps
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Office Details</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium">Address:</p>
                <p className="text-muted-foreground">{office.address}</p>
              </div>
              {office.phone && (
                <div>
                  <p className="font-medium">Phone:</p>
                  <p className="text-muted-foreground">{office.phone}</p>
                </div>
              )}
              {office.office_hours && (
                <div>
                  <p className="font-medium">Hours:</p>
                  <p className="text-muted-foreground">{office.office_hours}</p>
                </div>
              )}
              {office.distance_from_clinic && (
                <div>
                  <p className="font-medium">Distance from Clinic:</p>
                  <p className="text-muted-foreground">{office.distance_from_clinic} miles</p>
                </div>
              )}
            </div>
          </div>
          <MapWrapper
            center={officeLocation}
            zoom={15}
            markers={markers}
            height="400px"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}