import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitData {
  attempts: number;
  lockoutUntil: number | null;
  lastAttempt: number;
}

const RATE_LIMIT_KEY = 'auth_rate_limit';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);

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
    const now = Date.now();
    
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
    const now = Date.now();
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
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
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
    signOut,
    isLocked,
    lockoutTimeRemaining,
    formatLockoutTime,
  };
}