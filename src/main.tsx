import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeTimeSync } from '@/lib/dateSync'
import { errorLogger } from '@/utils/errorLogger'

// Initialize time synchronization
initializeTimeSync();

// Setup global error handling
errorLogger;

createRoot(document.getElementById("root")!).render(<App />);
