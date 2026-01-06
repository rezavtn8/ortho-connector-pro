import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nowISO, timestamp } from '@/lib/dateSync';

interface RateLimitData {
  attempts: number;
  lockoutUntil: number | null;
  lastAttempt: number;
}

const RATE_LIMIT_KEY = 'auth_rate_limit';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// Session timeout constants
const SESSION_TIMEOUT = 120 * 60 * 1000; // 2 hours in milliseconds
const WARNING_TIMEOUT = 5 * 60 * 1000; // 5 minutes warning
const SESSION_ACTIVITY_KEY = 'session_last_activity';

interface SessionTimeoutData {
  lastActivity: number;
  warningShown: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);
  
  // Session timeout states
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutRemaining, setTimeoutRemaining] = useState(0);
  const sessionTimeoutRef = useRef<number | null>(null);
  const warningTimeoutRef = useRef<number | null>(null);
  const activityTimeoutRef = useRef<number | null>(null);

  const getRateLimitData = (): RateLimitData => {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (!stored) {
      return { attempts: 0, lockoutUntil: null, lastAttempt: 0 };
    }
    return JSON.parse(stored);
  };

  const setRateLimitData = (data: RateLimitData) => {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
  };

  const checkLockoutStatus = () => {
    const data = getRateLimitData();
    const now = timestamp();
    
    if (data.lockoutUntil && now < data.lockoutUntil) {
      const remaining = Math.ceil((data.lockoutUntil - now) / 1000);
      setIsLocked(true);
      setLockoutTimeRemaining(remaining);
      return true;
    } else if (data.lockoutUntil && now >= data.lockoutUntil) {
      // Lockout expired, reset attempts
      setRateLimitData({ attempts: 0, lockoutUntil: null, lastAttempt: 0 });
      setIsLocked(false);
      setLockoutTimeRemaining(0);
    }
    return false;
  };

  const recordFailedAttempt = () => {
    const data = getRateLimitData();
    const now = timestamp();
    const newAttempts = data.attempts + 1;
    
    if (newAttempts >= MAX_ATTEMPTS) {
      const lockoutUntil = now + LOCKOUT_DURATION;
      setRateLimitData({
        attempts: newAttempts,
        lockoutUntil,
        lastAttempt: now
      });
      setIsLocked(true);
      setLockoutTimeRemaining(Math.ceil(LOCKOUT_DURATION / 1000));
    } else {
      setRateLimitData({
        attempts: newAttempts,
        lockoutUntil: null,
        lastAttempt: now
      });
    }
  };

  const resetFailedAttempts = () => {
    setRateLimitData({ attempts: 0, lockoutUntil: null, lastAttempt: 0 });
    setIsLocked(false);
    setLockoutTimeRemaining(0);
  };

  // Session timeout management
  const getSessionActivity = (): SessionTimeoutData => {
    const stored = localStorage.getItem(SESSION_ACTIVITY_KEY);
    if (!stored) {
      return { lastActivity: timestamp(), warningShown: false };
    }
    return JSON.parse(stored);
  };

  const setSessionActivity = (data: SessionTimeoutData) => {
    localStorage.setItem(SESSION_ACTIVITY_KEY, JSON.stringify(data));
  };

  const clearSessionTimeouts = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
      activityTimeoutRef.current = null;
    }
    setShowTimeoutWarning(false);
    setTimeoutRemaining(0);
  }, []);

  const handleSessionTimeout = useCallback(async () => {
    clearSessionTimeouts();
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
  }, [clearSessionTimeouts]);

  const showWarningModal = useCallback(() => {
    setShowTimeoutWarning(true);
    setTimeoutRemaining(WARNING_TIMEOUT / 1000);
    
    // Start countdown for warning
    const countdownInterval = window.setInterval(() => {
      setTimeoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-logout after warning period
    sessionTimeoutRef.current = window.setTimeout(() => {
      clearInterval(countdownInterval);
      handleSessionTimeout();
    }, WARNING_TIMEOUT);
  }, [handleSessionTimeout]);

  const refreshSession = useCallback(() => {
    const now = timestamp();
    setSessionActivity({ lastActivity: now, warningShown: false });
    clearSessionTimeouts();
    
    if (session) {
      // Set warning timeout (SESSION_TIMEOUT - WARNING_TIMEOUT = 115 minutes)
      warningTimeoutRef.current = window.setTimeout(showWarningModal, SESSION_TIMEOUT - WARNING_TIMEOUT);
      // Also set session timeout on login
      sessionTimeoutRef.current = window.setTimeout(handleSessionTimeout, SESSION_TIMEOUT);
    }
  }, [session, showWarningModal, clearSessionTimeouts, handleSessionTimeout]);

  // Track activity with protection against premature logouts
  const trackUserActivity = useCallback(() => {
    if (!session) return;
    
    // Check actual elapsed time before refreshing to prevent premature resets
    const activity = getSessionActivity();
    const now = timestamp();
    const elapsed = now - activity.lastActivity;
    
    // Only refresh if at least 30 seconds have passed (debounce)
    if (elapsed < 30000) return;
    
    refreshSession();
  }, [session, refreshSession]);

  const extendSession = useCallback(() => {
    refreshSession();
    setShowTimeoutWarning(false);
  }, [refreshSession]);

  useEffect(() => {
    // Check lockout status on mount
    checkLockoutStatus();
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Reset failed attempts on successful auth
        if (session) {
          resetFailedAttempts();
          // Initialize session timeout on login
          const now = timestamp();
          setSessionActivity({ lastActivity: now, warningShown: false });
        } else {
          // Clear session timeout on logout
          clearSessionTimeouts();
          localStorage.removeItem(SESSION_ACTIVITY_KEY);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Initialize session timeout for existing session
      if (session) {
        const now = timestamp();
        setSessionActivity({ lastActivity: now, warningShown: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set up user activity listeners
  useEffect(() => {
    if (!session) return;

    // Include form-related events to ensure typing keeps session alive
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click', 'input', 'change', 'focus'];
    
    // Throttle activity tracking - increased to 30 seconds to reduce overhead
    let activityTimeout: number;
    let lastTracked = 0;
    const throttledTrackActivity = () => {
      const now = Date.now();
      // Only schedule tracking if 30 seconds have passed
      if (now - lastTracked < 30000) return;
      
      clearTimeout(activityTimeout);
      activityTimeout = window.setTimeout(() => {
        lastTracked = Date.now();
        trackUserActivity();
      }, 100); // Small delay to batch rapid events
    };

    events.forEach(event => {
      document.addEventListener(event, throttledTrackActivity, { passive: true });
    });

    // Initialize session timeout when session starts
    refreshSession();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledTrackActivity);
      });
      clearTimeout(activityTimeout);
    };
  }, [session, trackUserActivity, refreshSession]);

  // Update lockout timer every second
  useEffect(() => {
    if (!isLocked || lockoutTimeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      const newRemaining = lockoutTimeRemaining - 1;
      if (newRemaining <= 0) {
        setIsLocked(false);
        setLockoutTimeRemaining(0);
        resetFailedAttempts();
      } else {
        setLockoutTimeRemaining(newRemaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, lockoutTimeRemaining]);

  const signIn = async (email: string, password: string) => {
    // Check if account is locked
    if (checkLockoutStatus()) {
      return { error: { message: `Account locked due to too many failed attempts. Try again in ${Math.ceil(lockoutTimeRemaining / 60)} minutes.` } };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      recordFailedAttempt();
    }

    return { error };
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string, phone?: string, jobTitle?: string, degrees?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          job_title: jobTitle,
          degrees: degrees,
        }
      }
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    });
    
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const formatLockoutTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return {
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
    // Session timeout management
    showTimeoutWarning,
    timeoutRemaining,
    extendSession,
    refreshSession,
  };
}