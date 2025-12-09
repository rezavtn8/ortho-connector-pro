import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Plus, TrendingUp } from 'lucide-react';

interface MonthlyDataNoticeProps {
  monthlyTotal: number;
  sourceCount: number;
  onAddClick: () => void;
}

export function MonthlyDataNotice({ monthlyTotal, sourceCount, onAddClick }: MonthlyDataNoticeProps) {
  return (
    <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
      <Database className="h-4 w-4 text-blue-600" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Monthly totals available:
          </span>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200">
              <TrendingUp className="w-3 h-3 mr-1" />
              {monthlyTotal} patients
            </Badge>
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200">
              {sourceCount} sources
            </Badge>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="shrink-0 gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
          onClick={onAddClick}
        >
          <Plus className="w-3.5 h-3.5" />
          Start Daily Tracking
        </Button>
      </AlertDescription>
    </Alert>
  );
}
