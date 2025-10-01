import React from 'react';
import { 
  Home,
  Users, 
  TrendingUp,
  UserPlus,
  Settings,
  Activity,
  LogOut,
  Building,
  Calendar,
  MapPin,
  BarChart3,
  MessageSquare,
  Search,
  Bot,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { NexoraLogo } from '@/components/NexoraLogo';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePrefetch } from '@/hooks/usePrefetch';

const mainNavItems = [
  { id: 'dashboard', title: 'Dashboard', icon: Home, path: '/dashboard' },
  { id: 'sources', title: 'Patient Sources', icon: Users, path: '/sources' },
  { id: 'offices', title: 'Partner Offices', icon: Building, path: '/offices' },
  { id: 'analytics', title: 'Reports', icon: TrendingUp, path: '/analytics' },
  { id: 'ai-assistant', title: 'AI Assistant', icon: Bot, path: '/ai-assistant' },
  
];

const managementItems = [
  { id: 'marketing-visits', title: 'Outreach Visits', icon: UserPlus, path: '/marketing-visits' },
  { id: 'campaigns', title: 'Campaigns', icon: Calendar, path: '/campaigns' },
  { id: 'discover', title: 'Find Offices', icon: Search, path: '/discover' },
  { id: 'reviews', title: 'Reviews', icon: MessageSquare, path: '/reviews' },
  { id: 'map-view', title: 'Map', icon: MapPin, path: '/map-view' },
];

const systemItems = [
  { id: 'logs', title: 'Activity Logs', icon: Activity, path: '/logs' },
  { id: 'settings', title: 'Settings', icon: Settings, path: '/settings' },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { state, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    prefetchDashboardData, 
    prefetchOfficesList, 
    prefetchAnalytics, 
    prefetchCampaigns, 
    prefetchMarketingVisits 
  } = usePrefetch();

  const isActive = (path: string) => location.pathname === path;

  const getNavClass = (path: string) => 
    isActive(path) ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted/50";

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    // Auto-close sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleMouseEnter = (path: string) => {
    // Prefetch data based on the route
    switch (path) {
      case '/dashboard':
        prefetchDashboardData();
        break;
      case '/offices':
      case '/sources':
        prefetchOfficesList();
        break;
      case '/analytics':
        prefetchAnalytics();
        break;
      case '/campaigns':
        prefetchCampaigns();
        break;
      case '/marketing-visits':
        prefetchMarketingVisits();
        break;
    }
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center">
            <NexoraLogo size={24} className="text-foreground" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Nexora</span>
              <span className="text-xs text-muted-foreground">Dental Platform</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    asChild
                    className={getNavClass(item.path)}
                  >
                     <button 
                       onClick={() => handleNavigation(item.path)}
                       onMouseEnter={() => handleMouseEnter(item.path)}
                       className="flex items-center w-full min-h-[44px] transition-smooth"
                     >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    asChild
                    className={getNavClass(item.path)}
                  >
                     <button 
                       onClick={() => handleNavigation(item.path)}
                       onMouseEnter={() => handleMouseEnter(item.path)}
                       className="flex items-center w-full min-h-[44px] transition-smooth"
                     >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    asChild
                    className={getNavClass(item.path)}
                  >
                     <button 
                       onClick={() => handleNavigation(item.path)}
                       onMouseEnter={() => handleMouseEnter(item.path)}
                       className="flex items-center w-full min-h-[44px] transition-smooth"
                     >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3 sm:p-4">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1 mr-2">
              <span className="text-xs text-muted-foreground truncate">
                {user?.email}
              </span>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="gap-1 min-h-[44px] shrink-0 transition-smooth hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}