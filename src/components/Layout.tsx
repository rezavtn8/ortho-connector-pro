// src/components/Layout.tsx
import React from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/AppSidebar';
import { ErrorBoundary } from './ErrorBoundary';

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onPageChange?: (page: string) => void;
}

export function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        <ErrorBoundary level="section" fallback={
          <div className="w-64 bg-muted p-4 text-center border-r">
            <p className="text-sm text-muted-foreground">Navigation temporarily unavailable</p>
          </div>
        }>
          <AppSidebar currentPage={currentPage || 'dashboard'} onPageChange={onPageChange || (() => {})} />
        </ErrorBoundary>
        
        <main className="flex-1 flex flex-col">
          {/* Header with trigger */}
          <ErrorBoundary level="component" fallback={
            <header className="h-14 flex items-center border-b bg-card/50 backdrop-blur-sm px-4">
              <div className="text-sm text-muted-foreground">Header unavailable</div>
            </header>
          }>
            <header className="h-14 flex items-center border-b bg-card/50 backdrop-blur-sm px-4">
              <SidebarTrigger />
            </header>
          </ErrorBoundary>

          {/* Main Content */}
          <div className="flex-1 p-6">
            <ErrorBoundary level="section">
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}