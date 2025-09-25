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

// Inner component that needs Router context
function AppContent() {
  return (
    <AppErrorBoundary>
      <AppStateProvider>
        <TooltipProvider>
          <ConnectionMonitor />
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/*" element={<Index />} />
          </Routes>
        </TooltipProvider>
      </AppStateProvider>
    </AppErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;