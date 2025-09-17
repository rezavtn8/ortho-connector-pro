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
  Palette
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

interface AppSidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const mainNavItems = [
  { id: 'dashboard', title: 'Dashboard', icon: Home },
  { id: 'sources', title: 'Patient Sources', icon: Users },
  { id: 'offices', title: 'Partner Offices', icon: Building },
  { id: 'analytics', title: 'Reports', icon: TrendingUp },
  { id: 'ai-assistant', title: 'AI Assistant', icon: Bot },
  { id: 'creator', title: 'Creator', icon: Palette },
];

const managementItems = [
  { id: 'marketing-visits', title: 'Outreach Visits', icon: UserPlus },
  { id: 'campaigns', title: 'Campaigns', icon: Calendar },
  { id: 'discover', title: 'Find Offices', icon: Search },
  { id: 'reviews', title: 'Reviews', icon: MessageSquare },
  { id: 'map-view', title: 'Map', icon: MapPin },
];

const systemItems = [
  { id: 'logs', title: 'Activity Logs', icon: Activity },
  { id: 'settings', title: 'Settings', icon: Settings },
];

export function AppSidebar({ currentPage, onPageChange }: AppSidebarProps) {
  const { user, signOut } = useAuth();
  const { state, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();

  const isActive = (itemId: string) => currentPage === itemId;

  const getNavClass = (itemId: string) => 
    isActive(itemId) ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted/50";

  const handleSignOut = async () => {
    await signOut();
  };

  const handlePageChange = (page: string) => {
    onPageChange(page);
    // Auto-close sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false);
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
                    className={getNavClass(item.id)}
                  >
                    <button 
                      onClick={() => handlePageChange(item.id)}
                      className="flex items-center w-full min-h-[44px]"
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
                    className={getNavClass(item.id)}
                  >
                    <button 
                      onClick={() => handlePageChange(item.id)}
                      className="flex items-center w-full min-h-[44px]"
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
                    className={getNavClass(item.id)}
                  >
                    <button 
                      onClick={() => handlePageChange(item.id)}
                      className="flex items-center w-full min-h-[44px]"
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
            className="gap-1 min-h-[44px] shrink-0"
          >
            <LogOut className="w-4 h-4" />
            {!isCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}