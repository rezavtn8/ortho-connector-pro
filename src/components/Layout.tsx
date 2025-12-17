// src/components/Layout.tsx
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/AppSidebar';
import { ErrorBoundary } from './ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/daily-patients': 'Daily Patients',
  '/sources': 'Patient Sources',
  '/offices': 'Partner Offices',
  '/analytics': 'Reports',
  '/ai-assistant': 'AI Assistant',
  '/marketing-visits': 'Outreach Visits',
  '/campaigns': 'Campaigns',
  '/mailing-labels': 'Mailing Labels',
  '/discover': 'Find Offices',
  '/reviews': 'Reviews',
  '/review-magic': 'Review Magic',
  '/map-view': 'Map',
  '/help': 'Help & Guides',
  '/logs': 'Activity Logs',
  '/settings': 'Settings',
};

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const location = useLocation();
  const [clinicInfo, setClinicInfo] = useState<{ name: string; logo_url: string | null }>({ name: '', logo_url: null });

  // Get page title from current path
  const getPageTitle = () => {
    const path = location.pathname;
    if (pageTitles[path]) return pageTitles[path];
    if (path.startsWith('/sources/')) return 'Source Details';
    return '';
  };
  const pageTitle = getPageTitle();

  useEffect(() => {
    const loadClinicInfo = async () => {
      if (!user?.id) return;

      try {
        // Get user's clinic
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('clinic_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile?.clinic_id) {
          // Get clinic name
          const { data: clinic } = await supabase
            .from('clinics')
            .select('name')
            .eq('id', profile.clinic_id)
            .maybeSingle();

          // Get clinic logo
          const { data: brandSettings } = await supabase
            .from('clinic_brand_settings')
            .select('logo_url')
            .eq('clinic_id', profile.clinic_id)
            .maybeSingle();

          setClinicInfo({
            name: clinic?.name || 'Nexora',
            logo_url: brandSettings?.logo_url || null
          });
        }
      } catch (error) {
        console.error('Error loading clinic info:', error);
      }
    };

    loadClinicInfo();
  }, [user]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        <ErrorBoundary level="section" fallback={
          <div className="w-64 bg-muted p-4 text-center border-r">
            <p className="text-sm text-muted-foreground">Navigation temporarily unavailable</p>
          </div>
        }>
          <AppSidebar />
        </ErrorBoundary>
        
        <main className="flex-1 flex flex-col">
          {/* Mobile-optimized Header with trigger and title */}
          <ErrorBoundary level="component" fallback={
            <header className="h-14 flex items-center border-b bg-card/50 backdrop-blur-sm px-3 sm:px-4">
              <div className="text-sm text-muted-foreground">Header unavailable</div>
            </header>
          }>
            <header className="h-14 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm px-3 sm:px-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                {pageTitle && (
                  <h1 className="font-semibold text-lg text-foreground">{pageTitle}</h1>
                )}
              </div>
              <div className="flex items-center gap-3">
                {clinicInfo.logo_url && (
                  <img src={clinicInfo.logo_url} alt={clinicInfo.name} className="h-8 w-auto object-contain" />
                )}
                <span className="font-medium text-muted-foreground hidden sm:block">{clinicInfo.name || 'Nexora'}</span>
              </div>
            </header>
          </ErrorBoundary>

          {/* Mobile-optimized Main Content with responsive padding */}
          <div className="flex-1 p-3 sm:p-4 lg:p-6">
            <ErrorBoundary level="section">
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}