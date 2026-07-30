import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { timestamp } from '@/lib/dateSync';
import { AuthContext, type AuthContextValue } from '@/contexts/authContext';

/**
 * One auth machine for the whole app.
 *
 * This lives in a provider rather than a plain hook on purpose. When the logic sat in a
 * hook, all 28 call sites each mounted their own `onAuthStateChange` subscription, their
 * own idle-timeout timers, and their own listeners on eight document-level events — so
 * whichever copy's timer fired first signed the user out, and the warning modal was
 * driven by a different copy than the one doing the signing out. There must only ever be
 * one of each, hence the provider.
 */

interface RateLimitData {
  attempts: number;
  lockoutUntil: number | null;
  lastAttempt: number;
}

const RATE_LIMIT_KEY = 'auth_rate_limit';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const SESSION_TIMEOUT = 120 * 60 * 1000; // sign out after 2 hours idle
const WARNING_TIMEOUT = 5 * 60 * 1000; // warn 5 minutes before that
const SESSION_ACTIVITY_KEY = 'session_last_activity';
const ACTIVITY_THROTTLE = 60 * 1000; // ignore activity bursts inside this window

interface SessionTimeoutData {
  lastActivity: number;
  warningShown: boolean;
}

/** Verdict from the server-side login limiter. */
interface RateLimitVerdict {
  allowed: boolean;
  retryAfter: number;
  message?: string;
}

/** Supabase attaches the failed response to the thrown error; the body may not be JSON. */
async function readErrorBody(
  error: unknown,
): Promise<{ error?: string; retry_after_seconds?: number } | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  if (typeof context?.json !== 'function') return null;
  try {
    return (await context.json()) as { error?: string; retry_after_seconds?: number };
  } catch {
    return null;
  }
}

function describeLockout(verdict: RateLimitVerdict): string {
  const base = verdict.message ?? 'Too many failed sign-in attempts. Please try again later.';
  const minutes = Math.ceil(verdict.retryAfter / 60);
  if (minutes <= 0) return base;
  return `${base} Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

const readJson = <T,>(key: string, fallback: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    // Corrupted entry (hand-edited, or written by an older version) — start over
    // rather than throwing on every render.
    localStorage.removeItem(key);
    return fallback;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);

  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutRemaining, setTimeoutRemaining] = useState(0);

  const signOutTimerRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const getRateLimitData = (): RateLimitData =>
    readJson<RateLimitData>(RATE_LIMIT_KEY, { attempts: 0, lockoutUntil: null, lastAttempt: 0 });

  const setRateLimitData = (data: RateLimitData) => {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
  };

  const checkLockoutStatus = useCallback(() => {
    const data = getRateLimitData();
    const now = timestamp();

    if (data.lockoutUntil && now < data.lockoutUntil) {
      setIsLocked(true);
      setLockoutTimeRemaining(Math.ceil((data.lockoutUntil - now) / 1000));
      return true;
    }
    if (data.lockoutUntil && now >= data.lockoutUntil) {
      setRateLimitData({ attempts: 0, lockoutUntil: null, lastAttempt: 0 });
      setIsLocked(false);
      setLockoutTimeRemaining(0);
    }
    return false;
  }, []);

  const recordFailedAttempt = useCallback(() => {
    const data = getRateLimitData();
    const now = timestamp();
    const attempts = data.attempts + 1;

    if (attempts >= MAX_ATTEMPTS) {
      setRateLimitData({ attempts, lockoutUntil: now + LOCKOUT_DURATION, lastAttempt: now });
      setIsLocked(true);
      setLockoutTimeRemaining(Math.ceil(LOCKOUT_DURATION / 1000));
    } else {
      setRateLimitData({ attempts, lockoutUntil: null, lastAttempt: now });
    }
  }, []);

  const resetFailedAttempts = useCallback(() => {
    setRateLimitData({ attempts: 0, lockoutUntil: null, lastAttempt: 0 });
    setIsLocked(false);
    setLockoutTimeRemaining(0);
  }, []);

  /**
   * Ask the `auth-rate-limit` edge function whether this email may attempt a sign-in, and
   * record the outcome. Deliberately fails closed: if the limiter is unreachable we refuse
   * the attempt rather than silently dropping back to the client-only counter, which an
   * attacker controls.
   */
  const callServerRateLimit = useCallback(
    async (email: string, action: 'check' | 'failure' | 'success'): Promise<RateLimitVerdict> => {
      const unavailable: RateLimitVerdict = {
        allowed: false,
        retryAfter: 0,
        message: 'Sign-in is temporarily unavailable. Please try again shortly.',
      };

      try {
        const { data, error } = await supabase.functions.invoke('auth-rate-limit', {
          body: { email, action },
        });

        // A 429 or 503 arrives as an error with the response attached rather than as data.
        if (error) {
          const body = await readErrorBody(error);
          return {
            allowed: false,
            retryAfter: Number(body?.retry_after_seconds ?? 0),
            message: body?.error ?? unavailable.message,
          };
        }

        return {
          allowed: data?.allowed !== false,
          retryAfter: Number(data?.retry_after_seconds ?? 0),
          message: data?.error,
        };
      } catch {
        return unavailable;
      }
    },
    [],
  );

  /** Mirror a server-imposed lockout into local state so the UI reflects it immediately. */
  const applyServerLockout = useCallback((retryAfterSeconds: number) => {
    if (retryAfterSeconds <= 0) return;
    setIsLocked(true);
    setLockoutTimeRemaining(retryAfterSeconds);
    setRateLimitData({
      attempts: MAX_ATTEMPTS,
      lockoutUntil: timestamp() + retryAfterSeconds * 1000,
      lastAttempt: timestamp(),
    });
  }, []);

  const setSessionActivity = (data: SessionTimeoutData) => {
    localStorage.setItem(SESSION_ACTIVITY_KEY, JSON.stringify(data));
  };

  const clearTimers = useCallback(() => {
    for (const ref of [signOutTimerRef, warningTimerRef, countdownRef]) {
      if (ref.current !== null) {
        clearTimeout(ref.current);
        clearInterval(ref.current);
        ref.current = null;
      }
    }
    setShowTimeoutWarning(false);
    setTimeoutRemaining(0);
  }, []);

  // Held in refs so scheduleTimers can stay dependency-free and therefore stable.
  const handleTimeoutRef = useRef<() => void>();
  const showWarningRef = useRef<() => void>();

  handleTimeoutRef.current = () => {
    clearTimers();
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
    void supabase.auth.signOut();
  };

  showWarningRef.current = () => {
    setShowTimeoutWarning(true);
    setTimeoutRemaining(WARNING_TIMEOUT / 1000);

    if (countdownRef.current !== null) clearInterval(countdownRef.current);
    countdownRef.current = window.setInterval(() => {
      setTimeoutRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  };

  const scheduleTimers = useCallback(() => {
    if (warningTimerRef.current !== null) clearTimeout(warningTimerRef.current);
    if (signOutTimerRef.current !== null) clearTimeout(signOutTimerRef.current);

    warningTimerRef.current = window.setTimeout(
      () => showWarningRef.current?.(),
      SESSION_TIMEOUT - WARNING_TIMEOUT,
    );
    signOutTimerRef.current = window.setTimeout(
      () => handleTimeoutRef.current?.(),
      SESSION_TIMEOUT,
    );
  }, []);

  const refreshSession = useCallback(() => {
    setSessionActivity({ lastActivity: timestamp(), warningShown: false });
    setShowTimeoutWarning(false);
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    scheduleTimers();
  }, [scheduleTimers]);

  const extendSession = useCallback(() => refreshSession(), [refreshSession]);

  // Single auth subscription for the app.
  useEffect(() => {
    checkLockoutStatus();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (nextSession) {
        resetFailedAttempts();
        setSessionActivity({ lastActivity: timestamp(), warningShown: false });
      } else {
        clearTimers();
        localStorage.removeItem(SESSION_ACTIVITY_KEY);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      setLoading(false);
      if (existing) setSessionActivity({ lastActivity: timestamp(), warningShown: false });
    });

    return () => subscription.unsubscribe();
  }, [checkLockoutStatus, clearTimers, resetFailedAttempts]);

  // Single set of activity listeners, and a single pair of idle timers.
  // Keyed on the access token rather than the session object: Supabase hands back a fresh
  // object on every refresh, and rebinding eight document listeners each time is waste.
  const accessToken = session?.access_token;
  useEffect(() => {
    if (!accessToken) return;

    scheduleTimers();

    const events = [
      'mousedown',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'input',
      'change',
      'focus',
    ] as const;

    let lastTracked = 0;
    const onActivity = () => {
      const now = timestamp();
      if (now - lastTracked < ACTIVITY_THROTTLE) return;
      lastTracked = now;
      refreshSession();
    };

    events.forEach((event) => document.addEventListener(event, onActivity, { passive: true }));
    return () => {
      events.forEach((event) => document.removeEventListener(event, onActivity));
    };
  }, [accessToken, scheduleTimers, refreshSession]);

  // Tear down timers if the provider itself unmounts.
  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!isLocked || lockoutTimeRemaining <= 0) return;

    const timer = window.setInterval(() => {
      setLockoutTimeRemaining((prev) => {
        if (prev <= 1) {
          resetFailedAttempts();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, lockoutTimeRemaining, resetFailedAttempts]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      // Client-side lockout first: instant feedback, no round trip. This is UX only —
      // clearing localStorage defeats it, which is why the server check below exists.
      if (checkLockoutStatus()) {
        const minutes = Math.ceil(lockoutTimeRemaining / 60);
        return {
          error: {
            message: `Account locked due to too many failed attempts. Try again in ${minutes} minutes.`,
          },
        };
      }

      // The real control. Survives cleared storage, private windows, and callers that
      // skip the UI entirely.
      const preCheck = await callServerRateLimit(email, 'check');
      if (!preCheck.allowed) {
        applyServerLockout(preCheck.retryAfter);
        return { error: { message: describeLockout(preCheck) } };
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        recordFailedAttempt();
        const afterFailure = await callServerRateLimit(email, 'failure');
        if (!afterFailure.allowed) applyServerLockout(afterFailure.retryAfter);
      } else {
        resetFailedAttempts();
        await callServerRateLimit(email, 'success');
      }

      return { error };
    },
    [
      applyServerLockout,
      callServerRateLimit,
      checkLockoutStatus,
      lockoutTimeRemaining,
      recordFailedAttempt,
      resetFailedAttempts,
    ],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      firstName?: string,
      lastName?: string,
      phone?: string,
      jobTitle?: string,
      degrees?: string,
    ) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: firstName,
            last_name: lastName,
            phone,
            job_title: jobTitle,
            degrees,
          },
        },
      });
      return { error };
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const formatLockoutTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    isLocked,
    lockoutTimeRemaining,
    formatLockoutTime,
    showTimeoutWarning,
    timeoutRemaining,
    extendSession,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
