import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle, Eye, Lock, User, Clock } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSecurityEvents();
  }, []);

  const fetchSecurityEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

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

  const getEventIcon = (actionType: string) => {
    if (actionType.includes('LOGIN') || actionType.includes('AUTH')) {
      return <User className="w-4 h-4" />;
    }
    if (actionType.includes('RATE_LIMIT')) {
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    }
    if (actionType.includes('SELECT') || actionType.includes('VIEW')) {
      return <Eye className="w-4 h-4" />;
    }
    if (actionType.includes('UPDATE') || actionType.includes('INSERT') || actionType.includes('DELETE')) {
      return <Lock className="w-4 h-4" />;
    }
    return <Shield className="w-4 h-4" />;
  };

  const getEventBadgeVariant = (actionType: string): "default" | "secondary" | "destructive" | "outline" => {
    if (actionType.includes('RATE_LIMIT') || actionType.includes('FAILED')) {
      return 'destructive';
    }
    if (actionType.includes('UPDATE') || actionType.includes('DELETE')) {
      return 'outline';
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
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Security Audit Log
        </CardTitle>
        <CardDescription>
          Recent security events and data access logs for your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No security events recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0 mt-0.5">
                    {getEventIcon(event.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getEventBadgeVariant(event.action_type)} className="text-xs">
                        {event.action_type}
                      </Badge>
                      {event.table_name && (
                        <Badge variant="outline" className="text-xs">
                          {event.table_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(event.timestamp)}
                    </div>
                    {event.details && (
                      <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <pre className="whitespace-pre-wrap">
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
      </CardContent>
    </Card>
  );
}