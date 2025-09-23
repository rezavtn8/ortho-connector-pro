import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Phone, Mail, MapPin } from 'lucide-react';
import { Office } from '@/hooks/useOffices';

interface VirtualizedOfficeListProps {
  offices: Office[];
  height: number;
  onOfficeClick?: (office: Office) => void;
}

const ITEM_HEIGHT = 120;

interface OfficeItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    offices: Office[];
    onOfficeClick?: (office: Office) => void;
  };
}

function OfficeItem({ index, style, data }: OfficeItemProps) {
  const office = data.offices[index];
  const { onOfficeClick } = data;

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'VIP': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Warm': return 'bg-green-100 text-green-800 border-green-200';
      case 'Dormant': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Cold': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div style={style} className="px-2">
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow duration-200 mx-2 my-1"
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
    </div>
  );
}

export function VirtualizedOfficeList({ offices, height, onOfficeClick }: VirtualizedOfficeListProps) {
  // Only use virtualization for lists with more than 50 items
  if (offices.length <= 50) {
    return (
      <div className="space-y-2">
        {offices.map((office) => (
          <OfficeItem
            key={office.id}
            index={offices.indexOf(office)}
            style={{ height: ITEM_HEIGHT }}
            data={{ offices, onOfficeClick }}
          />
        ))}
      </div>
    );
  }

  return (
    <List
      height={height}
      itemCount={offices.length}
      itemSize={ITEM_HEIGHT}
      itemData={{ offices, onOfficeClick }}
    >
      {OfficeItem}
    </List>
  );
}