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
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [logs, setLogs] = useState<PatientChangeLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<PatientChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [changeTypeFilter, setChangeTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchTerm, changeTypeFilter, dateFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Fetch logs with source names (using left join to preserve logs even if source is deleted)
      const { data: logsData, error } = await supabase
        .from('patient_changes_log')
        .select(`
          *,
          patient_sources(name)
        `)
        .eq('user_id', user.id)
        .order('changed_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const processedLogs = logsData?.map(log => ({
        ...log,
        source_name: log.patient_sources?.name || '[Deleted Source]'
      })) || [];

      setLogs(processedLogs);
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
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.source_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.year_month.includes(searchTerm)
      );
    }

    // Change type filter
    if (changeTypeFilter !== 'all') {
      filtered = filtered.filter(log => log.change_type === changeTypeFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(log => new Date(log.changed_at) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(log => new Date(log.changed_at) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(log => new Date(log.changed_at) >= filterDate);
          break;
      }
    }

    setFilteredLogs(filtered);
  };

  const getChangeIcon = (changeType: string, oldCount: number, newCount: number) => {
    switch (changeType) {
      case 'increment':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'decrement':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'manual_edit':
        return <Edit3 className="w-4 h-4 text-blue-600" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getChangeBadge = (changeType: string, oldCount: number, newCount: number) => {
    const diff = newCount - oldCount;
    const isIncrease = diff > 0;
    const isDecrease = diff < 0;

    if (isIncrease) {
      return (
        <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
          +{diff}
        </Badge>
      );
    } else if (isDecrease) {
      return (
        <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
          {diff}
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
          No change
        </Badge>
      );
    }
  };

  const formatChangeDescription = (log: PatientChangeLog) => {
    const diff = log.new_count - log.old_count;
    const monthYear = format(new Date(log.year_month + '-01'), 'MMM yyyy');
    
    if (diff > 0) {
      return `Increased patient count for ${monthYear} from ${log.old_count} to ${log.new_count}`;
    } else if (diff < 0) {
      return `Decreased patient count for ${monthYear} from ${log.old_count} to ${log.new_count}`;
    } else {
      return `Updated patient count for ${monthYear} (no change: ${log.new_count})`;
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setChangeTypeFilter('all');
    setDateFilter('all');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Activity Logs</h1>
            <p className="text-muted-foreground">Track all patient count changes and system activities</p>
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground">Track all patient count changes and system activities</p>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {filteredLogs.length} of {logs.length} records
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Source name, reason, month..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Change Type</label>
              <Select value={changeTypeFilter} onValueChange={setChangeTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="increment">Increments</SelectItem>
                  <SelectItem value="decrement">Decrements</SelectItem>
                  <SelectItem value="manual_edit">Manual Edits</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {logs.length === 0 
                  ? "No activity logs found" 
                  : "No logs match your current filters"
                }
              </p>
              {logs.length > 0 && (
                <Button variant="outline" onClick={clearFilters} className="mt-4">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className="animate-fade-in">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-sm">
                            {format(new Date(log.changed_at), 'MMM d, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.changed_at), 'h:mm a')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.changed_at), { addSuffix: true })}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-medium">{log.source_name}</div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getChangeIcon(log.change_type, log.old_count, log.new_count)}
                          {getChangeBadge(log.change_type, log.old_count, log.new_count)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {formatChangeDescription(log)}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline">
                          {format(new Date(log.year_month + '-01'), 'MMM yyyy')}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {log.reason || 'No reason provided'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}