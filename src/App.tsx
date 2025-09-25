// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ConnectionMonitor } from "@/components/ConnectionMonitor";
import Index from "./pages/Index";

const App = () => (
  <AppErrorBoundary>
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
  </AppErrorBoundary>
);

export default App;