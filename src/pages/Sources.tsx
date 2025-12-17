import React, { useState, useEffect, useMemo } from 'react';
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
import { Plus, Search, Edit, Eye, Building2, Globe, MessageSquare, Trash2, Check, X, Power, Users, TrendingUp, CheckCircle2, Activity, ArrowRight } from 'lucide-react';
import { ImportDataDialog } from '@/components/ImportDataDialog';
import { PatientSource, MonthlyPatients, SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { getCurrentYearMonth, nowISO } from '@/lib/dateSync';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { PatientCountEditor } from '@/components/PatientCountEditor';
import { SourceCard } from '@/components/SourceCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import { UnifiedSourceDialog } from '@/components/UnifiedSourceDialog';
import { useMultiSourceTrackingMode } from '@/hooks/useSourceTrackingMode';
import { Skeleton } from '@/components/ui/skeleton';

export function Sources() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const handleViewSource = (sourceId: string) => {
    navigate(`/sources/${sourceId}`);
  };
  const isMobile = useIsMobile();
  const [sources, setSources] = useState<PatientSource[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPatients[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PatientSource>>({});
  const currentMonth = getCurrentYearMonth();
  
  const sourceIds = useMemo(() => sources.map(s => s.id), [sources]);
  const { getModeForSource } = useMultiSourceTrackingMode(sourceIds, currentMonth);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('patient_sources')
        .select('*')
        .order('name');

      if (sourcesError) throw sourcesError;

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

  // Stats calculations
  const stats = useMemo(() => {
    const totalSources = sources.length;
    const activeSources = sources.filter(s => s.is_active).length;
    const thisMonthTotal = monthlyData
      .filter(m => m.year_month === currentMonth)
      .reduce((sum, m) => sum + m.patient_count, 0);
    const allTimeTotal = monthlyData.reduce((sum, m) => sum + m.patient_count, 0);
    
    return { totalSources, activeSources, thisMonthTotal, allTimeTotal };
  }, [sources, monthlyData, currentMonth]);

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
      const updateData: Partial<PatientSource> = {
        name: editForm.name,
        source_type: editForm.source_type,
      };

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
      const { error: monthlyError } = await supabase
        .from('monthly_patients')
        .delete()
        .in('source_id', sourceIds);

      if (monthlyError) throw monthlyError;

      const { error: tagsError } = await supabase
        .from('source_tags')
        .delete()
        .in('source_id', sourceIds);

      if (tagsError) throw tagsError;

      const { error: logsError } = await supabase
        .from('patient_changes_log')
        .delete()
        .in('source_id', sourceIds);

      if (logsError) throw logsError;

      const { data: sourcesToDelete } = await supabase
        .from('patient_sources')
        .select('id, name')
        .in('id', sourceIds);

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

  const onlineSourceTypes = ['Google', 'Yelp', 'Website', 'Social Media'];
  const officeSourceTypes = ['Office'];
  const otherSourceTypes = ['Word of Mouth', 'Insurance', 'Other'];

  const renderSourceTable = (filteredSources: PatientSource[], title: string, icon: React.ElementType, colorClass: string) => {
    const Icon = icon;
    const isAllSelected = filteredSources.length > 0 && filteredSources.every(s => selectedSources.includes(s.id));
    const selectedInTable = filteredSources.filter(s => selectedSources.includes(s.id));
    
    if (loading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (filteredSources.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className={`mx-auto w-12 h-12 rounded-full ${colorClass} flex items-center justify-center mb-4`}>
              <Icon className="w-6 h-6" />
            </div>
            <h3 className="font-medium mb-1">No {title.toLowerCase()} found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? 'Try adjusting your search.' : `Add your first ${title.toLowerCase().slice(0, -1)} to get started.`}
            </p>
            <AddSourceDialog onSourceAdded={loadData} />
          </CardContent>
        </Card>
      );
    }

    // Mobile card view
    if (isMobile) {
      return (
        <div className="space-y-4">
          {selectedInTable.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-sm font-medium">{selectedInTable.length} selected</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteSources(selectedInTable.map(s => s.id))}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </CardContent>
            </Card>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredSources.map((source) => {
              const { thisMonth, total } = getPatientCounts(source.id);
              const trackingInfo = getModeForSource(source.id);
              return (
                <SourceCard
                  key={source.id}
                  source={source}
                  thisMonth={thisMonth}
                  total={total}
                  isSelected={selectedSources.includes(source.id)}
                  isEditing={editingSource === source.id}
                  editForm={editForm}
                  onSelect={(checked) => handleSelectSource(source.id, checked)}
                  onEdit={() => handleEditSource(source)}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onDelete={() => handleDeleteSources([source.id])}
                  onToggleActive={(isActive) => handleToggleActive(source.id, isActive)}
                  onEditFormChange={(updates) => setEditForm(prev => ({ ...prev, ...updates }))}
                  onUpdatePatients={loadData}
                  onView={() => handleViewSource(source.id)}
                  trackingMode={{
                    isEditable: trackingInfo.isEditable,
                    dailyEntryCount: trackingInfo.dailyEntryCount
                  }}
                />
              );
            })}
          </div>
        </div>
      );
    }

    // Desktop table view
    return (
      <Card>
        <CardContent className="p-0">
          {selectedInTable.length > 0 && (
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
              <span className="text-sm font-medium">{selectedInTable.length} selected</span>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={(checked) => handleSelectAll(filteredSources, checked as boolean)}
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
                {filteredSources.map((source) => {
                  const { thisMonth, total } = getPatientCounts(source.id);
                  const config = SOURCE_TYPE_CONFIG[source.source_type];
                  const isEditing = editingSource === source.id;
                  const isSelected = selectedSources.includes(source.id);
                  
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
                            {Object.entries(SOURCE_TYPE_CONFIG).map(([key, cfg]) => (
                              <option key={key} value={key}>{cfg.label}</option>
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
                          <Badge variant={source.is_active ? "default" : "secondary"} className={source.is_active ? "bg-success/10 text-success border-success/20" : ""}>
                            {source.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(source.id, !source.is_active)}
                            title={source.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Power className={`w-3 h-3 ${source.is_active ? 'text-success' : 'text-muted-foreground'}`} />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const trackingInfo = getModeForSource(source.id);
                          return (
                            <PatientCountEditor
                              sourceId={source.id}
                              currentCount={thisMonth}
                              onUpdate={loadData}
                              isEditable={trackingInfo.isEditable}
                              dailyEntryCount={trackingInfo.dailyEntryCount}
                            />
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center font-semibold">{total}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          {isEditing ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={handleSaveEdit} title="Save changes">
                                <Check className="w-4 h-4 text-success" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit} title="Cancel">
                                <X className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleViewSource(source.id)} title="View details">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleEditSource(source)} title="Edit">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteSources([source.id])} title="Delete">
                                <Trash2 className="w-4 h-4 text-destructive" />
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
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Sources</p>
                <p className="text-2xl font-bold mt-1">{stats.totalSources}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>
                <p className="text-2xl font-bold mt-1">{stats.activeSources}</p>
              </div>
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Month</p>
                <p className="text-2xl font-bold mt-1">{stats.thisMonthTotal}</p>
              </div>
              <div className="p-2 bg-info/10 rounded-lg">
                <Activity className="w-5 h-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">All Time</p>
                <p className="text-2xl font-bold mt-1">{stats.allTimeTotal}</p>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search sources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-3">
              <ImportDataDialog onImportComplete={loadData} />
              <AddSourceDialog onSourceAdded={loadData} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources Tabs */}
      <Tabs defaultValue="online" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex bg-muted/50">
          <TabsTrigger value="online" className="gap-2 data-[state=active]:bg-info/10 data-[state=active]:text-info">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Online</span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{filterSources(onlineSourceTypes).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="offices" className="gap-2 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Offices</span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{filterSources(officeSourceTypes).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Other</span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{filterSources(otherSourceTypes).length}</Badge>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="online" className="space-y-4 mt-0">
            {renderSourceTable(filterSources(onlineSourceTypes), "Online Sources", Globe, "bg-info/10 text-info")}
          </TabsContent>

          <TabsContent value="offices" className="space-y-4 mt-0">
            {renderSourceTable(filterSources(officeSourceTypes), "Offices", Building2, "bg-purple-500/10 text-purple-600")}
          </TabsContent>

          <TabsContent value="other" className="space-y-4 mt-0">
            {renderSourceTable(filterSources(otherSourceTypes), "Other Sources", MessageSquare, "bg-amber-500/10 text-amber-600")}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

interface AddSourceDialogProps {
  onSourceAdded: () => void;
}

function AddSourceDialog({ onSourceAdded }: AddSourceDialogProps) {
  return (
    <UnifiedSourceDialog
      onSourceAdded={onSourceAdded}
      defaultSourceType="Other"
      triggerButton={
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Source
        </Button>
      }
    />
  );
}
