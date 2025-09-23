// src/pages/Index.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { Layout } from '@/components/Layout';
import { LandingPage } from '@/components/LandingPage';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
import { Creator } from '@/pages/Creator';
import { useState } from 'react';

const Index = () => {
  const { user, loading } = useAuth();
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

  return (
    <Layout>
      <ErrorBoundary level="section">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
          <Route path="/sources/*" element={<Sources />} />
          <Route path="/sources/:sourceId/*" element={<SourceDetail />} />
          <Route path="/offices/*" element={<Offices />} />
          <Route path="/marketing-visits/*" element={<MarketingVisits />} />
          <Route path="/campaigns/*" element={<Campaigns />} />
          <Route path="/discover/*" element={<Discover />} />
          <Route path="/reviews/*" element={<Reviews />} />
          <Route path="/map-view/*" element={<MapView />} />
          <Route path="/analytics/*" element={<Analytics />} />
          <Route path="/ai-assistant/*" element={<AIAssistant />} />
          <Route path="/creator/*" element={<Creator />} />
          <Route path="/logs/*" element={<Logs />} />
          <Route path="/settings/*" element={<Settings />} />
        </Routes>
      </ErrorBoundary>
      <SessionTimeoutWarning />
    </Layout>
  );
};

export default Index;