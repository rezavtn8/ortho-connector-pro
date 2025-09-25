import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate, useParams } from 'react-router-dom';

import { useSourceDetail } from '@/hooks/useSourceDetail';
import { usePatientCounts } from '@/hooks/usePatientCounts';
import { useSourceTags } from '@/hooks/useSourceTags';
import { SourceHeader } from '@/components/SourceHeader';
import { SourceInfoCard } from '@/components/SourceInfoCard';
import { SourceEditDialog } from '@/components/SourceEditDialog';
import { PatientCountsTab } from '@/components/PatientCountsTab';
import { SourceTagsTab } from '@/components/SourceTagsTab';
import { SourceChangeLogTab } from '@/components/SourceChangeLogTab';

export function SourceDetail() {
  const navigate = useNavigate();
  const { sourceId } = useParams<{ sourceId: string }>();
  
  const {
    source,
    tags,
    monthlyData,
    changeLog,
    marketingVisits,
    loading,
    loadSourceData,
    getTotalPatients,
    getMonthlyTrend
  } = useSourceDetail(sourceId);

  const patientCounts = usePatientCounts(sourceId, loadSourceData);
  const sourceTags = useSourceTags(sourceId, source?.name, loadSourceData);

  const onBack = () => navigate('/sources');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading source details...</p>
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Source not found</p>
        <Button onClick={onBack} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const totalPatients = getTotalPatients();
  const trend = getMonthlyTrend();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto p-6 space-y-8">
        <SourceHeader 
          source={source} 
          marketingVisits={marketingVisits} 
          onBack={onBack} 
        />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalPatients}</div>
              <p className="text-sm text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`text-2xl font-bold ${
                  trend === 'up' ? 'text-green-600' : 
                  trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '➡️'}
                </div>
                <span className="text-sm capitalize">{trend}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{tags.length}</div>
              <p className="text-sm text-muted-foreground">Active tags</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            <SourceInfoCard 
              source={source} 
              onEdit={() => {}} // Will be handled by the dialog trigger
            />
            
            <SourceEditDialog 
              source={source} 
              onUpdate={loadSourceData}
              trigger={
                <Button variant="outline" className="w-full">
                  Edit Source Details
                </Button>
              }
            />
          </div>

          {/* Right Column - Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="patients" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="patients">Patient Counts</TabsTrigger>
                <TabsTrigger value="tags">Tags</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="patients" className="mt-6">
                <PatientCountsTab 
                  monthlyData={monthlyData}
                  patientCounts={patientCounts}
                />
              </TabsContent>

              <TabsContent value="tags" className="mt-6">
                <SourceTagsTab 
                  tags={tags}
                  sourceTags={sourceTags}
                />
              </TabsContent>

              <TabsContent value="history" className="mt-6">
                <SourceChangeLogTab 
                  changeLog={changeLog}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}