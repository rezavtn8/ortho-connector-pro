import React from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Activity, Settings, LogOut } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onPageChange?: (page: string) => void;
}

export function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  const { user, signOut } = useAuth();

  const navItems = [
    { 
      id: 'dashboard', 
      label: 'This Month', 
      icon: Calendar,
      path: '/'
    },
    { 
      id: 'analytics', 
      label: 'History & Analytics', 
      icon: Activity,
      path: '/analytics' 
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: Settings,
      path: '/settings' 
    }
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
                Patient Source Tracker
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
        {/* Navigation */}
        <div className="mb-6">
          <Tabs value={currentPage} onValueChange={onPageChange}>
            <TabsList className="grid w-full grid-cols-3 bg-card shadow-card">
              {navItems.map((item) => {
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

        {/* Main Content */}
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}