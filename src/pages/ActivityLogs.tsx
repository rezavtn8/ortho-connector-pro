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

export function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchTerm, actionTypeFilter, resourceTypeFilter, dateFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Fetch activity logs
      const { data: activityData, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500); // Keep last 500 activities

      if (error) throw error;

      setLogs(activityData || []);
    } catch (error) {
      console.error('Error loading activity logs:', error);
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
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.resource_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Action type filter
    if (actionTypeFilter !== 'all') {
      filtered = filtered.filter(log => log.action_type === actionTypeFilter);
    }

    // Resource type filter
    if (resourceTypeFilter !== 'all') {
      filtered = filtered.filter(log => log.resource_type === resourceTypeFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(log => new Date(log.created_at) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(log => new Date(log.created_at) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(log => new Date(log.created_at) >= filterDate);
          break;
      }
    }

    setFilteredLogs(filtered);
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
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
      case 'patient_count_increased':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'patient_count_decreased':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'patient_count_updated':
        return <Edit3 className="w-4 h-4 text-blue-600" />;
      case 'import_completed':
        return <Upload className="w-4 h-4 text-purple-600" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (actionType: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'source_created': 'default',
      'source_deleted': 'destructive',
      'source_updated': 'secondary',
      'tag_added': 'default',
      'tag_removed': 'destructive',
      'patient_count_increased': 'default',
      'patient_count_decreased': 'destructive',
      'patient_count_updated': 'secondary',
      'import_completed': 'outline'
    };

    return (
      <Badge variant={variants[actionType] || 'secondary'} className="text-xs">
        {actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  const formatActionDescription = (log: ActivityLog) => {
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
    setResourceTypeFilter('all');
    setDateFilter('all');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Activity Logs</h1>
            <p className="text-muted-foreground">Track all system activities and changes</p>
          </div>
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
      {/* Compact Header with inline filters */}
      <div className="flex items-center justify-between gap-4 bg-muted/30 p-3 rounded-lg">
        <div>
          <h1 className="text-xl font-bold">All Activity</h1>
          <span className="text-xs text-muted-foreground">
            {filteredLogs.length} of {logs.length} activities
          </span>
        </div>
        
        {/* Inline Filters */}
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
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="source_created">Created</SelectItem>
              <SelectItem value="source_deleted">Deleted</SelectItem>
              <SelectItem value="source_updated">Updated</SelectItem>
              <SelectItem value="tag_added">Tag Added</SelectItem>
              <SelectItem value="tag_removed">Tag Removed</SelectItem>
              <SelectItem value="import_completed">Imported</SelectItem>
            </SelectContent>
          </Select>

          <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="source">Sources</SelectItem>
              <SelectItem value="tag">Tags</SelectItem>
              <SelectItem value="patient_count">Patients</SelectItem>
              <SelectItem value="import">Imports</SelectItem>
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
              {logs.length === 0 ? "No activity logs found" : "No activities match filters"}
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
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-20">Type</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => (
                  <tr 
                    key={log.id} 
                    className={`border-b hover:bg-muted/30 transition-colors ${
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    }`}
                  >
                    <td className="px-2 py-1.5 font-mono text-xs">
                      {format(new Date(log.created_at), 'MM/dd/yy')}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'HH:mm')}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center">
                        {getActionIcon(log.action_type)}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded capitalize">
                        {log.resource_type}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {formatActionDescription(log)}
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