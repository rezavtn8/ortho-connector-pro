// src/pages/Index.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { Layout } from '@/components/Layout';
import { LandingPage } from '@/components/LandingPage';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SuspenseWrapper } from '@/components/SuspenseWrapper';
import { usePrefetch } from '@/hooks/usePrefetch';
import { Dashboard } from '@/pages/Dashboard';
import { Sources } from '@/pages/Sources';
import { Offices } from '@/pages/Offices';
import { MarketingVisits } from '@/pages/MarketingVisits';
import Campaigns from '@/pages/Campaigns';
import { Settings } from '@/pages/Settings';
import { Analytics } from '@/pages/Analytics';
import { SourceDetail } from '@/pages/SourceDetail';
import { MapView } from '@/pages/MapView';
import { Reviews } from '@/pages/Reviews';
import { Discover } from '@/pages/Discover';
import { Logs } from '@/pages/Logs';
import { AIAssistant } from '@/pages/AIAssistant';

import { useState } from 'react';

const Index = () => {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const { prefetchDashboardData, prefetchOfficesList, prefetchAnalytics, prefetchCampaigns } = usePrefetch();

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
          <Route 
            path="/dashboard/*" 
            element={
              <SuspenseWrapper type="page">
                <Dashboard />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/sources/*" 
            element={
              <SuspenseWrapper type="page">
                <Sources />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/sources/:sourceId/*" 
            element={
              <SuspenseWrapper type="page">
                <SourceDetail />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/offices/*" 
            element={
              <SuspenseWrapper type="page">
                <Offices />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/marketing-visits/*" 
            element={
              <SuspenseWrapper type="page">
                <MarketingVisits />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/campaigns/*" 
            element={
              <SuspenseWrapper type="page">
                <Campaigns />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/discover/*" 
            element={
              <SuspenseWrapper type="page">
                <Discover />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/reviews/*" 
            element={
              <SuspenseWrapper type="page">
                <Reviews />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/map-view/*" 
            element={
              <SuspenseWrapper type="page">
                <MapView />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/analytics/*" 
            element={
              <SuspenseWrapper type="page">
                <Analytics />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/ai-assistant/*" 
            element={
              <SuspenseWrapper type="page">
                <AIAssistant />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/logs/*" 
            element={
              <SuspenseWrapper type="page">
                <Logs />
              </SuspenseWrapper>
            } 
          />
          <Route 
            path="/settings/*" 
            element={
              <SuspenseWrapper type="page">
                <Settings />
              </SuspenseWrapper>
            } 
          />
        </Routes>
      </ErrorBoundary>
      <SessionTimeoutWarning />
    </Layout>
  );
};

export default Index;