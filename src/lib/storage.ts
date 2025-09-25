/**
 * Safe localStorage operations with error handling and fallbacks
 */

interface StorageOptions {
  fallback?: any;
  serialize?: boolean;
}

class SafeStorage {
  private isAvailable: boolean;

  constructor() {
    this.isAvailable = this.checkAvailability();
  }

  private checkAvailability(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  getItem<T>(key: string, options: StorageOptions = {}): T | null {
    const { fallback = null, serialize = true } = options;

    if (!this.isAvailable) {
      console.warn('localStorage not available, returning fallback');
      return fallback;
    }

    try {
      const item = localStorage.getItem(key);
      if (item === null) return fallback;
      
      return serialize ? JSON.parse(item) : (item as T);
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
      return fallback;
    }
  }

  setItem<T>(key: string, value: T, options: StorageOptions = {}): boolean {
    const { serialize = true } = options;

    if (!this.isAvailable) {
      console.warn('localStorage not available, unable to save');
      return false;
    }

    try {
      const valueToStore = serialize ? JSON.stringify(value) : String(value);
      localStorage.setItem(key, valueToStore);
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
      return false;
    }
  }

  removeItem(key: string): boolean {
    if (!this.isAvailable) {
      console.warn('localStorage not available');
      return false;
    }

    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
      return false;
    }
  }

  clear(): boolean {
    if (!this.isAvailable) {
      console.warn('localStorage not available');
      return false;
    }

    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }

  // Utility methods for common patterns
  getObject<T>(key: string, fallback: T): T {
    return this.getItem(key, { fallback, serialize: true }) as T;
  }

  getString(key: string, fallback = ''): string {
    return this.getItem(key, { fallback, serialize: false }) as string;
  }

  getBoolean(key: string, fallback = false): boolean {
    const value = this.getString(key);
    if (!value) return fallback;
    return value === 'true';
  }

  getNumber(key: string, fallback = 0): number {
    const value = this.getString(key);
    if (!value) return fallback;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
}

export const storage = new SafeStorage();

// Storage keys constants
export const STORAGE_KEYS = {
  // Auth related
  AUTH_RATE_LIMIT: 'auth_rate_limit',
  SESSION_ACTIVITY: 'session_last_activity',
  
  // User preferences
  NOTIFICATION_SETTINGS: 'notification_settings',
  USER_PREFERENCES: 'user_preferences',
  
  // Feature specific
  AI_CHAT_MESSAGES: (userId: string) => `ai-chat-messages-${userId}`,
  DISCOVERY_SESSION: 'discoverySession',
  DISCOVERED_OFFICES: 'discoveredOffices',
  
  // App state
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  THEME_MODE: 'theme_mode',
} as const;