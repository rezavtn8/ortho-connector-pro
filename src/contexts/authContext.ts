import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

/** What `useAuth()` hands back. Implemented once, by `<AuthProvider>`. */
export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    phone?: string,
    jobTitle?: string,
    degrees?: string,
  ) => Promise<{ error: { message: string } | null }>;
  signInWithGoogle: () => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
  isLocked: boolean;
  lockoutTimeRemaining: number;
  formatLockoutTime: (seconds: number) => string;
  showTimeoutWarning: boolean;
  timeoutRemaining: number;
  extendSession: () => void;
  refreshSession: () => void;
}

/**
 * Deliberately in its own module, separate from both the provider component and the
 * consumer hook, so neither file mixes component and non-component exports (which would
 * cost React Fast Refresh) and so there is no import cycle between them.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);
