import React from 'react';
import { Brain, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AIAssistantHeaderProps {
  isLoading: boolean;
  onRefresh: () => void;
  dataContext?: {
    officesCount: number;
    monthlyRecords: number;
    campaignsCount: number;
    visitsCount: number;
    discoveredOfficesCount?: number;
    reviewsCount?: number;
  };
}

export function AIAssistantHeader({ isLoading, onRefresh, dataContext }: AIAssistantHeaderProps) {
  return (
    <div className="space-y-6">
      {/* Title and Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-primary">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Assistant</h1>
            <p className="text-muted-foreground">Intelligent insights for your dental practice</p>
          </div>
        </div>
        
        <Button 
          onClick={onRefresh} 
          disabled={isLoading}
          className="bg-gradient-primary hover:opacity-90 text-white shadow-glow"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
        </Button>
      </div>

      {/* Stats Bar */}
      {dataContext && (
        <div className="flex flex-wrap gap-3 p-4 bg-gradient-card rounded-xl border shadow-card">
          <Badge variant="outline" className="text-sm font-medium border-success/30 bg-success/10 text-success-foreground">
            <span className="font-bold">{dataContext.officesCount}</span> Offices
          </Badge>
          <Badge variant="outline" className="text-sm font-medium border-info/30 bg-info/10 text-info-foreground">
            <span className="font-bold">{dataContext.monthlyRecords}</span> Monthly Records
          </Badge>
          <Badge variant="outline" className="text-sm font-medium border-muted-foreground/30 bg-muted/50 text-muted-foreground">
            <span className="font-bold">{dataContext.campaignsCount}</span> Campaigns
          </Badge>
          <Badge variant="outline" className="text-sm font-medium border-muted-foreground/30 bg-muted/50 text-muted-foreground">
            <span className="font-bold">{dataContext.visitsCount}</span> Visits
          </Badge>
          {dataContext.discoveredOfficesCount && (
            <Badge variant="outline" className="text-sm font-medium border-warning/30 bg-warning/10 text-warning-foreground">
              <span className="font-bold">{dataContext.discoveredOfficesCount}</span> Discovered
            </Badge>
          )}
          {dataContext.reviewsCount && (
            <Badge variant="outline" className="text-sm font-medium border-primary/30 bg-primary/10 text-primary-foreground">
              <span className="font-bold">{dataContext.reviewsCount}</span> Reviews
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}