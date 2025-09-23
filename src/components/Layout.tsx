// src/components/Layout.tsx
import React from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/AppSidebar';
import { ErrorBoundary } from './ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();

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
                {isMobile && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">Nexora</span>
                  </div>
                )}
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