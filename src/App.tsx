// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProductionErrorBoundary } from "@/components/ProductionErrorBoundary";
import { ConnectionMonitor } from "@/components/ConnectionMonitor";
import Index from "./pages/Index";

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
      <TooltipProvider>
        <ConnectionMonitor />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/*" element={<Index />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ProductionErrorBoundary>
);

export default App;