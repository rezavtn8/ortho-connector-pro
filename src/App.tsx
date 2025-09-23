// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import { SourceDetail } from "./pages/SourceDetail";
import { Analytics } from "./pages/Analytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = error.status as number;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 3;
      },
      staleTime: 1000 * 60 * 5, // 5 minutes - data remains fresh
      gcTime: 1000 * 60 * 30, // 30 minutes - cached data persists
      refetchOnWindowFocus: true, // Background refetch on focus
      refetchOnReconnect: true, // Background refetch on reconnect
      refetchInterval: 1000 * 60 * 10, // Auto-refetch every 10 minutes for critical data
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry client errors but do retry server errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = error.status as number;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

const App = () => (
  <ErrorBoundary level="app" onError={(error, errorInfo) => {
    console.error('App-level error:', error, errorInfo);
  }}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Index />} />
            <Route path="/sources" element={<Index />} />
            <Route path="/sources/:sourceId" element={<Index />} />
            <Route path="/offices" element={<Index />} />
            <Route path="/marketing-visits" element={<Index />} />
            <Route path="/campaigns" element={<Index />} />
            <Route path="/discover" element={<Index />} />
            <Route path="/reviews" element={<Index />} />
            <Route path="/map-view" element={<Index />} />
            <Route path="/analytics" element={<Index />} />
            <Route path="/ai-assistant" element={<Index />} />
            <Route path="/creator" element={<Index />} />
            <Route path="/logs" element={<Index />} />
            <Route path="/settings" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;