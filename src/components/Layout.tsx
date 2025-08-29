// src/components/Layout.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { 
  Building2, 
  LogOut, 
  Users, 
  BarChart3, 
  Settings,
  Home,
  UserPlus,
  Activity,
  Database,
  TrendingUp,
  Calendar,
  MapPin
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onPageChange?: (page: string) => void;
}

export function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  const { user, signOut } = useAuth();

  // Organize navigation into categories
  const mainNavigation = [
    { id: 'dashboard', label: 'Overview', icon: Home, category: 'main' },
    { id: 'sources', label: 'Sources', icon: Users, category: 'main' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, category: 'main' },
  ];

  const managementNavigation = [
    { id: 'add-source', label: 'Add Source', icon: UserPlus, category: 'management' },
    { id: 'data-management', label: 'Data Management', icon: Database, category: 'management' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, category: 'management' },
  ];

  const systemNavigation = [
    { id: 'settings', label: 'Settings', icon: Settings, category: 'system' },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Patient Source Intelligence
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Navigation Tabs */}
        <div className="mb-6">
          <Tabs value={currentPage} onValueChange={onPageChange}>
            <TabsList className="grid w-full grid-cols-3 bg-card shadow-card">
              {mainNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger 
                    key={item.id} 
                    value={item.id}
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex gap-6">
          {/* Secondary Navigation Sidebar */}
          <div className="w-64 space-y-4">
            {/* Management Tools */}
            <Card className="bg-gradient-card shadow-card">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Management</h3>
                <nav className="space-y-1">
                  {managementNavigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        variant={currentPage === item.id ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => onPageChange?.(item.id)}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>

            {/* System Settings */}
            <Card className="bg-gradient-card shadow-card">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">System</h3>
                <nav className="space-y-1">
                  {systemNavigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        variant={currentPage === item.id ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => onPageChange?.(item.id)}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}