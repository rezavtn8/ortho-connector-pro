import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/contexts/authContext';

/**
 * Read the app's single auth state.
 *
 * The machinery lives in `<AuthProvider>` — see src/contexts/AuthProvider.tsx for why it
 * has to be a provider and not a self-contained hook.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>. Check src/App.tsx.');
  }
  return ctx;
}

export type { AuthContextValue };
