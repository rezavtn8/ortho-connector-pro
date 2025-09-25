import { useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '@/lib/storage';

interface DiscoverySession {
  id: string;
  searchLat: number;
  searchLng: number;
  searchDistance: number;
  officeTypeFilter?: string;
  zipCodeOverride?: string;
  resultsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DiscoveredOffice {
  id: string;
  name: string;
  address?: string;
  placeId: string;
  lat?: number;
  lng?: number;
  rating?: number;
  phone?: string;
  website?: string;
  officeType?: string;
  imported: boolean;
  discoverySessionId?: string;
  source: string;
  fetchedAt: Date;
}

/**
 * Hook for managing discovery session state with persistent storage
 */
export function useDiscoverySession() {
  const [currentSession, setCurrentSession] = useState<DiscoverySession | null>(() => {
    return storage.getObject(STORAGE_KEYS.DISCOVERY_SESSION, null);
  });
  
  const [discoveredOffices, setDiscoveredOffices] = useState<DiscoveredOffice[]>(() => {
    return storage.getObject(STORAGE_KEYS.DISCOVERED_OFFICES, []);
  });

  // Persist session to storage
  useEffect(() => {
    if (currentSession) {
      storage.setItem(STORAGE_KEYS.DISCOVERY_SESSION, currentSession);
    } else {
      storage.removeItem(STORAGE_KEYS.DISCOVERY_SESSION);
    }
  }, [currentSession]);

  // Persist offices to storage
  useEffect(() => {
    if (discoveredOffices.length > 0) {
      storage.setItem(STORAGE_KEYS.DISCOVERED_OFFICES, discoveredOffices);
    } else {
      storage.removeItem(STORAGE_KEYS.DISCOVERED_OFFICES);
    }
  }, [discoveredOffices]);

  const startNewSession = (sessionData: Omit<DiscoverySession, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newSession: DiscoverySession = {
      ...sessionData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setCurrentSession(newSession);
    setDiscoveredOffices([]); // Clear previous results
  };

  const updateSession = (updates: Partial<DiscoverySession>) => {
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        ...updates,
        updatedAt: new Date(),
      });
    }
  };

  const addDiscoveredOffices = (offices: Omit<DiscoveredOffice, 'id' | 'fetchedAt'>[]) => {
    const newOffices = offices.map(office => ({
      ...office,
      id: `${office.placeId}-${Date.now()}`,
      fetchedAt: new Date(),
    }));
    
    setDiscoveredOffices(prev => [...prev, ...newOffices]);
  };

  const updateOffice = (officeId: string, updates: Partial<DiscoveredOffice>) => {
    setDiscoveredOffices(prev => 
      prev.map(office => 
        office.id === officeId ? { ...office, ...updates } : office
      )
    );
  };

  const clearSession = () => {
    setCurrentSession(null);
    setDiscoveredOffices([]);
    storage.removeItem(STORAGE_KEYS.DISCOVERY_SESSION);
    storage.removeItem(STORAGE_KEYS.DISCOVERED_OFFICES);
  };

  return {
    currentSession,
    discoveredOffices,
    startNewSession,
    updateSession,
    addDiscoveredOffices,
    updateOffice,
    clearSession,
    hasResults: discoveredOffices.length > 0,
    sessionActive: currentSession !== null,
  };
}