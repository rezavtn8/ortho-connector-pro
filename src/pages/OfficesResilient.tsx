import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, Plus, Wifi, WifiOff, RefreshCw, Eye, Edit, Users, Loader2, Search, Trash2, Power, Check, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { supabase } from '@/integrations/supabase/client';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { AddOfficeDialog } from '@/components/AddSourceDialog';
import { PatientLoadHistoryEditor } from '@/components/PatientLoadHistoryEditor';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Office {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  source_type: string;
  patient_load?: number;
}

function OfficesContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOffice, setEditingOffice] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Office>>({});
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [showPatientModal, setShowPatientModal] = useState<{ officeId: string; officeName: string; currentLoad: number } | null>(null);

  const {
    data: offices,
    isLoading,
    error,
    isOffline,
    retry
  } = useResilientQuery({
    queryKey: ['partner-offices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('source_type', 'Office')
        .order('name');
      
      if (error) throw error;
      
      return data as Office[];
    },
    fallbackData: [],
    retryMessage: 'Refreshing offices...'
  });

  const filteredOffices = offices?.filter(office =>
    searchTerm === '' ||
    office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    office.address?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleRefresh = () => {
    retry();
  };

  const handleOfficeAdded = () => {
    retry();
  };

  const handleViewOffice = (officeId: string) => {
    navigate(`/sources/${officeId}`);
  };

  const handleEditOffice = (office: Office) => {
    setEditingOffice(office.id);
    setEditForm(office);
  };

  const handleSaveEdit = async () => {
    if (!editingOffice || !editForm.name) return;

    try {
      const { error } = await supabase
        .from('patient_sources')
        .update({
          name: editForm.name,
          address: editForm.address || null,
          phone: editForm.phone || null,
          email: editForm.email || null,
          notes: editForm.notes || null,
        })
        .eq('id', editingOffice);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Office updated successfully",
      });

      setEditingOffice(null);
      setEditForm({});
      retry();
    } catch (error) {
      console.error('Error updating office:', error);
      toast({
        title: "Error",
        description: "Failed to update office",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingOffice(null);
    setEditForm({});
  };

  const handleToggleActive = async (officeId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('patient_sources')
        .update({ is_active: isActive })
        .eq('id', officeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Office ${isActive ? 'activated' : 'deactivated'} successfully`,
      });

      retry();
    } catch (error) {
      console.error('Error updating office status:', error);
      toast({
        title: "Error",
        description: "Failed to update office status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOffice = async (officeId: string) => {
    if (!confirm('Are you sure you want to delete this office?')) return;

    try {
      const { error } = await supabase
        .from('patient_sources')
        .delete()
        .eq('id', officeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Office deleted successfully",
      });

      retry();
    } catch (error) {
      console.error('Error deleting office:', error);
      toast({
        title: "Error",
        description: "Failed to delete office",
        variant: "destructive",
      });
    }
  };

  const handleSelectOffice = (officeId: string, checked: boolean) => {
    if (checked) {
      setSelectedOffices(prev => [...prev, officeId]);
    } else {
      setSelectedOffices(prev => prev.filter(id => id !== officeId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOffices(filteredOffices.map(o => o.id));
    } else {
      setSelectedOffices([]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Partner Offices</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Loading office data...
          </p>
        </div>

        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error && !offices?.length) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Partner Offices</h1>
          </div>
        </div>

        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg">Failed to load offices</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'An error occurred'}
                </p>
              </div>
              <Button onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAllSelected = filteredOffices.length > 0 && filteredOffices.every(o => selectedOffices.includes(o.id));

  // Mobile Card View
  if (isMobile) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Partner Offices</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Manage dental office partnerships and referral relationships
          </p>
        </div>

        {isOffline && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertTitle>You're offline</AlertTitle>
            <AlertDescription>
              Showing cached data. Changes will sync when you're back online.
            </AlertDescription>
          </Alert>
        )}

        {/* Search & Actions */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search offices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <AddOfficeDialog onOfficeAdded={handleOfficeAdded} />
        </div>

        {/* Office Cards */}
        {!filteredOffices || filteredOffices.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No offices found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'Try adjusting your search' : 'Start by adding your first office'}
                </p>
                {!searchTerm && (
                  <AddOfficeDialog onOfficeAdded={handleOfficeAdded} />
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredOffices.map((office) => {
              const isEditing = editingOffice === office.id;
              const isSelected = selectedOffices.includes(office.id);

              return (
                <Card key={office.id} className={`hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectOffice(office.id, checked as boolean)}
                      />
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <Input
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="mb-2"
                          />
                        ) : (
                          <h3 className="font-semibold truncate">{office.name}</h3>
                        )}
                        {office.address && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{office.address}</p>
                        )}
                      </div>
                      <Badge variant={office.is_active ? "default" : "secondary"} className="shrink-0">
                        {office.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={handleSaveEdit} className="flex-1">
                            <Check className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit} className="flex-1">
                            <X className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleViewOffice(office.id)} className="flex-1">
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEditOffice(office)} className="flex-1">
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setShowPatientModal({ officeId: office.id, officeName: office.name, currentLoad: office.patient_load || 0 })}
                            className="flex-1"
                          >
                            <Users className="w-3 h-3 mr-1" />
                            Patients
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}


        {/* Patient Load Modal */}
        {showPatientModal && (
          <Dialog open={!!showPatientModal} onOpenChange={() => setShowPatientModal(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Patient Counts - {showPatientModal.officeName}</DialogTitle>
              </DialogHeader>
              <PatientLoadHistoryEditor
                officeId={showPatientModal.officeId}
                officeName={showPatientModal.officeName}
                currentLoad={showPatientModal.currentLoad}
                onUpdate={(newLoad) => {
                  setShowPatientModal(null);
                  retry();
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // Desktop Table View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Partner Offices</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Manage dental office partnerships and referral relationships
        </p>
      </div>

      {isOffline && (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertTitle>You're offline</AlertTitle>
          <AlertDescription>
            Showing cached data. Changes will sync when you're back online.
          </AlertDescription>
        </Alert>
      )}

      {/* Search & Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search offices by name or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {selectedOffices.length > 0 && (
            <Badge variant="secondary" className="px-3 py-2">
              {selectedOffices.length} selected
            </Badge>
          )}
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <AddOfficeDialog onOfficeAdded={handleOfficeAdded} />
        </div>
      </div>

      {/* Office Table */}
      {!filteredOffices || filteredOffices.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No offices found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'Try adjusting your search criteria' : 'Start building your network by adding dental offices'}
              </p>
              {!searchTerm && (
                <AddOfficeDialog onOfficeAdded={handleOfficeAdded} />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Partner Offices ({filteredOffices.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffices.map((office) => {
                    const isEditing = editingOffice === office.id;
                    const isSelected = selectedOffices.includes(office.id);

                    return (
                      <TableRow key={office.id} className={isSelected ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectOffice(office.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-2 min-w-[200px]">
                              <Input
                                value={editForm.name || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Office name"
                                className="text-sm"
                              />
                              <Input
                                value={editForm.address || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="Address"
                                className="text-sm"
                              />
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{office.name}</div>
                              {office.address && (
                                <div className="text-sm text-muted-foreground truncate max-w-xs">
                                  {office.address}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-2 min-w-[180px]">
                              <Input
                                value={editForm.phone || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="Phone"
                                className="text-sm"
                              />
                              <Input
                                value={editForm.email || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="Email"
                                className="text-sm"
                              />
                            </div>
                          ) : (
                            <div className="text-sm">
                              {office.phone && <div>{office.phone}</div>}
                              {office.email && <div className="text-muted-foreground">{office.email}</div>}
                              {!office.phone && !office.email && (
                                <span className="text-muted-foreground">No contact info</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={office.is_active ? "default" : "secondary"}>
                              {office.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {!isEditing && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(office.id, !office.is_active)}
                              >
                                <Power className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={handleSaveEdit}>
                                <Check className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleViewOffice(office.id)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditOffice(office)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setShowPatientModal({ officeId: office.id, officeName: office.name, currentLoad: office.patient_load || 0 })}
                              >
                                <Users className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteOffice(office.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Patient Load Modal */}
      {showPatientModal && (
        <Dialog open={!!showPatientModal} onOpenChange={() => setShowPatientModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Patient Counts - {showPatientModal.officeName}</DialogTitle>
            </DialogHeader>
            <PatientLoadHistoryEditor
              officeId={showPatientModal.officeId}
              officeName={showPatientModal.officeName}
              currentLoad={showPatientModal.currentLoad}
              onUpdate={(newLoad) => {
                setShowPatientModal(null);
                retry();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function Offices() {
  return (
    <ResilientErrorBoundary showNetworkStatus>
      <OfficesContent />
    </ResilientErrorBoundary>
  );
}
