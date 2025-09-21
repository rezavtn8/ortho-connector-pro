import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sanitizeText } from '@/lib/sanitize';
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Lock, 
  User, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw,
  Download,
  Activity,
  Database,
  Globe
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecurityEvent {
  id: string;
  action_type: string;
  table_name: string | null;
  details: any;
  timestamp: string;
}

export function SecurityAuditLog() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedTab, setSelectedTab] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchSecurityEvents();
    const interval = setInterval(fetchSecurityEvents, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterEvents();
  }, [events, searchTerm, filterType, selectedTab]);

  const fetchSecurityEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching security events:', error);
      toast({
        title: "Error",
        description: "Failed to load security audit log.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = () => {
    let filtered = [...events];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.table_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(event.details).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(event => {
        switch (filterType) {
          case 'auth':
            return event.action_type.includes('LOGIN') || event.action_type.includes('AUTH');
          case 'data':
            return event.action_type.includes('SELECT') || event.action_type.includes('INSERT') || 
                   event.action_type.includes('UPDATE') || event.action_type.includes('DELETE');
          case 'security':
            return event.action_type.includes('RATE_LIMIT') || event.action_type.includes('FAILED');
          default:
            return true;
        }
      });
    }

    // Filter by tab
    if (selectedTab !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (selectedTab) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(event => new Date(event.timestamp) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(filterDate.getDate() - 7);
          filtered = filtered.filter(event => new Date(event.timestamp) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(filterDate.getMonth() - 1);
          filtered = filtered.filter(event => new Date(event.timestamp) >= filterDate);
          break;
      }
    }

    setFilteredEvents(filtered);
  };

  const exportAuditLog = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Timestamp,Action Type,Table Name,Details\n" +
      filteredEvents.map(event => 
        `"${formatTimestamp(event.timestamp)}","${event.action_type}","${event.table_name || ''}","${JSON.stringify(event.details).replace(/"/g, '""')}"`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `security_audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getEventIcon = (actionType: string) => {
    if (actionType.includes('LOGIN') || actionType.includes('AUTH')) {
      return <User className="w-4 h-4 text-primary" />;
    }
    if (actionType.includes('RATE_LIMIT')) {
      return <AlertTriangle className="w-4 h-4 text-warning" />;
    }
    if (actionType.includes('SELECT') || actionType.includes('VIEW')) {
      return <Eye className="w-4 h-4 text-info" />;
    }
    if (actionType.includes('UPDATE') || actionType.includes('INSERT') || actionType.includes('DELETE')) {
      return <Database className="w-4 h-4 text-accent" />;
    }
    if (actionType.includes('FAILED')) {
      return <AlertTriangle className="w-4 h-4 text-destructive" />;
    }
    return <Activity className="w-4 h-4 text-muted-foreground" />;
  };

  const getEventCategory = (actionType: string) => {
    if (actionType.includes('LOGIN') || actionType.includes('AUTH')) {
      return 'Authentication';
    }
    if (actionType.includes('RATE_LIMIT')) {
      return 'Security';
    }
    if (actionType.includes('SELECT') || actionType.includes('VIEW')) {
      return 'Data Access';
    }
    if (actionType.includes('UPDATE') || actionType.includes('INSERT') || actionType.includes('DELETE')) {
      return 'Data Modification';
    }
    if (actionType.includes('FAILED')) {
      return 'Security Violation';
    }
    return 'System';
  };

  const getEventBadgeVariant = (actionType: string): "default" | "secondary" | "destructive" | "outline" => {
    if (actionType.includes('RATE_LIMIT') || actionType.includes('FAILED')) {
      return 'destructive';
    }
    if (actionType.includes('UPDATE') || actionType.includes('DELETE')) {
      return 'outline';
    }
    if (actionType.includes('LOGIN') || actionType.includes('AUTH')) {
      return 'default';
    }
    return 'secondary';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Audit Log
          </CardTitle>
          <CardDescription>
            Loading security events...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security Audit Log
            </CardTitle>
            <CardDescription>
              Real-time security events and data access monitoring
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSecurityEvents}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportAuditLog}
              disabled={filteredEvents.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(sanitizeText(e.target.value))}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="auth">Authentication</SelectItem>
              <SelectItem value="data">Data Access</SelectItem>
              <SelectItem value="security">Security Issues</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
          <div className="text-center p-3 bg-card/50 rounded-lg border">
            <div className="text-2xl font-bold text-primary">{filteredEvents.length}</div>
            <div className="text-xs text-muted-foreground">Total Events</div>
          </div>
          <div className="text-center p-3 bg-card/50 rounded-lg border">
            <div className="text-2xl font-bold text-success">
              {filteredEvents.filter(e => e.action_type.includes('LOGIN')).length}
            </div>
            <div className="text-xs text-muted-foreground">Logins</div>
          </div>
          <div className="text-center p-3 bg-card/50 rounded-lg border">
            <div className="text-2xl font-bold text-info">
              {filteredEvents.filter(e => e.action_type.includes('SELECT')).length}
            </div>
            <div className="text-xs text-muted-foreground">Data Access</div>
          </div>
          <div className="text-center p-3 bg-card/50 rounded-lg border">
            <div className="text-2xl font-bold text-warning">
              {filteredEvents.filter(e => e.action_type.includes('RATE_LIMIT') || e.action_type.includes('FAILED')).length}
            </div>
            <div className="text-xs text-muted-foreground">Security Issues</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4" variant="default">
            <TabsTrigger value="all">All Time</TabsTrigger>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
          
          <TabsContent value={selectedTab} className="mt-0">
            <ScrollArea className="h-96">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No security events found for the selected criteria.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((event) => (
                    <div key={event.id} className="group flex items-start gap-3 p-4 border rounded-lg hover:bg-card/50 transition-colors">
                      <div className="flex-shrink-0 mt-1 p-2 rounded-full bg-background">
                        {getEventIcon(event.action_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={getEventBadgeVariant(event.action_type)} className="text-xs">
                              {event.action_type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {getEventCategory(event.action_type)}
                            </Badge>
                            {event.table_name && (
                              <Badge variant="secondary" className="text-xs">
                                {event.table_name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(event.timestamp)}
                          </div>
                        </div>
                        {event.details && (
                          <div className="mt-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded border">
                            <pre className="whitespace-pre-wrap font-mono overflow-x-auto">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}