import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOffices } from '@/hooks/useOffices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { Eye, Edit, Users, Trash2, Search, MapPin, Phone, Mail, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PatientLoadHistoryEditor } from '@/components/PatientLoadHistoryEditor';
import { AddOfficeDialog as AddSourceDialog } from '@/components/AddSourceDialog';

interface Office {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  currentMonthReferrals: number;
  totalReferrals: number;
  strength: 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  category: 'VIP' | 'Strong' | 'Moderate' | 'Sporadic' | 'Cold';
  lastActiveMonth?: string | null;
  google_rating?: number | null;
  l12?: number;
  r3?: number;
  mslr?: number;
  tier?: string;
}

function OfficesContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [editForm, setEditForm] = useState<Partial<Office>>({});
  const [patientLoadOffice, setPatientLoadOffice] = useState<{ id: string; name: string; currentLoad: number } | null>(null);
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<'name' | 'tier' | 'l12' | 'r3' | 'total' | 'lastActive'>('total');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch offices data with tier calculations
  const { data: offices, isLoading, error, refetch } = useOffices();

  // Filter and sort offices
  const { filteredOffices, stats } = useMemo(() => {
    if (!offices) return { filteredOffices: [], stats: { total: 0, vip: 0, warm: 0, dormant: 0, cold: 0, l12Total: 0, currentMonth: 0 } };
    
    // Filter by search term
    let filtered = offices.filter(office =>
      office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      office.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter by tier
    if (tierFilter !== 'All') {
      filtered = filtered.filter(office => office.tier === tierFilter);
    }

    // Sort offices
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'tier':
          const tierOrder = { VIP: 1, Warm: 2, Dormant: 3, Cold: 4 };
          aVal = tierOrder[a.tier as keyof typeof tierOrder] || 5;
          bVal = tierOrder[b.tier as keyof typeof tierOrder] || 5;
          break;
        case 'l12':
          aVal = a.l12 || 0;
          bVal = b.l12 || 0;
          break;
        case 'r3':
          aVal = a.r3 || 0;
          bVal = b.r3 || 0;
          break;
        case 'total':
          aVal = a.totalReferrals || 0;
          bVal = b.totalReferrals || 0;
          break;
        case 'lastActive':
          aVal = a.lastActiveMonth || '0000-00';
          bVal = b.lastActiveMonth || '0000-00';
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Calculate stats
    const stats = {
      total: offices.length,
      vip: offices.filter(o => o.tier === 'VIP').length,
      warm: offices.filter(o => o.tier === 'Warm').length,
      dormant: offices.filter(o => o.tier === 'Dormant').length,
      cold: offices.filter(o => o.tier === 'Cold').length,
      l12Total: offices.reduce((sum, o) => sum + (o.l12 || 0), 0),
      currentMonth: offices.reduce((sum, o) => sum + (o.currentMonthReferrals || 0), 0)
    };

    return { filteredOffices: filtered, stats };
  }, [offices, searchTerm, tierFilter, sortField, sortDirection]);


  const handleView = (office: Office) => {
    navigate(`/sources/${office.id}`);
  };

  const handleEdit = (office: Office) => {
    setEditingOffice(office);
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
        .eq('id', editingOffice.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Office updated successfully'
      });
      setEditingOffice(null);
      setEditForm({});
      refetch();
    } catch (error) {
      console.error('Error updating office:', error);
      toast({
        title: 'Error',
        description: 'Failed to update office',
        variant: 'destructive'
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingOffice(null);
    setEditForm({});
  };

  const handlePatientCounts = (office: Office) => {
    setPatientLoadOffice({
      id: office.id,
      name: office.name,
      currentLoad: office.currentMonthReferrals || 0
    });
  };

  const handleDelete = async (office: Office) => {
    if (!confirm(`Are you sure you want to delete ${office.name}?`)) return;

    try {
      const { error } = await supabase
        .from('patient_sources')
        .delete()
        .eq('id', office.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Office deleted successfully'
      });
      refetch();
    } catch (error) {
      console.error('Error deleting office:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete office',
        variant: 'destructive'
      });
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getTierBadgeVariant = (tier?: string) => {
    switch (tier) {
      case 'VIP': return 'default';
      case 'Warm': return 'secondary';
      case 'Dormant': return 'outline';
      case 'Cold': return 'outline';
      default: return 'outline';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'VIP': return '🌟';
      case 'Warm': return '🔥';
      case 'Dormant': return '💤';
      case 'Cold': return '❄️';
      default: return '📍';
    }
  };

  const formatLastActive = (lastActiveMonth?: string | null) => {
    if (!lastActiveMonth) return 'Never';
    const date = new Date(lastActiveMonth + '-01');
    const now = new Date();
    const monthsDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    
    if (monthsDiff === 0) return 'This month';
    if (monthsDiff === 1) return 'Last month';
    return `${monthsDiff} months ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Partner Offices</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Manage your referring partner offices and track their referral performance
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <AddSourceDialog onOfficeAdded={refetch} />
      </div>

      {/* Stats Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Partner Office Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Partners</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">🌟 VIP</p>
              <p className="text-2xl font-bold">{stats.vip}</p>
              <p className="text-xs text-muted-foreground">{stats.total > 0 ? Math.round((stats.vip / stats.total) * 100) : 0}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">🔥 Warm</p>
              <p className="text-2xl font-bold">{stats.warm}</p>
              <p className="text-xs text-muted-foreground">{stats.total > 0 ? Math.round((stats.warm / stats.total) * 100) : 0}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">💤 Dormant</p>
              <p className="text-2xl font-bold">{stats.dormant}</p>
              <p className="text-xs text-muted-foreground">{stats.total > 0 ? Math.round((stats.dormant / stats.total) * 100) : 0}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">❄️ Cold</p>
              <p className="text-2xl font-bold">{stats.cold}</p>
              <p className="text-xs text-muted-foreground">{stats.total > 0 ? Math.round((stats.cold / stats.total) * 100) : 0}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">L12 Referrals</p>
              <p className="text-2xl font-bold">{stats.l12Total}</p>
              <p className="text-xs text-muted-foreground">{stats.currentMonth} this month</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search offices by name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={tierFilter === 'All' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTierFilter('All')}
              >
                All
              </Button>
              <Button
                variant={tierFilter === 'VIP' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTierFilter('VIP')}
              >
                🌟 VIP
              </Button>
              <Button
                variant={tierFilter === 'Warm' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTierFilter('Warm')}
              >
                🔥 Warm
              </Button>
              <Button
                variant={tierFilter === 'Dormant' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTierFilter('Dormant')}
              >
                💤 Dormant
              </Button>
              <Button
                variant={tierFilter === 'Cold' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTierFilter('Cold')}
              >
                ❄️ Cold
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unified Office Table */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading offices...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-medium">Failed to load offices</p>
            <p className="text-sm text-muted-foreground mt-2">Please try refreshing</p>
          </CardContent>
        </Card>
      ) : filteredOffices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {searchTerm || tierFilter !== 'All' ? 'No offices found matching your filters' : 'No offices yet. Add your first partner office!'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      Office Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('tier')}
                    >
                      Category {sortField === 'tier' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('total')}
                    >
                      Total {sortField === 'total' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('l12')}
                    >
                      L12 {sortField === 'l12' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('r3')}
                    >
                      R3 {sortField === 'r3' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('lastActive')}
                    >
                      Last Active {sortField === 'lastActive' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffices.map((office) => (
                    <TableRow key={office.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{office.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {office.address || 'No address'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getTierBadgeVariant(office.tier)}>
                          {getTierIcon(office.tier || 'Cold')} {office.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold">{office.totalReferrals || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold">{office.l12 || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold">{office.r3 || 0}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatLastActive(office.lastActiveMonth)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleView(office)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(office)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handlePatientCounts(office)}>
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(office)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredOffices.map((office) => (
                <Card key={office.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{office.name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {office.address || 'No address'}
                        </p>
                      </div>
                      <Badge variant={getTierBadgeVariant(office.tier)}>
                        {getTierIcon(office.tier || 'Cold')} {office.tier}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center py-2 border-y">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-bold">{office.totalReferrals || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">L12</p>
                        <p className="text-lg font-bold">{office.l12 || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">R3</p>
                        <p className="text-lg font-bold">{office.r3 || 0}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Last active: {formatLastActive(office.lastActiveMonth)}
                    </div>

                    {office.phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {office.phone}
                      </div>
                    )}

                    {office.email && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {office.email}
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => handleView(office)} className="flex-1">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(office)} className="flex-1">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handlePatientCounts(office)} className="flex-1">
                        <Users className="h-4 w-4 mr-1" />
                        Counts
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(office)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Office Dialog */}
      {editingOffice && (
        <Dialog open={!!editingOffice} onOpenChange={() => handleCancelEdit()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Office - {editingOffice.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Address</label>
                <Input
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Patient Load Modal */}
      {patientLoadOffice && (
        <Dialog open={!!patientLoadOffice} onOpenChange={() => setPatientLoadOffice(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Patient Counts - {patientLoadOffice.name}</DialogTitle>
            </DialogHeader>
            <PatientLoadHistoryEditor
              officeId={patientLoadOffice.id}
              officeName={patientLoadOffice.name}
              currentLoad={patientLoadOffice.currentLoad}
              onUpdate={(newLoad) => {
                setPatientLoadOffice(null);
                refetch();
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
