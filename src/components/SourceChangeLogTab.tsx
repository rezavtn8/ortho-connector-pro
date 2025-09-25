import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PatientChangeLog, formatYearMonth } from '@/lib/database.types';
import { format } from 'date-fns';

interface SourceChangeLogTabProps {
  changeLog: PatientChangeLog[];
}

export function SourceChangeLogTab({ changeLog }: SourceChangeLogTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {changeLog.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No changes recorded</p>
          ) : (
            changeLog.map((log) => (
              <div key={log.id} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <p className="font-medium">
                    {formatYearMonth(log.year_month)}: {log.old_count} → {log.new_count}
                  </p>
                  {log.reason && (
                    <p className="text-sm text-muted-foreground">{log.reason}</p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {log.changed_at && format(new Date(log.changed_at), 'MMM d, yyyy HH:mm')}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}