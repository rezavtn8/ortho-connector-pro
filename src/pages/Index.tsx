// src/pages/Index.tsx
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { Layout } from '@/components/Layout';
import { LandingPage } from '@/components/LandingPage';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { Dashboard } from '@/pages/Dashboard';
import { Sources } from '@/pages/Sources';
import { Offices } from '@/pages/Offices';
import { MarketingVisits } from '@/pages/MarketingVisits';
import { Campaigns } from '@/pages/Campaigns';
import { Settings } from '@/pages/Settings';
import { Analytics } from '@/pages/Analytics';
import { SourceDetail } from '@/pages/SourceDetail';
import { MapView } from '@/pages/MapView';
import { Reviews } from '@/pages/Reviews';
import { Discover } from '@/pages/Discover';
import { Logs } from '@/pages/Logs';
import { AIAssistant } from '@/pages/AIAssistant';

const Index = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

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
    return <LandingPage onGetStarted={() => setShowAuth(true)} showAuth={showAuth} />;
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
      case 'offices':
        return <Offices />;
      case 'marketing-visits':
        return <MarketingVisits />;
      case 'campaigns':
        return <Campaigns />;
      case 'discover':
        return <Discover />;
      case 'reviews':
        return <Reviews />;
      case 'map-view':
        return <MapView />;
      case 'analytics':
        return <Analytics />;
      case 'ai-assistant':
        return <AIAssistant />;
      case 'logs':
        return <Logs />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
      <SessionTimeoutWarning />
    </Layout>
  );
};

export default Index;