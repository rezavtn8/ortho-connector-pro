import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Zap, Calendar, TrendingUp } from 'lucide-react';

interface ContentDashboardProps {
  businessProfile?: any;
}

export function ContentDashboard({ businessProfile }: ContentDashboardProps) {
  const stats = [
    {
      title: 'Total Content',
      value: '24',
      change: '+12%',
      icon: FileText,
      color: 'text-blue-600',
    },
    {
      title: 'AI Generations',
      value: '156',
      change: '+8%',
      icon: Zap,
      color: 'text-purple-600',
    },
    {
      title: 'This Month',
      value: '12',
      change: '+25%',
      icon: Calendar,
      color: 'text-green-600',
    },
    {
      title: 'Engagement',
      value: '89%',
      change: '+5%',
      icon: TrendingUp,
      color: 'text-orange-600',
    },
  ];

  const recentContent = [
    {
      title: 'Welcome Brochure',
      type: 'Brochure',
      status: 'Published',
      date: '2 hours ago',
    },
    {
      title: 'Holiday Thank You Card',
      type: 'Card',
      status: 'Draft',
      date: '1 day ago',
    },
    {
      title: 'New Patient Welcome',
      type: 'Email',
      status: 'Published',
      date: '3 days ago',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-green-600 font-medium">
                    {stat.change} from last month
                  </p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">Recent Content</CardTitle>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentContent.map((content, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1">
                  <p className="font-medium">{content.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {content.type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {content.date}
                    </span>
                  </div>
                </div>
                <Badge
                  variant={content.status === 'Published' ? 'default' : 'outline'}
                  className="ml-4"
                >
                  {content.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}