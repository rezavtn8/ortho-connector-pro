// src/pages/Index.tsx
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Sources } from '@/pages/Sources';
import { AddSource } from '@/pages/AddSource';
import { Settings } from '@/pages/Settings';
import { Analytics } from '@/pages/Analytics';
import { SourceDetail } from '@/pages/SourceDetail';

const Index = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const renderPage = () => {
    // Handle source detail view
    if (currentPage === 'source-detail' && selectedSourceId) {
      return <SourceDetail />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'sources':
        return <Sources />;
      case 'add-source':
        return <AddSource onSuccess={() => setCurrentPage('sources')} />;
      case 'analytics':
        return <Analytics />;
      case 'data-management':
        return <DataManagement />;
      case 'calendar':
        return <CalendarView />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  // Placeholder components for new pages
  const DataManagement = () => (
    <div className="space-y-6">
      <div className="bg-card rounded-lg p-6 shadow-card">
        <h2 className="text-2xl font-bold mb-4">Data Management</h2>
        <p className="text-muted-foreground">Manage patient data, imports, and exports.</p>
      </div>
    </div>
  );

  const CalendarView = () => (
    <div className="space-y-6">
      <div className="bg-card rounded-lg p-6 shadow-card">
        <h2 className="text-2xl font-bold mb-4">Calendar</h2>
        <p className="text-muted-foreground">Schedule and track source visits and activities.</p>
      </div>
    </div>
  );

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
};

export default Index;