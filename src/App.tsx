// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QueryProvider } from "@/components/QueryProvider";
import Index from "./pages/Index";
import { SourceDetail } from "./pages/SourceDetail";
import { Analytics } from "./pages/Analytics";
import NotFound from "./pages/NotFound";

const App = () => (
  <ErrorBoundary level="app" onError={(error, errorInfo) => {
    console.error('App-level error:', error, errorInfo);
  }}>
    <QueryProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={
              <ErrorBoundary level="section">
                <Index />
              </ErrorBoundary>
            } />
            <Route path="/source/:id" element={
              <ErrorBoundary level="section">
                <SourceDetail />
              </ErrorBoundary>
            } />
            <Route path="/analytics" element={
              <ErrorBoundary level="section">
                <Analytics />
              </ErrorBoundary>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryProvider>
  </ErrorBoundary>
);

export default App;