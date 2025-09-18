import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  FileText, 
  Target, 
  BarChart3, 
  Users, 
  Heart, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap
} from 'lucide-react';

interface MarketingDashboardProps {
  businessProfile?: any;
}

export function MarketingDashboard({ businessProfile }: MarketingDashboardProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  const upcomingCampaigns = [
    {
      id: '1',
      title: 'Valentine\'s Day Whitening Special',
      type: 'Seasonal Promotion',
      status: 'scheduled',
      date: '2024-02-10',
      materials: 3,
      audience: 'All Active Patients'
    },
    {
      id: '2', 
      title: 'New Patient Welcome Series',
      type: 'Automated Sequence',
      status: 'active',
      date: 'Ongoing',
      materials: 5,
      audience: 'New Patients'
    },
    {
      id: '3',
      title: 'Dental Health Month Campaign',
      type: 'Educational',
      status: 'draft',
      date: '2024-02-01',
      materials: 7,
      audience: 'Community'
    }
  ];

  const quickStats = [
    {
      title: 'Active Campaigns',
      value: '3',
      change: '+2 this month',
      icon: Target,
      color: 'text-success'
    },
    {
      title: 'Materials Created',
      value: '24',
      change: '+12 this week',
      icon: FileText,
      color: 'text-info'
    },
    {
      title: 'Patient Engagement',
      value: '87%',
      change: '+5% from last month',
      icon: Heart,
      color: 'text-primary'
    },
    {
      title: 'ROI Increase',
      value: '23%',
      change: 'Since implementation',
      icon: TrendingUp,
      color: 'text-success'
    }
  ];

  const todaysTasks = [
    {
      id: '1',
      task: 'Review Valentine\'s campaign materials',
      priority: 'high',
      due: '2:00 PM',
      completed: false
    },
    {
      id: '2',
      task: 'Approve social media posts for this week',
      priority: 'medium', 
      due: '4:00 PM',
      completed: true
    },
    {
      id: '3',
      task: 'Update patient newsletter content',
      priority: 'low',
      due: 'Tomorrow',
      completed: false
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Marketing Command Center</h2>
          <p className="text-muted-foreground">Your complete marketing automation dashboard</p>
        </div>
        <div className="flex gap-2">
          <Button className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Quick Create
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index} className="bg-gradient-to-br from-card to-accent/5 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className={`text-xs ${stat.color}`}>{stat.change}</p>
                  </div>
                  <div className={`p-2 rounded-full bg-primary/10`}>
                    <IconComponent className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Campaigns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Marketing Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-muted/50 to-muted/20 border border-border/50 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm text-foreground">{campaign.title}</h4>
                      <Badge 
                        variant={campaign.status === 'active' ? 'default' : campaign.status === 'scheduled' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{campaign.type} • {campaign.date}</p>
                    <p className="text-xs text-muted-foreground">{campaign.materials} materials • {campaign.audience}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Today's Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todaysTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="mt-1">
                    {task.completed ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <div className={`h-4 w-4 rounded-full border-2 ${
                        task.priority === 'high' ? 'border-destructive' :
                        task.priority === 'medium' ? 'border-warning' :
                        'border-muted-foreground'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.task}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {task.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{task.due}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Campaign Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
              <div className="text-2xl font-bold text-success">156</div>
              <div className="text-sm text-muted-foreground">New Patients This Month</div>
              <div className="text-xs text-success">+23% from last month</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="text-2xl font-bold text-primary">89%</div>
              <div className="text-sm text-muted-foreground">Email Open Rate</div>
              <div className="text-xs text-primary">Above industry average</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-gradient-to-br from-info/10 to-info/5 border border-info/20">
              <div className="text-2xl font-bold text-info">$12,400</div>
              <div className="text-sm text-muted-foreground">Revenue from Campaigns</div>
              <div className="text-xs text-info">This month</div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              View Detailed Analytics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}