import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Activity, 
  Search, 
  Calendar, 
  User, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Edit3,
  Filter,
  Clock,
  Plus,
  Trash2,
  Tag,
  Upload,
  Database,
  Building
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ActivityLog {
  id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  details: any;
  created_at: string;
}

interface PatientChangeLog {
  id: string;
  source_id: string;
  year_month: string;
  old_count: number;
  new_count: number;
  change_type: string;
  reason: string | null;
  changed_at: string;
  changed_by: string;
  user_id: string;
  source_name?: string;
}

export function Logs() {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [patientLogs, setPatientLogs] = useState<PatientChangeLog[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allLogs, searchTerm, actionTypeFilter, dateFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Fetch activity logs
      const { data: activityData, error: activityError } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(300);

      if (activityError) throw activityError;

      // Fetch patient change logs with source names
      const { data: patientData, error: patientError } = await supabase
        .from('patient_changes_log')
        .select(`
          *,
          patient_sources(name)
        `)
        .eq('user_id', user.id)
        .order('changed_at', { ascending: false })
        .limit(200);

      if (patientError) throw patientError;

      const processedPatientLogs = patientData?.map(log => ({
        ...log,
        source_name: log.patient_sources?.name || '[Deleted Source]'
      })) || [];

      setActivityLogs(activityData || []);
      setPatientLogs(processedPatientLogs);

      // Combine and sort all logs
      const combined = [
        ...(activityData || []).map(log => ({
          ...log,
          type: 'activity',
          timestamp: log.created_at
        })),
        ...processedPatientLogs.map(log => ({
          ...log,
          type: 'patient_change',
          timestamp: log.changed_at
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAllLogs(combined);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast({
        title: "Error",
        description: "Failed to load activity logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allLogs];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log => {
        const searchText = searchTerm.toLowerCase();
        if (log.type === 'activity') {
          return (
            log.resource_name?.toLowerCase().includes(searchText) ||
            log.action_type.toLowerCase().includes(searchText) ||
            JSON.stringify(log.details || {}).toLowerCase().includes(searchText)
          );
        } else {
          return (
            log.source_name?.toLowerCase().includes(searchText) ||
            log.reason?.toLowerCase().includes(searchText) ||
            log.year_month.includes(searchText)
          );
        }
      });
    }

    // Action type filter
    if (actionTypeFilter !== 'all') {
      if (actionTypeFilter === 'patient_changes') {
        filtered = filtered.filter(log => log.type === 'patient_change');
      } else {
        filtered = filtered.filter(log => 
          log.type === 'activity' && log.action_type === actionTypeFilter
        );
      }
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(log => new Date(log.timestamp) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(log => new Date(log.timestamp) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(log => new Date(log.timestamp) >= filterDate);
          break;
      }
    }

    setFilteredLogs(filtered);
  };

  const getActionIcon = (log: any) => {
    if (log.type === 'patient_change') {
      switch (log.change_type) {
        case 'increment':
          return <TrendingUp className="w-4 h-4 text-green-600" />;
        case 'decrement':
          return <TrendingDown className="w-4 h-4 text-red-600" />;
        case 'manual_edit':
          return <Edit3 className="w-4 h-4 text-blue-600" />;
        default:
          return <Activity className="w-4 h-4 text-muted-foreground" />;
      }
    }

    switch (log.action_type) {
      case 'source_created':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'source_deleted':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'source_updated':
        return <Edit3 className="w-4 h-4 text-blue-600" />;
      case 'tag_added':
        return <Tag className="w-4 h-4 text-green-600" />;
      case 'tag_removed':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'import_completed':
        return <Upload className="w-4 h-4 text-purple-600" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatLogDescription = (log: any) => {
    if (log.type === 'patient_change') {
      const diff = log.new_count - log.old_count;
      const monthYear = format(new Date(log.year_month + '-01'), 'MMM yyyy');
      
      if (diff > 0) {
        return `Increased patient count for ${log.source_name} (${monthYear}) from ${log.old_count} to ${log.new_count}`;
      } else if (diff < 0) {
        return `Decreased patient count for ${log.source_name} (${monthYear}) from ${log.old_count} to ${log.new_count}`;
      } else {
        return `Updated patient count for ${log.source_name} (${monthYear}) to ${log.new_count}`;
      }
    }

    const details = log.details || {};
    
    switch (log.action_type) {
      case 'source_created':
        if (details.method === 'import_discovered') {
          return `Added "${log.resource_name}" from discovered offices`;
        } else if (details.method?.includes('import_csv')) {
          return `Imported "${log.resource_name}" from CSV ${details.has_google_data ? 'with Google Places data' : ''}`;
        }
        return `Created source "${log.resource_name}"`;
      
      case 'source_deleted':
        return `Deleted source "${log.resource_name}"${details.total_deleted > 1 ? ` (${details.total_deleted} total)` : ''}`;
      
      case 'source_updated':
        const fields = Object.entries(details.updated_fields || {})
          .filter(([_, changed]) => changed)
          .map(([field, _]) => field);
        return `Updated ${fields.length > 0 ? fields.join(', ') : 'details'} for "${log.resource_name}"`;
      
      case 'tag_added':
        return `Added tag "${log.resource_name}" to ${details.source_name}`;
      
      case 'tag_removed':
        return `Removed tag from ${details.source_name}`;
      
      default:
        return `${log.action_type.replace(/_/g, ' ')} ${log.resource_name || log.resource_type}`;
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActionTypeFilter('all');
    setDateFilter('all');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-8 w-8 title-icon" />
            <h1 className="text-4xl font-bold page-title">Activity Logs</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Track all patient count changes and system activities
          </p>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading activity logs...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Activity Logs</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Track all patient count changes and system activities
        </p>
      </div>
      {/* Filters Section */}
      <div className="flex items-center justify-between gap-4 bg-muted/30 p-3 rounded-lg">
        <div>
          <span className="text-sm font-medium">All Activity</span>
          <span className="text-xs text-muted-foreground ml-2">
            ({filteredLogs.length} of {allLogs.length} activities)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-8 w-40 text-xs"
            />
          </div>
          
          <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="source_created">✨ Created</SelectItem>
              <SelectItem value="source_deleted">🗑️ Deleted</SelectItem>
              <SelectItem value="source_updated">✏️ Updated</SelectItem>
              <SelectItem value="tag_added">🏷️ Tag Added</SelectItem>
              <SelectItem value="tag_removed">🗑️ Tag Removed</SelectItem>
              <SelectItem value="patient_changes">📊 Patient Changes</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">7 Days</SelectItem>
              <SelectItem value="month">30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
            Clear
          </Button>
        </div>
      </div>

      {/* Compact Excel-style Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              {allLogs.length === 0 ? "No activity logs found" : "No activities match filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-24">Date</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-20">Time</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-16">Action</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => (
                  <tr 
                    key={`${log.type}-${log.id}`} 
                    className={`border-b hover:bg-muted/30 transition-colors ${
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    }`}
                  >
                    <td className="px-2 py-1.5 font-mono text-xs">
                      {format(new Date(log.timestamp), 'MM/dd/yy')}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), 'HH:mm')}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center">
                        {getActionIcon(log)}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {formatLogDescription(log)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}