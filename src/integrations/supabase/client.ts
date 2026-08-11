import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Config comes from .env (see .env.example). The anon key is safe in the browser —
// tenant isolation is enforced by row-level security, not by hiding this key.
const FALLBACK_SUPABASE_URL = 'https://vqkzqwibbcvmdwgqladn.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? FALLBACK_SUPABASE_URL;
// Lovable Cloud writes the browser key as VITE_SUPABASE_PUBLISHABLE_KEY; older local
// .env files use VITE_SUPABASE_ANON_KEY. Accept either so the app never fails to boot.
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  FALLBACK_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
