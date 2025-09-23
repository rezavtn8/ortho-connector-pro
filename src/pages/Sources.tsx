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
import { Plus, Search, Edit, Eye, Building2, Globe, MessageSquare, Star, Trash2, Check, X, Power, Users } from 'lucide-react';
// Navigation is handled internally, no need for React Router
import { ImportDataDialog } from '@/components/ImportDataDialog';
import { PatientSource, MonthlyPatients, SOURCE_TYPE_CONFIG, SourceType } from '@/lib/database.types';
import { getCurrentYearMonth, nowISO } from '@/lib/dateSync';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { AddressSearch } from '@/components/AddressSearch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PatientCountEditor } from '@/components/PatientCountEditor';
import { SourceCard } from '@/components/SourceCard';
import { useIsMobile } from '@/hooks/use-mobile';

import { useNavigate } from 'react-router-dom';

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

      // Get source names before deletion for logging
      const { data: sourcesToDelete } = await supabase
        .from('patient_sources')
        .select('id, name')
        .in('id', sourceIds);

      // Finally delete sources
      const { error: sourcesError } = await supabase
        .from('patient_sources')  
        .delete()
        .in('id', sourceIds);

      if (sourcesError) throw sourcesError;

      // Log each deletion
      if (sourcesToDelete) {
        for (const source of sourcesToDelete) {
          await supabase.rpc('log_activity', {
            p_action_type: 'source_deleted',
            p_resource_type: 'source',
            p_resource_id: source.id,
            p_resource_name: source.name,
            p_details: {
              method: 'bulk_delete',
              total_deleted: sourceIds.length
            }
          });
        }
      }

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

    // Mobile card view
    if (isMobile) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Icon className="w-5 h-5" />
              {title} ({sources.length})
            </h3>
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
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {sources.map((source) => {
              const { thisMonth, total } = getPatientCounts(source.id);
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
                />
              );
            })}
          </div>
        </div>
      );
    }

    // Desktop table view (keep existing table implementation)
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
          <div className="overflow-x-auto">
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
                         <PatientCountEditor
                           sourceId={source.id}
                           currentCount={thisMonth}
                           onUpdate={loadData}
                         />
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
                                onClick={() => handleViewSource(source.id)}
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
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Sources</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Manage your referral sources and relationships
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sources by name or address..."
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

      {/* Sources Tabs */}
      <Tabs defaultValue="online" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md" variant="pills">
          <TabsTrigger value="online" variant="pills" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Online
          </TabsTrigger>
          <TabsTrigger value="offices" variant="pills" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Offices
          </TabsTrigger>
          <TabsTrigger value="other" variant="pills" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Other
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">

          <TabsContent value="online" className="space-y-4">
            {renderSourceTable(filterSources(onlineSourceTypes), "Online Sources", Globe)}
          </TabsContent>

          <TabsContent value="offices" className="space-y-4">
            {renderSourceTable(filterSources(officeSourceTypes), "Offices", Building2)}
          </TabsContent>

          <TabsContent value="other" className="space-y-4">
            {renderSourceTable(filterSources(otherSourceTypes), "Other Sources", MessageSquare)}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// Add Source Dialog Component
interface AddSourceDialogProps {
  onSourceAdded: () => void;
}

function AddSourceDialog({ onSourceAdded }: AddSourceDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    source_type: 'Other' as SourceType,
    phone: '',
    email: '',
    website: '',
    notes: ''
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Source name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const sourceData: any = {
        name: formData.name.trim(),
        source_type: formData.source_type,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        website: formData.website.trim() || null,
        notes: formData.notes.trim() || null,
        is_active: true,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      // Add address and coordinates if office was selected
      if (selectedOffice) {
        sourceData.address = selectedOffice.address;
        sourceData.latitude = selectedOffice.latitude;
        sourceData.longitude = selectedOffice.longitude;
      }

      const { error } = await supabase
        .from('patient_sources')
        .insert([sourceData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Source added successfully",
      });

      // Reset form
      setFormData({
        name: '',
        source_type: 'Other',
        phone: '',
        email: '',
        website: '',
        notes: ''
      });
      setSelectedOffice(null);
      setIsOpen(false);
      onSourceAdded();
    } catch (error: any) {
      console.error('Error adding source:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add source",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Source
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Source</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address-search">Search Address (Optional)</Label>
            <AddressSearch
              onSelect={(office) => {
                setSelectedOffice(office);
                if (office) {
                  setFormData(prev => ({ ...prev, name: office.name }));
                }
              }}
              placeholder="Search for address or office..."
            />
            {selectedOffice && (
              <div className="p-2 bg-muted rounded-md text-sm">
                <div className="font-medium">{selectedOffice.name}</div>
                {selectedOffice.address && (
                  <div className="text-muted-foreground">{selectedOffice.address}</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Source name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source_type">Type</Label>
              <Select value={formData.source_type} onValueChange={(value: SourceType) => 
                setFormData(prev => ({ ...prev, source_type: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contact@example.com"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://www.example.com"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Source'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}