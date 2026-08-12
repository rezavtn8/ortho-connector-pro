import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandingPage } from '@/components/LandingPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <LandingPage onGetStarted={() => {}} />
  </QueryClientProvider>,
);
