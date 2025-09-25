import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthlyPatients, formatYearMonth } from '@/lib/database.types';
import { PatientCountEditor } from '@/components/PatientCountEditor';

interface PatientCountsTabProps {
  monthlyData: MonthlyPatients[];
  patientCounts: any;
}

export function PatientCountsTab({ monthlyData, patientCounts }: PatientCountsTabProps) {
  const { getLast12Months, getMonthlyCount } = patientCounts;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Patient Counts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getLast12Months().map((month: string) => {
            const count = getMonthlyCount(month, monthlyData);
            return (
              <div key={month} className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">
                  {formatYearMonth(month)}
                </div>
                <div className="text-2xl font-bold">{count}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}