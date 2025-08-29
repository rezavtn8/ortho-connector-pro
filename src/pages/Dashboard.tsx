import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddOfficeDialog } from '@/components/AddSourceDialog';
import { SimplePatientCounter } from '@/components/SimplePatientCounter';
import { CurrentMonthSource, SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Calendar, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function Dashboard() {
  const [sources, setSources] = useState<CurrentMonthSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      loadCurrentMonthData();
    }
  }, [user, authLoading]);

  const loadCurrentMonthData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_current_month_sources');
      
      if (error) throw error;
      
      setSources(data.map((item: any) => ({
        ...item,
        source_type: item.source_type as SourceType
      })) || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load current month data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSourceCount = (sourceId: string, newCount: number) => {
    setSources(prev => 
      prev.map(source => 
        source.source_id === sourceId 
          ? { ...source, current_month_patients: newCount }
          : source
      )
    );
  };

  const currentMonth = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long' 
  });
  
  const totalPatientsThisMonth = sources.reduce((sum, s) => sum + s.current_month_patients, 0);

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">This Month</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse w-16 mb-2"></div>
                <div className="h-6 bg-muted rounded animate-pulse w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">This Month</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {currentMonth} • {totalPatientsThisMonth} patients total
          </p>
        </div>
        <Button onClick={() => setShowAddSource(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Source
        </Button>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Monthly Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary mb-2">
            {totalPatientsThisMonth}
          </div>
          <p className="text-muted-foreground">
            New patients from {sources.length} sources
          </p>
        </CardContent>
      </Card>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources.map((source) => {
          const config = SOURCE_TYPE_CONFIG[source.source_type];
          return (
            <Card key={source.source_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{source.source_name}</CardTitle>
                    <Badge variant="outline" className="mt-2">
                      <span className="mr-1">{config.icon}</span>
                      {config.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <SimplePatientCounter
                  sourceId={source.source_id}
                  sourceName={source.source_name}
                  currentCount={source.current_month_patients}
                  onUpdate={(newCount) => updateSourceCount(source.source_id, newCount)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sources.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground mb-4">
              No patient sources found. Add your first source to start tracking monthly patients.
            </div>
            <Button onClick={() => setShowAddSource(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Source
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Source Dialog */}
      <AddOfficeDialog
        onOfficeAdded={() => {
          setShowAddSource(false);
          loadCurrentMonthData();
        }}
      />
    </div>
  );
}