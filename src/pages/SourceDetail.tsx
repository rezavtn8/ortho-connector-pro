// src/pages/SourceDetail.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PatientSource,
  SourceTag,
  MonthlyPatients,
  PatientChangeLog,
  SOURCE_TYPE_CONFIG,
  formatYearMonth
} from '@/lib/database.types';
import { getCurrentYearMonth, nowISO } from '@/lib/dateSync';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  Edit,
  Save,
  X,
  Plus,
  Minus,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  History,
  Tag,
  Star,
  MapPin,
  Users,
  Building
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AddressSearch } from '@/components/AddressSearch';
import { useNavigate, useParams } from 'react-router-dom';
import { useSourceTrackingMode } from '@/hooks/useSourceTrackingMode';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MonthlyPatientRow } from '@/components/MonthlyPatientRow';

export function SourceDetail() {
  const navigate = useNavigate();
  const { sourceId } = useParams<{ sourceId: string }>();
  const onBack = () => navigate('/sources');
  const [source, setSource] = useState<PatientSource | null>(null);
  const [tags, setTags] = useState<SourceTag[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPatients[]>([]);
  const [changeLog, setChangeLog] = useState<PatientChangeLog[]>([]);
  const [marketingVisits, setMarketingVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [newTag, setNewTag] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    notes: '',
    latitude: null as number | null,
    longitude: null as number | null
  });
  const { toast } = useToast();
  const currentMonth = getCurrentYearMonth();

  useEffect(() => {
    if (sourceId) {
      loadSourceData();
    }
  }, [sourceId]);

  const loadSourceData = async () => {
    try {
      setLoading(true);

      // Load source
      const { data: sourceData, error: sourceError } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('id', sourceId)
        .single();

      if (sourceError) throw sourceError;

      // Load tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('source_tags')
        .select('*')
        .eq('source_id', sourceId);

      if (tagsError) throw tagsError;

      // Load monthly data (last 12 months)
      const { data: monthlyDataResult, error: monthlyError } = await supabase
        .from('monthly_patients')
        .select('*')
        .eq('source_id', sourceId)
        .order('year_month', { ascending: false })
        .limit(12);

      if (monthlyError) throw monthlyError;

      // Load change log
      const { data: changeLogData, error: changeLogError } = await supabase
        .from('patient_changes_log')
        .select('*')
        .eq('source_id', sourceId)
        .order('changed_at', { ascending: false })
        .limit(50);

      if (changeLogError) throw changeLogError;

      // Load marketing visits if source is Office type
      let visitsData = [];
      if (sourceData?.source_type === 'Office') {
        const { data: visits, error: visitsError } = await supabase
          .from('marketing_visits')
          .select('*')
          .eq('office_id', sourceId)
          .order('visit_date', { ascending: false });

        if (visitsError) {
          console.warn('Error loading marketing visits:', visitsError);
        } else {
          visitsData = visits || [];
        }
      }

      setSource(sourceData);
      setTags(tagsData || []);
      setMonthlyData(monthlyDataResult || []);
      setChangeLog(changeLogData || []);
      setMarketingVisits(visitsData);
      
      // Initialize edit form with source data
      if (sourceData) {
        setEditForm({
          name: sourceData.name || '',
          address: sourceData.address || '',
          phone: sourceData.phone || '',
          email: sourceData.email || '',
          website: sourceData.website || '',
          notes: sourceData.notes || '',
          latitude: sourceData.latitude,
          longitude: sourceData.longitude
        });
      }
    } catch (error) {
      console.error('Error loading source data:', error);
      toast({
        title: "Error",
        description: "Failed to load source data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const adjustPatientCount = async (yearMonth: string, delta: number) => {
    try {
      const { data, error } = await supabase
        .rpc('adjust_patient_count', {
          p_source_id: sourceId,
          p_year_month: yearMonth,
          p_delta: delta
        });

      if (error) throw error;

      await loadSourceData();

      toast({
        title: "Success",
        description: `Patient count updated for ${formatYearMonth(yearMonth)}`,
      });
    } catch (error) {
      console.error('Error adjusting patient count:', error);
      toast({
        title: "Error",
        description: "Failed to update patient count",
        variant: "destructive",
      });
    }
  };

  const updateMonthlyCount = async (yearMonth: string, newCount: number) => {
    try {
      const currentData = monthlyData.find(m => m.year_month === yearMonth);
      const currentCount = currentData?.patient_count || 0;
      const delta = newCount - currentCount;

      if (delta !== 0) {
        await adjustPatientCount(yearMonth, delta);
      }

      setEditingMonth(null);
    } catch (error) {
      console.error('Error updating monthly count:', error);
    }
  };

  const addTag = async () => {
    if (!newTag.trim()) return;

    try {
      const { error } = await supabase
        .from('source_tags')
        .insert([{
          source_id: sourceId,
          tag_name: newTag.trim(),
          user_id: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (error) throw error;


      // Log the activity
      await supabase.rpc('log_activity', {
        p_action_type: 'tag_added',
        p_resource_type: 'tag',
        p_resource_id: null,
        p_resource_name: newTag.trim(),
        p_details: {
          source_id: sourceId,
          source_name: source?.name,
          tag_name: newTag.trim()
        }
      });

      setNewTag('');
      await loadSourceData();

      toast({
        title: "Tag Added",
        description: `Tag "${newTag}" has been added`,
      });
    } catch (error) {
      console.error('Error adding tag:', error);
      toast({
        title: "Error",
        description: "Failed to add tag",
        variant: "destructive",
      });
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('source_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;

      // Log the activity
      await supabase.rpc('log_activity', {
        p_action_type: 'tag_removed',
        p_resource_type: 'tag',
        p_resource_id: null,
        p_resource_name: 'Source Tag',
        p_details: {
          source_id: sourceId,
          source_name: source?.name,
          tag_id: tagId
        }
      });

      await loadSourceData();

      toast({
        title: "Tag Removed",
        description: "Tag has been removed",
      });
    } catch (error) {
      console.error('Error removing tag:', error);
      toast({
        title: "Error",
        description: "Failed to remove tag",
        variant: "destructive",
      });
    }
  };

  const getMonthlyCount = (yearMonth: string) => {
    const data = monthlyData.find(m => m.year_month === yearMonth);
    return data?.patient_count || 0;
  };

  const getTotalPatients = () => {
    return monthlyData.reduce((sum, m) => sum + (m.patient_count || 0), 0);
  };

  const getMonthlyTrend = () => {
    if (monthlyData.length < 2) return 'stable';
    const current = monthlyData[0]?.patient_count || 0;
    const previous = monthlyData[1]?.patient_count || 0;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
  };

  // Generate last 12 months for display
  const getLast12Months = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      months.push(yearMonth);
    }
    return months;
  };

  const getLastVisitDate = () => {
    if (marketingVisits.length === 0) return null;
    const lastVisit = marketingVisits.find(visit => visit.visited);
    return lastVisit ? new Date(lastVisit.visit_date) : null;
  };

  const isOfficeNotVisitedRecently = () => {
    if (source?.source_type !== 'Office') return false;
    const lastVisitDate = getLastVisitDate();
    if (!lastVisitDate) return true;
    const threeMonthsAgo = subMonths(new Date(), 3);
    return lastVisitDate < threeMonthsAgo;
  };

  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const handleEditSource = async () => {
    try {
      const { error } = await supabase
        .from('patient_sources')
        .update({
          name: editForm.name,
          address: editForm.address,
          phone: editForm.phone,
          email: editForm.email,
          website: editForm.website,
          notes: editForm.notes,
          latitude: editForm.latitude,
          longitude: editForm.longitude
        })
        .eq('id', sourceId);

      if (error) throw error;

      // Log the activity
      await supabase.rpc('log_activity', {
        p_action_type: 'source_updated',
        p_resource_type: 'source',
        p_resource_id: sourceId,
        p_resource_name: editForm.name,
        p_details: {
          updated_fields: {
            name: editForm.name !== source?.name,
            address: editForm.address !== source?.address,
            phone: editForm.phone !== source?.phone,
            email: editForm.email !== source?.email,
            website: editForm.website !== source?.website,
            notes: editForm.notes !== source?.notes
          }
        }
      });

      setIsEditing(false);
      await loadSourceData();

      toast({
        title: "Source Updated",
        description: "Source details have been updated successfully",
      });
    } catch (error) {
      console.error('Error updating source:', error);
      toast({
        title: "Error",
        description: "Failed to update source details",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    // Reset form to original source data
    if (source) {
      setEditForm({
        name: source.name || '',
        address: source.address || '',
        phone: source.phone || '',
        email: source.email || '',
        website: source.website || '',
        notes: source.notes || '',
        latitude: source.latitude,
        longitude: source.longitude
      });
    }
    setIsEditing(false);
  };

  const handleAddressSelect = (office: any) => {
    if (office) {
      setEditForm(prev => ({
        ...prev,
        name: office.name,
        address: office.address || '',
        latitude: office.latitude,
        longitude: office.longitude
      }));
    }
  };

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

  const config = SOURCE_TYPE_CONFIG[source.source_type];
  const trend = getMonthlyTrend();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl -z-10"></div>
          <div className="p-8 rounded-2xl border bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={onBack} className="hover:bg-primary/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sources
              </Button>
              <Badge 
                variant={source.is_active ? "default" : "secondary"}
                className="text-sm font-medium"
              >
                {source.is_active ? '🟢 Active' : '⭕ Inactive'}
              </Badge>
            </div>
            
            <div className="flex items-start gap-6">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border">
                <span className="text-3xl">{config.icon}</span>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-foreground">{source.name}</h1>
                  {isOfficeNotVisitedRecently() && (
                    <Badge variant="destructive" className="text-sm animate-pulse">
                      ⚠️ Visit Overdue
                    </Badge>
                  )}
                </div>
                <p className="text-lg text-muted-foreground font-medium">{config.label}</p>
                {source.address && (
                  <div className="flex items-center gap-2 mt-3 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{source.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="relative overflow-hidden border-2 hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/5"></div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                Total Patients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600 mb-2">{getTotalPatients()}</div>
              <p className="text-sm text-muted-foreground">All-time referrals</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-2 hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-green-600/5"></div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Calendar className="w-5 h-5 text-green-600" />
                </div>
                Current Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 mb-3">{getMonthlyCount(currentMonth)}</div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => adjustPatientCount(currentMonth, -1)}
                  disabled={getMonthlyCount(currentMonth) <= 0}
                  className="hover:bg-red-50 hover:border-red-300"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => adjustPatientCount(currentMonth, 1)}
                  className="hover:bg-green-50 hover:border-green-300"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-2 hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/5"></div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  {trend === 'up' ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : trend === 'down' ? (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  ) : (
                    <Activity className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                Monthly Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold mb-2",
                trend === 'up' ? "text-green-600" : trend === 'down' ? "text-red-600" : "text-purple-600"
              )}>
                {trend === 'up' ? '📈 Growing' : trend === 'down' ? '📉 Declining' : '📊 Stable'}
              </div>
              <p className="text-sm text-muted-foreground">vs. previous month</p>
            </CardContent>
          </Card>
        </div>

      {/* Details */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className={cn("grid w-full", source.source_type === 'Office' ? "grid-cols-5" : "grid-cols-4")} variant="underline">
          <TabsTrigger value="details" variant="underline">Details</TabsTrigger>
          <TabsTrigger value="monthly" variant="underline">Monthly History</TabsTrigger>
          <TabsTrigger value="changelog" variant="underline">Change Log</TabsTrigger>
          <TabsTrigger value="tags" variant="underline">Tags</TabsTrigger>
          {source.source_type === 'Office' && (
            <TabsTrigger value="visits" variant="underline">Marketing Visits</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {/* Source Information Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Building className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Source Information</h3>
                <p className="text-muted-foreground">Manage and update source details</p>
              </div>
            </div>
            <Button
              variant={isEditing ? "outline" : "default"}
              onClick={() => isEditing ? handleCancelEdit() : setIsEditing(true)}
              className="gap-2"
            >
              {isEditing ? (
                <>
                  <X className="w-4 h-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  Edit Details
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Source Name</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter source name"
                    />
                  ) : (
                    <p className="text-lg font-medium">{source.name || 'No name provided'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  {isEditing ? (
                    <div className="space-y-2">
                      <AddressSearch
                        value={editForm.address}
                        onSelect={handleAddressSelect}
                        placeholder="Search for address..."
                      />
                      <Textarea
                        id="address"
                        value={editForm.address}
                        onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Or enter address manually"
                        className="min-h-[60px]"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <p>{source.address || 'No address provided'}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  {isEditing ? (
                    <Textarea
                      id="notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Add any additional notes about this source"
                      className="min-h-[80px]"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {source.notes || 'No notes provided'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter phone number"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <p>{source.phone || 'No phone provided'}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  {isEditing ? (
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email address"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {source.email ? (
                        <a href={`mailto:${source.email}`} className="text-primary hover:underline">
                          {source.email}
                        </a>
                      ) : (
                        <p>No email provided</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  {isEditing ? (
                    <Input
                      id="website"
                      type="url"
                      value={editForm.website}
                      onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="Enter website URL"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      {source.website ? (
                        <a 
                          href={source.website} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline"
                        >
                          {source.website}
                        </a>
                      ) : (
                        <p>No website provided</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Location Information */}
          {(source.latitude && source.longitude) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Location Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Latitude</Label>
                    <p className="font-mono text-sm">{source.latitude}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Longitude</Label>
                    <p className="font-mono text-sm">{source.longitude}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Changes Button */}
          {isEditing && (
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button
                onClick={handleEditSource}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Patient History</CardTitle>
              <CardDescription>
                Months with daily entries show auto-calculated totals. Other months can be edited directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-center">Patient Count</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getLast12Months().map((yearMonth) => {
                    const count = getMonthlyCount(yearMonth);
                    return (
                      <MonthlyPatientRow
                        key={yearMonth}
                        sourceId={sourceId!}
                        yearMonth={yearMonth}
                        count={count}
                        onAdjust={adjustPatientCount}
                        onUpdate={updateMonthlyCount}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changelog" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Changes</CardTitle>
              <CardDescription>
                History of all patient count adjustments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-center">Change</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeLog.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.changed_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{formatYearMonth(log.year_month)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={(log.new_count - log.old_count) > 0 ? "default" : "destructive"}>
                          {(log.new_count - log.old_count) > 0 ? '+' : ''}{log.new_count - log.old_count}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.reason || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {changeLog.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No changes recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>
                Organize sources with custom tags
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a new tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                />
                <Button onClick={addTag} disabled={!newTag.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tag
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="py-1 px-3 flex items-center gap-2"
                  >
                    <Tag className="w-3 h-3" />
                    {tag.tag_name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeTag(tag.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              {tags.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No tags added yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Marketing Visits Tab */}
        {source.source_type === 'Office' && (
          <TabsContent value="visits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Marketing Visits ({marketingVisits.length})
                </CardTitle>
                <CardDescription>
                  Track visits and outreach activities for this office
                </CardDescription>
              </CardHeader>
              <CardContent>
                {marketingVisits.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No visits recorded</h3>
                    <p className="text-muted-foreground mb-4">
                      Start tracking your marketing visits to this office
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Rep</TableHead>
                          <TableHead>Visited</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Materials</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {marketingVisits.map((visit) => (
                          <TableRow key={visit.id}>
                            <TableCell>
                              {format(new Date(visit.visit_date), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{visit.visit_type}</Badge>
                              {visit.group_tag && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {visit.group_tag}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{visit.contact_person || '-'}</TableCell>
                            <TableCell>{visit.rep_name}</TableCell>
                            <TableCell>
                              <Badge variant={visit.visited ? "default" : "secondary"}>
                                {visit.visited ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                            <TableCell>{renderStars(visit.star_rating)}</TableCell>
                            <TableCell>
                              {visit.materials_handed_out && visit.materials_handed_out.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {visit.materials_handed_out.map((material: string) => (
                                    <Badge key={material} variant="outline" className="text-xs">
                                      {material}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {visit.follow_up_notes ? (
                                <div className="max-w-40 truncate" title={visit.follow_up_notes}>
                                  {visit.follow_up_notes}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      </div>
    </div>
  );
}