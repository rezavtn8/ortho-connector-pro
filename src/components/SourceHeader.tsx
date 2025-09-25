import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PatientSource, SOURCE_TYPE_CONFIG } from '@/lib/database.types';
import { ArrowLeft } from 'lucide-react';
import { subMonths } from 'date-fns';

interface SourceHeaderProps {
  source: PatientSource;
  marketingVisits: any[];
  onBack: () => void;
}

export function SourceHeader({ source, marketingVisits, onBack }: SourceHeaderProps) {
  const config = SOURCE_TYPE_CONFIG[source.source_type];

  const getLastVisitDate = () => {
    if (marketingVisits.length === 0) return null;
    const lastVisit = marketingVisits.find(visit => visit.visited);
    return lastVisit ? new Date(lastVisit.visit_date) : null;
  };

  const isOfficeNotVisitedRecently = () => {
    if (source?.source_type !== 'Office') return false;
    const lastVisitDate = getLastVisitDate();
    if (!lastVisitDate) return true;
    const threeMonthsAgo = subMonths(new Date(), 3);
    return lastVisitDate < threeMonthsAgo;
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl -z-10"></div>
      <div className="p-8 rounded-2xl border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="hover:bg-primary/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sources
          </Button>
          <Badge 
            variant={source.is_active ? "default" : "secondary"}
            className="text-sm font-medium"
          >
            {source.is_active ? '🟢 Active' : '⭕ Inactive'}
          </Badge>
        </div>
        
        <div className="flex items-start gap-6">
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border">
            <span className="text-3xl">{config.icon}</span>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">{source.name}</h1>
              {isOfficeNotVisitedRecently() && (
                <Badge variant="destructive" className="text-sm animate-pulse">
                  ⚠️ Visit Overdue
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="outline" className="text-sm">
                {config.label}
              </Badge>
            </div>
            
            {source.address && (
              <p className="text-muted-foreground mb-2">{source.address}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}