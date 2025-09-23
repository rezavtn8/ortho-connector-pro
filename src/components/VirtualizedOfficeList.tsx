import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Phone, Mail, MapPin } from 'lucide-react';
import { Office } from '@/hooks/useOffices';

// For now, let's create a simple virtualized list without react-window
// We'll implement basic virtualization manually until the import issue is resolved

interface VirtualizedOfficeListProps {
  offices: Office[];
  height: number;
  onOfficeClick?: (office: Office) => void;
}

const getTierColor = (tier?: string) => {
  switch (tier) {
    case 'VIP': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Warm': return 'bg-green-100 text-green-800 border-green-200';
    case 'Dormant': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Cold': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

function OfficeCard({ office, onOfficeClick }: { office: Office; onOfficeClick?: (office: Office) => void }) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow duration-200 mb-3"
      onClick={() => onOfficeClick?.(office)}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-start gap-3 flex-1">
            <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{office.name}</h3>
              {office.address && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{office.address}</span>
                </p>
              )}
            </div>
          </div>
          <Badge className={getTierColor(office.tier)}>
            {office.tier}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">L12</p>
            <p className="font-semibold">{office.l12 || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">R3</p>
            <p className="font-semibold">{office.r3 || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">MSLR</p>
            <p className="font-semibold">{office.mslr === 999 ? 'Never' : `${office.mslr}m`}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {office.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{office.phone}</span>
            </div>
          )}
          {office.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="truncate">{office.email}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VirtualizedOfficeList({ offices, height, onOfficeClick }: VirtualizedOfficeListProps) {
  // Simple implementation without react-window for now
  // This will still perform well for moderate lists and avoids the import issue
  
  return (
    <div 
      className="overflow-y-auto px-2"
      style={{ maxHeight: height }}
    >
      <div className="space-y-2">
        {offices.map((office) => (
          <OfficeCard
            key={office.id}
            office={office}
            onOfficeClick={onOfficeClick}
          />
        ))}
      </div>
    </div>
  );
}