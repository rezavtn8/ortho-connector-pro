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
  getCurrentYearMonth,
  formatYearMonth
} from '@/lib/database.types';
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
  Tag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function SourceDetail() {
  const { id: sourceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const onBack = () => navigate(-1);
  const [source, setSource] = useState<PatientSource | null>(null);
  const [tags, setTags] = useState<SourceTag[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPatients[]>([]);
  const [changeLog, setChangeLog] = useState<PatientChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [newTag, setNewTag] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
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

      setSource(sourceData);
      setTags(tagsData || []);
      setMonthlyData(monthlyDataResult || []);
      setChangeLog(changeLogData || []);
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

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to add tags",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('source_tags')
        .insert([{
          source_id: sourceId,
          tag_name: newTag.trim(),
          user_id: user.id
        }]);

      if (error) throw error;

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
    return monthlyData.reduce((sum, m) => sum + m.patient_count, 0);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span>{config.icon}</span>
              {source.name}
            </h1>
            <p className="text-muted-foreground">{config.label}</p>
          </div>
        </div>
        <Badge variant={source.is_active ? "default" : "secondary"}>
          {source.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Total Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{getTotalPatients()}</div>
            <p className="text-sm text-muted-foreground">All-time referrals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Current Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {getMonthlyCount(currentMonth)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => adjustPatientCount(currentMonth, -1)}
                disabled={getMonthlyCount(currentMonth) <= 0}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => adjustPatientCount(currentMonth, 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {trend === 'up' ? <TrendingUp className="w-5 h-5 text-green-600" /> :
               trend === 'down' ? <TrendingDown className="w-5 h-5 text-red-600" /> :
               <Minus className="w-5 h-5 text-gray-400" />}
              Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {trend === 'up' ? 'Increasing' :
               trend === 'down' ? 'Decreasing' :
               'Stable'}
            </div>
            <p className="text-sm text-muted-foreground">vs. last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="monthly">Monthly History</TabsTrigger>
          <TabsTrigger value="changelog">Change Log</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {source.address && (
                <div>
                  <Label className="text-sm text-muted-foreground">Address</Label>
                  <p>{source.address}</p>
                </div>
              )}
              {source.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{source.phone}</span>
                </div>
              )}
              {source.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${source.email}`} className="text-primary hover:underline">
                    {source.email}
                  </a>
                </div>
              )}
              {source.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <a href={source.website} target="_blank" rel="noopener noreferrer" 
                     className="text-primary hover:underline">
                    {source.website}
                  </a>
                </div>
              )}
              {source.notes && (
                <div>
                  <Label className="text-sm text-muted-foreground">Notes</Label>
                  <p className="whitespace-pre-wrap">{source.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Patient History</CardTitle>
              <CardDescription>
                Click on any count to edit it directly
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
                    const isEditing = editingMonth === yearMonth;

                    return (
                      <TableRow key={yearMonth}>
                        <TableCell>{formatYearMonth(yearMonth)}</TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                className="w-20"
                                min="0"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateMonthlyCount(yearMonth, editValue)}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingMonth(null)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingMonth(yearMonth);
                                setEditValue(count);
                              }}
                              className="font-semibold"
                            >
                              {count}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => adjustPatientCount(yearMonth, -1)}
                              disabled={count <= 0}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => adjustPatientCount(yearMonth, 1)}
                            >
                              <Plus className="w-4 h-4" />
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
      </Tabs>
    </div>
  );
}

// Add missing Label component import
import { Label } from '@/components/ui/label';