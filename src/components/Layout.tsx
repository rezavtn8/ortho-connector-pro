// src/components/Layout.tsx
import React from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from '@/components/AppSidebar';

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onPageChange?: (page: string) => void;
}

export function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        <AppSidebar currentPage={currentPage || 'dashboard'} onPageChange={onPageChange || (() => {})} />
        
        <div className="flex-1 flex flex-col">
          {/* Header with trigger */}
          <header className="h-14 flex items-center border-b bg-card/50 backdrop-blur-sm px-4">
            <SidebarTrigger />
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}