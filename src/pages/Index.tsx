// src/pages/Index.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/AuthForm';
import { Layout } from '@/components/Layout';
import { LandingPage } from '@/components/LandingPage';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { PageErrorBoundary } from '@/components/AppErrorBoundary';
import { SuspenseWrapper } from '@/components/SuspenseWrapper';
import { usePrefetch } from '@/hooks/usePrefetch';
import { Dashboard } from '@/pages/Dashboard';
import { Sources } from '@/pages/Sources';
import { Offices } from '@/pages/Offices';
import { MarketingVisits } from '@/pages/MarketingVisits';
import { Campaigns } from '@/pages/Campaigns';
import { Settings } from '@/pages/Settings';
import Analytics from '@/pages/Analytics';
import { SourceDetail } from '@/pages/SourceDetail';
import { MapView } from '@/pages/MapView';
import { Reviews } from '@/pages/Reviews';
import { Discover } from '@/pages/Discover';
import { Logs } from '@/pages/Logs';
import AIAssistant from '@/pages/AIAssistant';

import { useState } from 'react';

// Helper component to wrap routes with error boundaries
const ProtectedRoute = ({ 
  children, 
  pageName 
}: { 
  children: React.ReactNode; 
  pageName: string; 
}) => (
  <PageErrorBoundary pageName={pageName}>
    <SuspenseWrapper type="page">
      {children}
    </SuspenseWrapper>
  </PageErrorBoundary>
);

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
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route 
          path="/dashboard/*" 
          element={
            <ProtectedRoute pageName="Dashboard">
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sources/*" 
          element={
            <ProtectedRoute pageName="Sources">
              <Sources />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sources/:sourceId/*" 
          element={
            <ProtectedRoute pageName="Source Detail">
              <SourceDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/offices/*" 
          element={
            <ProtectedRoute pageName="Offices">
              <Offices />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/marketing-visits/*" 
          element={
            <ProtectedRoute pageName="Marketing Visits">
              <MarketingVisits />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/campaigns/*" 
          element={
            <ProtectedRoute pageName="Campaigns">
              <Campaigns />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/discover/*" 
          element={
            <ProtectedRoute pageName="Discover">
              <Discover />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reviews/*" 
          element={
            <ProtectedRoute pageName="Reviews">
              <Reviews />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/map-view/*" 
          element={
            <ProtectedRoute pageName="Map View">
              <MapView />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics/*" 
          element={
            <ProtectedRoute pageName="Analytics">
              <Analytics />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/ai-assistant/*" 
          element={
            <ProtectedRoute pageName="AI Assistant">
              <AIAssistant />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/logs/*" 
          element={
            <ProtectedRoute pageName="Logs">
              <Logs />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings/*" 
          element={
            <ProtectedRoute pageName="Settings">
              <Settings />
            </ProtectedRoute>
          } 
        />
      </Routes>
      <SessionTimeoutWarning />
    </Layout>
  );
};

export default Index;