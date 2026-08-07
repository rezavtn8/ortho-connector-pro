// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProductionErrorBoundary } from "@/components/ProductionErrorBoundary";
import { ConnectionMonitor } from "@/components/ConnectionMonitor";
import { AuthProvider } from "@/contexts/AuthProvider";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";

// Dev-only map preview. `import.meta.env.DEV` is statically false in a production
// build, so Rollup drops both the route and the lazy import entirely.
const FlowMapPreview = import.meta.env.DEV
  ? lazy(() => import("@/components/map/__dev__/FlowMapPreview"))
  : null;

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
  <ProductionErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ConnectionMonitor />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {FlowMapPreview && (
                <Route
                  path="/__map-preview"
                  element={
                    <Suspense fallback={null}>
                      <FlowMapPreview />
                    </Suspense>
                  }
                />
              )}
              <Route path="/*" element={<Index />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ProductionErrorBoundary>
);

export default App;