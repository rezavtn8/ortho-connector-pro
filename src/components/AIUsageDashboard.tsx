import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Bot,
  DollarSign,
  Clock,
  TrendingUp,
  Mail,
  MessageSquare,
  FileText,
  Star
} from 'lucide-react';

interface UsageStats {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  averageExecutionTime: number;
  successRate: number;
  taskBreakdown: { task_type: string; count: number; cost: number }[];
  dailyUsage: { date: string; requests: number; cost: number }[];
  qualityRatings: { rating: number; count: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function AIUsageDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    loadUsageStats();
  }, [user, timeRange]);

  const loadUsageStats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data: usageData, error } = await supabase
        .from('ai_usage_tracking')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const totalRequests = usageData.length;
      const totalCost = usageData.reduce((sum, item) => sum + (item.estimated_cost || 0), 0);
      const totalTokens = usageData.reduce((sum, item) => sum + (item.tokens_used || 0), 0);
      const averageExecutionTime = usageData.length > 0 
        ? usageData.reduce((sum, item) => sum + (item.execution_time_ms || 0), 0) / usageData.length
        : 0;
      const successCount = usageData.filter(item => item.success).length;
      const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

      // Task breakdown
      const taskBreakdown = usageData.reduce((acc: any[], item) => {
        const existing = acc.find(t => t.task_type === item.task_type);
        if (existing) {
          existing.count += 1;
          existing.cost += item.estimated_cost || 0;
        } else {
          acc.push({
            task_type: item.task_type,
            count: 1,
            cost: item.estimated_cost || 0
          });
        }
        return acc;
      }, []);

      // Daily usage
      const dailyUsage = usageData.reduce((acc: any[], item) => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        const existing = acc.find(d => d.date === date);
        if (existing) {
          existing.requests += 1;
          existing.cost += item.estimated_cost || 0;
        } else {
          acc.push({
            date,
            requests: 1,
            cost: item.estimated_cost || 0
          });
        }
        return acc;
      }, []).sort((a, b) => a.date.localeCompare(b.date));

      // Quality ratings
      const qualityRatings = usageData
        .filter(item => item.quality_rating)
        .reduce((acc: any[], item) => {
          const existing = acc.find(r => r.rating === item.quality_rating);
          if (existing) {
            existing.count += 1;
          } else {
            acc.push({
              rating: item.quality_rating,
              count: 1
            });
          }
          return acc;
        }, [])
        .sort((a, b) => a.rating - b.rating);

      setStats({
        totalRequests,
        totalCost,
        totalTokens,
        averageExecutionTime,
        successRate,
        taskBreakdown,
        dailyUsage,
        qualityRatings
      });

    } catch (error: any) {
      console.error('Error loading usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'email_generation':
        return <Mail className="h-4 w-4" />;
      case 'review_response':
        return <MessageSquare className="h-4 w-4" />;
      case 'content_creation':
        return <FileText className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No AI Usage Data</h3>
          <p className="text-muted-foreground">
            Start using AI features to see your usage statistics here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Usage Dashboard</h2>
          <p className="text-muted-foreground">Monitor your AI assistant usage and performance</p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map((range) => (
            <Badge
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setTimeRange(range)}
            >
              {range}
            </Badge>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Bot className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats.totalRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">{Math.round(stats.averageExecutionTime)}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
              </div>
              <div className="ml-auto">
                <Progress value={stats.successRate} className="w-12" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="requests" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Usage by Task Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.taskBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="task_type"
                >
                  {stats.taskBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Task Details */}
      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.taskBreakdown.map((task) => (
              <div key={task.task_type} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getTaskIcon(task.task_type)}
                  <div>
                    <p className="font-medium capitalize">{task.task_type.replace('_', ' ')}</p>
                    <p className="text-sm text-muted-foreground">{task.count} requests</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(task.cost)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(task.cost / task.count)}/request
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quality Ratings */}
      {stats.qualityRatings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Quality Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.qualityRatings.map((rating) => (
                <div key={rating.rating} className="flex items-center gap-4">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < rating.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex-1">
                    <Progress value={(rating.count / stats.qualityRatings.reduce((sum, r) => sum + r.count, 0)) * 100} />
                  </div>
                  <span className="text-sm text-muted-foreground w-12">{rating.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}