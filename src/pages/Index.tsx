import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { MarketingIncentives } from '@/pages/MarketingIncentives';
import { Offices } from '@/pages/Offices';
import { OfficeDiscovery } from '@/pages/OfficeDiscovery';
import { Settings } from '@/pages/Settings';
import { Map } from '@/pages/Map';
import { Analytics } from '@/pages/Analytics';

const Index = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

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
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'offices':
        return <Offices />;
      case 'map':
        return <Map />;
      case 'marketing':
        return <MarketingIncentives />;
      case 'discovery':
        return <OfficeDiscovery />;
      case 'analytics':
        return <Analytics />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
};

export default Index;
