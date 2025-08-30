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
import { Plus, Search, Edit, Eye, Building2, Globe, MessageSquare, Star, Trash2, Check, X, Power, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ImportDataDialog } from '@/components/ImportDataDialog';
import { PatientSource, MonthlyPatients, SOURCE_TYPE_CONFIG, getCurrentYearMonth, SourceType } from '@/lib/database.types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

export function Sources() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPatients[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PatientSource>>({});
  const [editingPatientCount, setEditingPatientCount] = useState<string | null>(null);
  const [patientCountValue, setPatientCountValue] = useState<number>(0);
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

  const handleSelectAll = (sources: PatientSource[], checked: boolean) => {
    const sourceIds = sources.map(s => s.id);
    if (checked) {
      setSelectedSources(prev => [...new Set([...prev, ...sourceIds])]);
    } else {
      setSelectedSources(prev => prev.filter(id => !sourceIds.includes(id)));
    }
  };

  const handleSelectSource = (sourceId: string, checked: boolean) => {
    if (checked) {
      setSelectedSources(prev => [...prev, sourceId]);
    } else {
      setSelectedSources(prev => prev.filter(id => id !== sourceId));
    }
  };

  const handleEditSource = (source: PatientSource) => {
    setEditingSource(source.id);
    setEditForm(source);
  };

  const handleSaveEdit = async () => {
    if (!editingSource || !editForm.name) return;

    try {
      // Only update the fields that are being edited
      const updateData: Partial<PatientSource> = {
        name: editForm.name,
        source_type: editForm.source_type,
      };

      // Only include address if it's being edited (not undefined)
      if (editForm.address !== undefined) {
        updateData.address = editForm.address || null;
      }

      const { error } = await supabase
        .from('patient_sources')
        .update(updateData)
        .eq('id', editingSource);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Source updated successfully",
      });

      setEditingSource(null);
      setEditForm({});
      loadData();
    } catch (error) {
      console.error('Error updating source:', error);
      toast({
        title: "Error",
        description: "Failed to update source",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    setEditForm({});
  };

  const handleDeleteSources = async (sourceIds: string[]) => {
    if (sourceIds.length === 0) return;

    const confirmMessage = sourceIds.length === 1 
      ? "Are you sure you want to delete this source?"
      : `Are you sure you want to delete ${sourceIds.length} sources?`;

    if (!confirm(confirmMessage)) return;

    try {
      // Delete monthly data first
      const { error: monthlyError } = await supabase
        .from('monthly_patients')
        .delete()
        .in('source_id', sourceIds);

      if (monthlyError) throw monthlyError;

      // Delete source tags
      const { error: tagsError } = await supabase
        .from('source_tags')
        .delete()
        .in('source_id', sourceIds);

      if (tagsError) throw tagsError;

      // Delete change logs
      const { error: logsError } = await supabase
        .from('patient_changes_log')
        .delete()
        .in('source_id', sourceIds);

      if (logsError) throw logsError;

      // Finally delete sources
      const { error: sourcesError } = await supabase
        .from('patient_sources')
        .delete()
        .in('id', sourceIds);

      if (sourcesError) throw sourcesError;

      toast({
        title: "Success",
        description: `${sourceIds.length} source(s) deleted successfully`,
      });

      setSelectedSources([]);
      loadData();
    } catch (error) {
      console.error('Error deleting sources:', error);
      toast({
        title: "Error",
        description: "Failed to delete sources",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (sourceId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('patient_sources')
        .update({ is_active: isActive })
        .eq('id', sourceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Source ${isActive ? 'activated' : 'deactivated'} successfully`,
      });

      loadData();
    } catch (error) {
      console.error('Error updating source status:', error);
      toast({
        title: "Error",
        description: "Failed to update source status",
        variant: "destructive",
      });
    }
  };

  const handleEditPatientCount = (sourceId: string, currentCount: number) => {
    setEditingPatientCount(sourceId);
    setPatientCountValue(currentCount);
  };

  const handleSavePatientCount = async (sourceId: string) => {
    try {
      const { data, error } = await supabase.rpc('set_patient_count', {
        p_source_id: sourceId,
        p_year_month: currentMonth,
        p_count: patientCountValue,
        p_reason: 'Manual update from sources page'
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Patient count updated to ${patientCountValue}`,
      });

      setEditingPatientCount(null);
      setPatientCountValue(0);
      loadData(); // Reload to get updated data
    } catch (error) {
      console.error('Error updating patient count:', error);
      toast({
        title: "Error",
        description: "Failed to update patient count",
        variant: "destructive",
      });
    }
  };

  const handleCancelPatientCount = () => {
    setEditingPatientCount(null);
    setPatientCountValue(0);
  };

  const handleQuickUpdate = async (sourceId: string, newCount: number) => {
    if (newCount < 0) return;

    try {
      const { data, error } = await supabase.rpc('set_patient_count', {
        p_source_id: sourceId,
        p_year_month: currentMonth,
        p_count: newCount,
        p_reason: 'Quick update from sources page'
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Patient count updated to ${newCount}`,
      });

      loadData(); // Reload to get updated data
    } catch (error) {
      console.error('Error updating patient count:', error);
      toast({
        title: "Error",
        description: "Failed to update patient count",
        variant: "destructive",
      });
    }
  };

  const onlineSourceTypes = ['Google', 'Yelp', 'Website', 'Social Media'];
  const officeSourceTypes = ['Office'];
  const otherSourceTypes = ['Word of Mouth', 'Insurance', 'Other'];

  const renderSourceTable = (sources: PatientSource[], title: string, icon: React.ElementType) => {
    const Icon = icon;
    const isAllSelected = sources.length > 0 && sources.every(s => selectedSources.includes(s.id));
    const isSomeSelected = sources.some(s => selectedSources.includes(s.id));
    
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

    const selectedInTable = sources.filter(s => selectedSources.includes(s.id));

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5" />
              {title} ({sources.length})
            </CardTitle>
            {selectedInTable.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedInTable.length} selected
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteSources(selectedInTable.map(s => s.id))}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => handleSelectAll(sources, checked as boolean)}
                    aria-label="Select all"
                  />
                </TableHead>
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
                const isEditing = editingSource === source.id;
                const isSelected = selectedSources.includes(source.id);
                const isEditingCount = editingPatientCount === source.id;
                
                return (
                  <TableRow key={source.id} className={isSelected ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectSource(source.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Source name"
                            className="text-sm"
                          />
                          {editForm.address !== undefined && (
                            <Input
                              value={editForm.address || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                              placeholder="Address"
                              className="text-sm"
                            />
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">{source.name}</div>
                          {source.address && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {source.address}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <select
                          value={editForm.source_type || source.source_type}
                          onChange={(e) => setEditForm(prev => ({ ...prev, source_type: e.target.value as SourceType }))}
                          className="text-sm border rounded px-2 py-1"
                        >
                          {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>
                              {config.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{config.icon}</span>
                          <span className="text-sm">{config.label}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={source.is_active ? "default" : "secondary"}>
                          {source.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(source.id, !source.is_active)}
                          title={source.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power className={`w-3 h-3 ${source.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isEditingCount ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPatientCountValue(Math.max(0, patientCountValue - 1))}
                              title="Decrease count"
                              className="h-7 w-7 p-0 text-xs"
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={patientCountValue}
                              onChange={(e) => setPatientCountValue(parseInt(e.target.value) || 0)}
                              className="w-16 h-7 text-center text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPatientCountValue(patientCountValue + 1)}
                              title="Increase count"
                              className="h-7 w-7 p-0 text-xs"
                            >
                              +
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSavePatientCount(source.id)}
                              title="Save count"
                              className="h-7 w-7 p-0"
                            >
                              <Check className="w-3 h-3 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelPatientCount}
                              title="Cancel"
                              className="h-7 w-7 p-0"
                            >
                              <X className="w-3 h-3 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickUpdate(source.id, thisMonth - 1)}
                              disabled={thisMonth === 0}
                              title="Decrease count"
                              className="h-6 w-6 p-0 text-xs"
                            >
                              -
                            </Button>
                            <span className="font-semibold min-w-[2rem] text-center">{thisMonth}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickUpdate(source.id, thisMonth + 1)}
                              title="Increase count"
                              className="h-6 w-6 p-0 text-xs"
                            >
                              +
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditPatientCount(source.id, thisMonth)}
                              title="Edit this month's count"
                              className="h-6 w-6 p-0"
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground hover:text-primary" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {total}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleSaveEdit}
                              title="Save changes"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              title="Cancel"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/source/${source.id}`)}
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditSource(source)}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSources([source.id])}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </>
                        )}
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