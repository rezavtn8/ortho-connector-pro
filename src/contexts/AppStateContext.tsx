import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';

interface UserPreferences {
  sidebarCollapsed: boolean;
  themeMode: 'light' | 'dark' | 'system';
  notificationSettings: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    marketingEmails: boolean;
    securityAlerts: boolean;
  };
}

interface AppState {
  user: User | null;
  userPreferences: UserPreferences;
  loading: boolean;
  error: string | null;
  // Feature specific state
  aiChatMessages: Record<string, any[]>;
}

type AppAction = 
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_USER_PREFERENCES'; payload: Partial<UserPreferences> }
  | { type: 'SET_AI_CHAT_MESSAGES'; payload: { userId: string; messages: any[] } }
  | { type: 'CLEAR_USER_DATA' };

const defaultPreferences: UserPreferences = {
  sidebarCollapsed: false,
  themeMode: 'system',
  notificationSettings: {
    emailNotifications: true,
    pushNotifications: true,
    marketingEmails: false,
    securityAlerts: true,
  },
};

const initialState: AppState = {
  user: null,
  userPreferences: defaultPreferences,
  loading: true,
  error: null,
  aiChatMessages: {},
};

function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'UPDATE_USER_PREFERENCES':
      const updatedPreferences = { ...state.userPreferences, ...action.payload };
      // Persist to localStorage
      storage.setItem(STORAGE_KEYS.USER_PREFERENCES, updatedPreferences);
      return { ...state, userPreferences: updatedPreferences };
    
    case 'SET_AI_CHAT_MESSAGES':
      const { userId, messages } = action.payload;
      const updatedChatMessages = { ...state.aiChatMessages, [userId]: messages };
      // Persist to localStorage
      storage.setItem(STORAGE_KEYS.AI_CHAT_MESSAGES(userId), messages);
      return { ...state, aiChatMessages: updatedChatMessages };
    
    case 'CLEAR_USER_DATA':
      // Clear user-specific data from localStorage
      if (state.user) {
        storage.removeItem(STORAGE_KEYS.AI_CHAT_MESSAGES(state.user.id));
      }
      return {
        ...state,
        user: null,
        aiChatMessages: {},
        error: null,
      };
    
    default:
      return state;
  }
}

interface AppStateContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Helper functions
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  updateAIChatMessages: (userId: string, messages: any[]) => void;
  clearUserData: () => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appStateReducer, initialState);
  const { user, loading } = useAuth();

  // Initialize state from localStorage and auth
  useEffect(() => {
    // Load user preferences from localStorage
    const savedPreferences = storage.getObject(STORAGE_KEYS.USER_PREFERENCES, defaultPreferences);
    dispatch({ type: 'UPDATE_USER_PREFERENCES', payload: savedPreferences });

    // Set user from auth
    dispatch({ type: 'SET_USER', payload: user });
    dispatch({ type: 'SET_LOADING', payload: loading });

    // Load user-specific data when user changes
    if (user) {
      const savedMessages = storage.getObject(STORAGE_KEYS.AI_CHAT_MESSAGES(user.id), []);
      dispatch({ type: 'SET_AI_CHAT_MESSAGES', payload: { userId: user.id, messages: savedMessages } });
    } else {
      dispatch({ type: 'CLEAR_USER_DATA' });
    }
  }, [user, loading]);

  const updatePreferences = (preferences: Partial<UserPreferences>) => {
    dispatch({ type: 'UPDATE_USER_PREFERENCES', payload: preferences });
  };

  const updateAIChatMessages = (userId: string, messages: any[]) => {
    dispatch({ type: 'SET_AI_CHAT_MESSAGES', payload: { userId, messages } });
  };

  const clearUserData = () => {
    dispatch({ type: 'CLEAR_USER_DATA' });
  };

  const contextValue: AppStateContextType = {
    state,
    dispatch,
    updatePreferences,
    updateAIChatMessages,
    clearUserData,
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

// Convenience hooks for specific parts of state
export function useUserPreferences() {
  const { state, updatePreferences } = useAppState();
  return { preferences: state.userPreferences, updatePreferences };
}

export function useAIChatMessages() {
  const { state, updateAIChatMessages } = useAppState();
  const { user } = useAuth();
  
  const messages = user ? state.aiChatMessages[user.id] || [] : [];
  const setMessages = (messages: any[]) => {
    if (user) {
      updateAIChatMessages(user.id, messages);
    }
  };

  return { messages, setMessages };
}