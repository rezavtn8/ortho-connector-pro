// src/pages/Index.tsx
import React, { lazy, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { LandingPage } from '@/components/LandingPage';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SuspenseWrapper } from '@/components/SuspenseWrapper';

// Every route is code-split. Only the landing page, layout chrome and error handling
// above ship in the initial bundle — the rest arrives when a route is first visited.
// Pages with a named export need the `default` shim that React.lazy expects.
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Sources = lazy(() => import('@/pages/Sources').then((m) => ({ default: m.Sources })));
const SourceDetail = lazy(() =>
  import('@/pages/SourceDetail').then((m) => ({ default: m.SourceDetail })),
);
const Offices = lazy(() => import('@/pages/Offices').then((m) => ({ default: m.Offices })));
const MarketingVisits = lazy(() =>
  import('@/pages/MarketingVisits').then((m) => ({ default: m.MarketingVisits })),
);
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));
const Analytics = lazy(() => import('@/pages/Analytics').then((m) => ({ default: m.Analytics })));
const MapView = lazy(() => import('@/pages/MapView').then((m) => ({ default: m.MapView })));
const Reviews = lazy(() => import('@/pages/Reviews').then((m) => ({ default: m.Reviews })));
const Discover = lazy(() => import('@/pages/Discover').then((m) => ({ default: m.Discover })));
const Logs = lazy(() => import('@/pages/Logs').then((m) => ({ default: m.Logs })));
const AIAssistant = lazy(() =>
  import('@/pages/AIAssistant').then((m) => ({ default: m.AIAssistant })),
);
const MailingLabels = lazy(() =>
  import('@/pages/MailingLabels').then((m) => ({ default: m.MailingLabels })),
);
const HelpCenter = lazy(() => import('@/pages/HelpCenter').then((m) => ({ default: m.HelpCenter })));

const Campaigns = lazy(() => import('@/pages/Campaigns'));
const ReviewMagic = lazy(() => import('@/pages/ReviewMagic'));
const DailyPatients = lazy(() => import('@/pages/DailyPatients'));
const CompetitorWatch = lazy(() => import('@/pages/CompetitorWatch'));
const SubscriptionSuccess = lazy(() => import('@/pages/SubscriptionSuccess'));
const SubscriptionCancel = lazy(() => import('@/pages/SubscriptionCancel'));
const GoogleBusinessOAuthCallback = lazy(() => import('@/pages/GoogleBusinessOAuthCallback'));

/** Route path -> page component. Every entry is wrapped in a page-level Suspense below. */
const ROUTES: ReadonlyArray<[path: string, Component: React.ComponentType]> = [
  ['/dashboard/*', Dashboard],
  ['/daily-patients/*', DailyPatients],
  ['/sources/*', Sources],
  ['/sources/:sourceId/*', SourceDetail],
  ['/offices/*', Offices],
  ['/marketing-visits/*', MarketingVisits],
  ['/campaigns/*', Campaigns],
  ['/discover/*', Discover],
  ['/reviews/*', Reviews],
  ['/review-magic/*', ReviewMagic],
  ['/map-view/*', MapView],
  ['/analytics/*', Analytics],
  ['/competitor-watch/*', CompetitorWatch],
  ['/ai-assistant/*', AIAssistant],
  ['/mailing-labels/*', MailingLabels],
  ['/logs/*', Logs],
  ['/help/*', HelpCenter],
  ['/settings/*', Settings],
  ['/google-business/oauth/callback', GoogleBusinessOAuthCallback],
  ['/subscription/success', SubscriptionSuccess],
  ['/subscription/cancel', SubscriptionCancel],
];

const Index = () => {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  const handleGetStarted = () => setShowAuth(true);

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
    return <LandingPage onGetStarted={handleGetStarted} showAuth={showAuth} />;
  }

  return (
    <Layout>
      <ErrorBoundary level="section">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {ROUTES.map(([path, Component]) => (
            <Route
              key={path}
              path={path}
              element={
                <SuspenseWrapper type="page">
                  <Component />
                </SuspenseWrapper>
              }
            />
          ))}
        </Routes>
      </ErrorBoundary>
      <SessionTimeoutWarning />
    </Layout>
  );
};

export default Index;
