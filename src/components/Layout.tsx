// src/components/Layout.tsx
import React from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/AppSidebar';
import { ErrorBoundary } from './ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBrand } from '@/contexts/BrandContext';
import { Building2 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const { settings } = useBrand();

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
            <header className="h-16 flex items-center justify-between border-b bg-gradient-to-r from-card/50 via-card/30 to-card/50 backdrop-blur-md px-3 sm:px-6 shadow-sm">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                {isMobile && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                      Nexora
                    </span>
                  </div>
                )}
              </div>
              
              {/* Phase 2: Enhanced Clinic Info Display */}
              <div className="flex items-center gap-3 bg-card/60 backdrop-blur-sm rounded-full px-4 py-2 border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/30">
                {settings.logo_url ? (
                  <div className="relative group">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <img 
                      src={settings.logo_url} 
                      alt={settings.brand_name || 'Clinic Logo'} 
                      className="relative h-9 w-9 object-contain rounded-full ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/10 hover:ring-primary/30 transition-all duration-300">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="hidden sm:flex flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold text-foreground leading-tight tracking-tight">
                    {settings.brand_name || 'Your Clinic'}
                  </span>
                  {settings.tagline && (
                    <span className="text-xs text-muted-foreground leading-tight">
                      {settings.tagline}
                    </span>
                  )}
                </div>
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