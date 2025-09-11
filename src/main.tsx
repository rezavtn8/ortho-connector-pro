import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeTimeSync } from '@/lib/dateSync'

// Initialize time synchronization
initializeTimeSync();

createRoot(document.getElementById("root")!).render(<App />);
