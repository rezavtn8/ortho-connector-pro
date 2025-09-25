// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ConnectionMonitor } from "@/components/ConnectionMonitor";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { queryClient } from "@/lib/queryClient";
import Index from "./pages/Index";

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AppStateProvider>
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
      </AppStateProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;