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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResilientErrorBoundary } from '@/components/ResilientErrorBoundary';
import { Eye, Edit, Users, Trash2, Search, MapPin, Phone, Mail, AlertCircle, ChevronDown, TrendingUp, Calendar, Building2, RefreshCw } from 'lucide-react';
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
  const [openTiers, setOpenTiers] = useState<Record<string, boolean>>({
    VIP: true,
    Warm: true,
    Dormant: false,
    Cold: false
  });

  // Fetch offices data with tier calculations
  const { data: offices, isLoading, error, refetch } = useOffices();

  // Filter and group offices by tier
  const { filteredOffices, groupedByTier, stats } = useMemo(() => {
    if (!offices) return { filteredOffices: [], groupedByTier: {}, stats: { total: 0, vip: 0, warm: 0, dormant: 0, cold: 0, l12Total: 0, currentMonth: 0 } };
    
    // Filter by search term
    let filtered = offices.filter(office =>
      office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      office.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter by tier
    if (tierFilter !== 'All') {
      filtered = filtered.filter(office => office.tier === tierFilter);
    }

    // Group by tier
    const grouped: Record<string, Office[]> = {
      VIP: [],
      Warm: [],
      Dormant: [],
      Cold: []
    };

    filtered.forEach(office => {
      const tier = office.tier || 'Cold';
      if (grouped[tier]) {
        grouped[tier].push(office);
      }
    });

    // Sort within each tier by r3 (most recent activity first)
    Object.keys(grouped).forEach(tier => {
      grouped[tier].sort((a, b) => (b.r3 || 0) - (a.r3 || 0));
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

    return { filteredOffices: filtered, groupedByTier: grouped, stats };
  }, [offices, searchTerm, tierFilter]);

  const handleRefresh = async () => {
    try {
      await refetch();
      toast({
        title: 'Refreshed',
        description: 'Office data has been refreshed'
      });
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  };

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

  const getTierDescription = (tier: string) => {
    switch (tier) {
      case 'VIP': return 'Consistently sending 8+ referrals/month';
      case 'Warm': return 'Active partnership with 4+ referrals/month';
      case 'Dormant': return 'Has sent referrals but currently inactive';
      case 'Cold': return 'No recent referrals';
      default: return '';
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Partner Offices</h1>
          <p className="text-muted-foreground mt-1">Manage your referring partner offices</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <AddSourceDialog onOfficeAdded={handleRefresh} />
        </div>
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

      {/* Tier-Based Office Groups */}
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
        <div className="space-y-4">
          {(['VIP', 'Warm', 'Dormant', 'Cold'] as const).map((tier) => {
            const tierOffices = groupedByTier[tier] || [];
            if (tierOffices.length === 0) return null;

            return (
              <Card key={tier}>
                <Collapsible
                  open={openTiers[tier]}
                  onOpenChange={(open) => setOpenTiers({ ...openTiers, [tier]: open })}
                >
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getTierIcon(tier)}</span>
                          <div className="text-left">
                            <CardTitle className="flex items-center gap-2">
                              {tier} Partners
                              <Badge variant={getTierBadgeVariant(tier)}>{tierOffices.length}</Badge>
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {getTierDescription(tier)}
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${openTiers[tier] ? 'transform rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Office Name</TableHead>
                              <TableHead className="text-center">L12</TableHead>
                              <TableHead className="text-center">R3</TableHead>
                              <TableHead className="text-center">Current</TableHead>
                              <TableHead>Last Active</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tierOffices.map((office) => (
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
                                  <span className="font-semibold">{office.l12 || 0}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-semibold">{office.r3 || 0}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-semibold">{office.currentMonthReferrals || 0}</span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {formatLastActive(office.lastActiveMonth)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleView(office)}
                                      title="View Details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEdit(office)}
                                      title="Edit"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handlePatientCounts(office)}
                                      title="Patient Counts"
                                    >
                                      <Users className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelete(office)}
                                      title="Delete"
                                    >
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
                      <div className="md:hidden space-y-3">
                        {tierOffices.map((office) => (
                          <Card key={office.id}>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">{office.name}</CardTitle>
                              <CardDescription className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {office.address || 'No address'}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div>
                                  <p className="text-xs text-muted-foreground">L12</p>
                                  <p className="text-lg font-bold">{office.l12 || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">R3</p>
                                  <p className="text-lg font-bold">{office.r3 || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Current</p>
                                  <p className="text-lg font-bold">{office.currentMonthReferrals || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">MSLR</p>
                                  <p className="text-lg font-bold">{office.mslr || 0}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                Last active: {formatLastActive(office.lastActiveMonth)}
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleView(office)}>
                                  <Eye className="h-4 w-4 mr-1" /> View
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleEdit(office)}>
                                  <Edit className="h-4 w-4 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handlePatientCounts(office)}>
                                  <Users className="h-4 w-4 mr-1" /> Count
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
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
