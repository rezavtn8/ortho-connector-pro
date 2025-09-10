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

      // Fetch all logs with source names (keep forever - no limit)
      const { data: logsData, error } = await supabase
        .from('patient_changes_log')
        .select(`
          *,
          patient_sources(name)
        `)
        .eq('user_id', user.id)
        .order('changed_at', { ascending: false });

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
    <div className="space-y-3 animate-fade-in">
      {/* Compact Header with inline filters */}
      <div className="flex items-center justify-between gap-4 bg-muted/30 p-3 rounded-lg">
        <div>
          <h1 className="text-xl font-bold">Activity Logs</h1>
          <span className="text-xs text-muted-foreground">
            {filteredLogs.length} of {logs.length} records
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
          
          <Select value={changeTypeFilter} onValueChange={setChangeTypeFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="increment">↑ Increase</SelectItem>
              <SelectItem value="decrement">↓ Decrease</SelectItem>
              <SelectItem value="manual_edit">✏️ Edit</SelectItem>
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
              {logs.length === 0 ? "No activity logs found" : "No logs match filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-24">Date</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-20">Time</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Source</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-16">Change</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-20">From</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-20">To</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-20">Month</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Reason</th>
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
                      {format(new Date(log.changed_at), 'MM/dd/yy')}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                      {format(new Date(log.changed_at), 'HH:mm')}
                    </td>
                    <td className="px-2 py-1.5 font-medium truncate max-w-32" title={log.source_name}>
                      {log.source_name}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center">
                        {getChangeIcon(log.change_type, log.old_count, log.new_count)}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono">
                      {log.old_count}
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono font-medium">
                      {log.new_count}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {format(new Date(log.year_month + '-01'), 'MM/yy')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground truncate max-w-40" title={log.reason || 'No reason provided'}>
                      {log.reason || '-'}
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