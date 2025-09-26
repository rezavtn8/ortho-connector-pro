import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeTimeSync } from '@/lib/dateSync'
import { errorLogger } from '@/utils/errorLogger'
import { initializeAllOptimizations } from '@/lib/performanceOptimizations'

// Initialize time synchronization
initializeTimeSync();

// Initialize performance optimizations
initializeAllOptimizations();

// Setup global error handling
errorLogger;

createRoot(document.getElementById("root")!).render(<App />);
