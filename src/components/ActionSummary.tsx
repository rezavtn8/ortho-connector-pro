import React from 'react';
import { Clock, Calendar, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ActionSummary() {
  const immediateActions = [
    { action: 'Contact Manhattan Dental Group', priority: 'high', type: 'outreach' },
    { action: 'Follow up on 3 pending campaigns', priority: 'medium', type: 'campaign' },
    { action: 'Review Brooklyn Smiles relationship', priority: 'high', type: 'relationship' }
  ];

  const thisWeekActions = [
    { action: 'Schedule visits to 5 top referrers', priority: 'medium', type: 'visit' },
    { action: 'Analyze competitor movements', priority: 'low', type: 'analysis' },
    { action: 'Update contact info for 12 offices', priority: 'medium', type: 'data' }
  ];

  const thisMonthActions = [
    { action: 'Launch targeted campaign in Queens', priority: 'high', type: 'campaign' },
    { action: 'Evaluate network gaps in specialty care', priority: 'medium', type: 'strategy' },
    { action: 'Quarterly performance review', priority: 'medium', type: 'review' }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'medium': return 'bg-warning/20 text-warning border-warning/30';
      case 'low': return 'bg-success/20 text-success border-success/30';
      default: return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  const ActionColumn = ({ 
    title, 
    icon: Icon, 
    actions, 
    colorClass 
  }: { 
    title: string; 
    icon: React.ElementType; 
    actions: typeof immediateActions;
    colorClass: string;
  }) => (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className={`p-2 rounded-lg ${colorClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {actions.map((item, index) => (
            <div key={index} className="p-3 bg-gradient-card rounded-lg border hover:shadow-card transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium leading-relaxed">{item.action}</p>
                <Badge 
                  variant="outline" 
                  className={`${getPriorityColor(item.priority)} text-xs flex-shrink-0`}
                >
                  {item.priority}
                </Badge>
              </div>
              <Badge variant="secondary" className="text-xs">
                {item.type}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground mb-2">Action Summary</h3>
        <p className="text-muted-foreground">Prioritized recommendations based on your data</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ActionColumn
          title="Immediate Actions"
          icon={Clock}
          actions={immediateActions}
          colorClass="bg-destructive/10 text-destructive"
        />
        <ActionColumn
          title="This Week"
          icon={Calendar}
          actions={thisWeekActions}
          colorClass="bg-warning/10 text-warning"
        />
        <ActionColumn
          title="This Month"
          icon={CalendarDays}
          actions={thisMonthActions}
          colorClass="bg-success/10 text-success"
        />
      </div>
    </div>
  );
}