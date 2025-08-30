import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Edit, Eye, Building2, Globe, MessageSquare, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ImportDataDialog } from '@/components/ImportDataDialog';
import { PatientSource, MonthlyPatients, SOURCE_TYPE_CONFIG, getCurrentYearMonth } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function Sources() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPatients[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const currentMonth = getCurrentYearMonth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load patient sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('patient_sources')
        .select('*')
        .order('name');

      if (sourcesError) throw sourcesError;

      // Load all monthly data for patient counts
      const { data: monthlyDataResult, error: monthlyError } = await supabase
        .from('monthly_patients')
        .select('*');

      if (monthlyError) throw monthlyError;

      setSources(sourcesData || []);
      setMonthlyData(monthlyDataResult || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getPatientCounts = (sourceId: string) => {
    const sourceMonthlyData = monthlyData.filter(m => m.source_id === sourceId);
    const thisMonth = sourceMonthlyData
      .filter(m => m.year_month === currentMonth)
      .reduce((sum, m) => sum + m.patient_count, 0);
    const total = sourceMonthlyData.reduce((sum, m) => sum + m.patient_count, 0);
    return { thisMonth, total };
  };

  const filterSources = (types: string[]) => {
    return sources
      .filter(source => types.includes(source.source_type))
      .filter(source => 
        searchTerm === '' || 
        source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        source.address?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  };

  const onlineSourceTypes = ['Google', 'Yelp', 'Website', 'Social Media'];
  const officeSourceTypes = ['Office'];
  const otherSourceTypes = ['Word of Mouth', 'Insurance', 'Other'];

  const renderSourceTable = (sources: PatientSource[], title: string, icon: React.ElementType) => {
    const Icon = icon;
    
    if (loading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading...</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (sources.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No {title.toLowerCase()} found</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title} ({sources.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">This Month</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => {
                const { thisMonth, total } = getPatientCounts(source.id);
                const config = SOURCE_TYPE_CONFIG[source.source_type];
                
                return (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{source.name}</div>
                        {source.address && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {source.address}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span className="text-sm">{config.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={source.is_active ? "default" : "secondary"}>
                        {source.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {thisMonth}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {total}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/source/${source.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/source/${source.id}`)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Referral Sources</h1>
          <p className="text-muted-foreground">
            Manage your referral sources and channels
          </p>
        </div>
        <div className="flex gap-2">
          <ImportDataDialog onImportComplete={loadData} />
          <Button onClick={() => navigate('?page=add-source')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search sources by name or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Source Tables */}
      <Tabs defaultValue="online" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="online">Online Sources</TabsTrigger>
          <TabsTrigger value="offices">Dental Offices</TabsTrigger>
          <TabsTrigger value="others">Other Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="online" className="space-y-4">
          {renderSourceTable(filterSources(onlineSourceTypes), 'Online Sources', Globe)}
        </TabsContent>

        <TabsContent value="offices" className="space-y-4">
          {renderSourceTable(filterSources(officeSourceTypes), 'Dental Offices', Building2)}
        </TabsContent>

        <TabsContent value="others" className="space-y-4">
          {renderSourceTable(filterSources(otherSourceTypes), 'Other Sources', MessageSquare)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Sources;