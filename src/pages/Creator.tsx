import React, { useState, useEffect } from 'react';
import { AIContentCreator } from '@/components/AIContentCreator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, 
  FileText, 
  MessageSquare, 
  Share2, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Palette,
  Wand2,
  Search,
  Plus,
  Heart,
  Mail,
  Phone,
  Users,
  Target,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

interface CreatorProps {
  onPageChange?: (page: string) => void;
  onSourceSelect?: (sourceId: string) => void;
}

interface ContentStats {
  totalContent: number;
  thisWeek: number;
  templates: number;
  aiGenerated: number;
}

interface RecentCreation {
  id: string;
  title: string;
  type: string;
  created_at: string;
  status: string;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  action: () => void;
}

export function Creator() {
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [contentStats, setContentStats] = useState<ContentStats>({
    totalContent: 0,
    thisWeek: 0,
    templates: 0,
    aiGenerated: 0
  });
  const [recentCreations, setRecentCreations] = useState<RecentCreation[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadBusinessProfile();
      loadContentStats();
      loadRecentCreations();
    }
  }, [user]);

  const loadBusinessProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-business-context', {
        body: { action: 'get' },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!error && data.profile) {
        setBusinessProfile(data.profile);
      }
    } catch (error: any) {
      console.error('Error loading business profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContentStats = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('id, created_at, content_type')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = {
        totalContent: data?.length || 0,
        thisWeek: data?.filter(item => new Date(item.created_at) > weekAgo).length || 0,
        templates: data?.filter(item => item.content_type?.includes('template')).length || 0,
        aiGenerated: data?.filter(item => item.content_type !== 'template').length || 0
      };

      setContentStats(stats);
    } catch (error) {
      console.error('Error loading content stats:', error);
    }
  };

  const loadRecentCreations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('id, generated_text, content_type, created_at, status')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const creations = data?.map(item => {
        let title = 'Untitled Content';
        try {
          const content = JSON.parse(item.generated_text);
          title = content.headline || content.title || title;
        } catch {
          // Keep default title if JSON parsing fails
        }
        
        return {
          id: item.id,
          title: title.length > 50 ? title.substring(0, 50) + '...' : title,
          type: item.content_type,
          created_at: item.created_at,
          status: item.status
        };
      }) || [];

      setRecentCreations(creations);
    } catch (error) {
      console.error('Error loading recent creations:', error);
    }
  };

  const quickActions: QuickAction[] = [
    {
      id: 'marketing-material',
      title: 'Marketing Materials',
      description: 'Create brochures, flyers, and promotional content',
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      action: () => setActiveTab('creator')
    },
    {
      id: 'patient-communications',
      title: 'Patient Communications',
      description: 'Welcome cards, thank you notes, announcements',
      icon: Heart,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50 hover:bg-pink-100',
      action: () => setActiveTab('creator')
    },
    {
      id: 'email-campaigns',
      title: 'Email Campaigns',
      description: 'Design engaging email newsletters and campaigns',
      icon: Mail,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      action: () => setActiveTab('creator')
    },
    {
      id: 'social-media',
      title: 'Social Media Posts',
      description: 'Create content for Facebook, Instagram, and more',
      icon: Share2,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      action: () => setActiveTab('creator')
    },
    {
      id: 'referral-materials',
      title: 'Referral Materials',
      description: 'Professional materials for referring practices',
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 hover:bg-orange-100',
      action: () => setActiveTab('creator')
    },
    {
      id: 'ai-assistant',
      title: 'AI Content Assistant',
      description: 'Chat with AI to brainstorm and create content',
      icon: Sparkles,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100',
      action: () => setActiveTab('creator')
    }
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'final': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="relative">
              <Palette className="h-12 w-12 text-primary" />
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Content Creator Suite
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            AI-powered tools to create professional marketing materials, patient communications, and engaging content for your practice
          </p>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="creator" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Create
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Library
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Content</p>
                        <p className="text-3xl font-bold text-slate-900">{contentStats.totalContent}</p>
                      </div>
                      <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">This Week</p>
                        <p className="text-3xl font-bold text-slate-900">{contentStats.thisWeek}</p>
                      </div>
                      <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">AI Generated</p>
                        <p className="text-3xl font-bold text-slate-900">{contentStats.aiGenerated}</p>
                      </div>
                      <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Templates Used</p>
                        <p className="text-3xl font-bold text-slate-900">{contentStats.templates}</p>
                      </div>
                      <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                        <Palette className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions Grid */}
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-6">What would you like to create?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {quickActions.map((action) => (
                    <Card 
                      key={action.id}
                      className={`cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all ${action.bgColor} group`}
                      onClick={action.action}
                    >
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className={`h-12 w-12 rounded-full ${action.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <action.icon className={`h-6 w-6 ${action.color}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900 mb-2">{action.title}</h3>
                            <p className="text-sm text-slate-600">{action.description}</p>
                          </div>
                          <Button variant="ghost" size="sm" className={`${action.color} hover:bg-white/50`}>
                            Get Started
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Recent Work */}
              {recentCreations.length > 0 && (
                <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent Work
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {recentCreations.map((creation) => (
                      <div key={creation.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900">{creation.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {creation.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(creation.created_at)}
                            </span>
                          </div>
                        </div>
                        <Badge className={`text-xs ${getStatusColor(creation.status)}`}>
                          {creation.status}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Creator Tab */}
            <TabsContent value="creator" className="space-y-6">
              <AIContentCreator businessProfile={businessProfile} />
            </TabsContent>

            {/* Library Tab */}
            <TabsContent value="library" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-slate-900">Content Library</h2>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search your content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button onClick={() => setActiveTab('creator')}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Content
                  </Button>
                </div>
              </div>

              {recentCreations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recentCreations
                    .filter(creation => 
                      searchQuery === '' || 
                      creation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      creation.type.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((creation) => (
                      <Card key={creation.id} className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <Badge variant="outline" className="text-xs">
                                {creation.type}
                              </Badge>
                              <Badge className={`text-xs ${getStatusColor(creation.status)}`}>
                                {creation.status}
                              </Badge>
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900 mb-2">{creation.title}</h3>
                              <p className="text-xs text-muted-foreground">
                                Created {formatDate(creation.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" className="flex-1">
                                View
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Heart className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              ) : (
                <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
                  <CardContent className="p-12 text-center">
                    <div className="space-y-4">
                      <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-2">No content yet</h3>
                        <p className="text-muted-foreground">Start creating content to see it appear in your library</p>
                      </div>
                      <Button onClick={() => setActiveTab('creator')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Content
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
