/**
 * Enterprise-grade cache manager with IndexedDB, TTL, and intelligent invalidation
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in ms
  version: string;
  tags: string[];
  accessCount: number;
  lastAccess: number;
}

interface CacheConfig {
  name: string;
  version: number;
  maxSize: number; // Maximum entries
  defaultTTL: number; // Default TTL in ms
}

class CacheManager {
  private db: IDBDatabase | null = null;
  private config: CacheConfig;
  private memoryCache = new Map<string, CacheEntry>();
  private initPromise: Promise<void> | null = null;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.name, this.config.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.setupCleanupInterval();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('tags', 'tags', { multiEntry: true });
          store.createIndex('lastAccess', 'lastAccess');
        }
      };
    });

    return this.initPromise;
  }

  private setupCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async set<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number;
      tags?: string[];
      version?: string;
    } = {}
  ): Promise<void> {
    await this.init();

    const entry: CacheEntry<T> & { key: string } = {
      key,
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.config.defaultTTL,
      version: options.version || '1.0.0',
      tags: options.tags || [],
      accessCount: 0,
      lastAccess: Date.now()
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Store in IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await new Promise<void>((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // Enforce size limits
    if (this.memoryCache.size > this.config.maxSize) {
      await this.evictLRU();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      memoryEntry.accessCount++;
      memoryEntry.lastAccess = Date.now();
      return memoryEntry.data as T;
    }

    // Check IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      
      const entry = await new Promise<CacheEntry<T> | null>((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result || null);
        };
        request.onerror = () => resolve(null);
      });

      if (entry && !this.isExpired(entry)) {
        // Update access info
        entry.accessCount++;
        entry.lastAccess = Date.now();
        
        // Put back in memory cache
        this.memoryCache.set(key, entry);
        
        // Update IndexedDB with new access info
        const updateTransaction = this.db.transaction(['cache'], 'readwrite');
        const updateStore = updateTransaction.objectStore('cache');
        updateStore.put({ ...entry, key });

        return entry.data;
      }
    }

    return null;
  }

  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  async delete(key: string): Promise<void> {
    await this.init();

    this.memoryCache.delete(key);

    if (this.db) {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    await this.init();

    if (!this.db) return;

    const transaction = this.db.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const index = store.index('tags');

    for (const tag of tags) {
      const request = index.openCursor(IDBKeyRange.only(tag));
      
      await new Promise<void>((resolve) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const key = cursor.value.key;
            this.memoryCache.delete(key);
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    }
  }

  async clear(): Promise<void> {
    await this.init();

    this.memoryCache.clear();

    if (this.db) {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private async evictLRU(): Promise<void> {
    // Find least recently used entry
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      await this.delete(lruKey);
    }
  }

  private async cleanup(): Promise<void> {
    await this.init();

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // Clean IndexedDB
    if (this.db) {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('timestamp');
      const cutoff = Date.now() - this.config.defaultTTL;
      
      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));
      
      await new Promise<void>((resolve) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const entry = cursor.value;
            if (this.isExpired(entry)) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    }
  }

  async getStats(): Promise<{
    memoryEntries: number;
    totalSize: number;
    hitRate: number;
  }> {
    let totalAccess = 0;
    let totalHits = 0;

    for (const entry of this.memoryCache.values()) {
      totalAccess += entry.accessCount;
      if (entry.accessCount > 0) totalHits++;
    }

    return {
      memoryEntries: this.memoryCache.size,
      totalSize: this.memoryCache.size,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0
    };
  }
}

// Cache instances for different data types
export const platformCache = new CacheManager({
  name: 'nexora-platform-cache',
  version: 1,
  maxSize: 500,
  defaultTTL: 5 * 60 * 1000 // 5 minutes
});

export const userCache = new CacheManager({
  name: 'nexora-user-cache',
  version: 1,
  maxSize: 100,
  defaultTTL: 15 * 60 * 1000 // 15 minutes
});

export const analyticsCache = new CacheManager({
  name: 'nexora-analytics-cache',
  version: 1,
  maxSize: 200,
  defaultTTL: 2 * 60 * 1000 // 2 minutes for real-time data
});

// Cache keys and tags
export const CACHE_KEYS = {
  USER_PROFILE: (userId: string) => `user_profile_${userId}`,
  USER_SOURCES: (userId: string) => `user_sources_${userId}`,
  MONTHLY_DATA: (userId: string) => `monthly_data_${userId}`,
  CAMPAIGNS: (userId: string) => `campaigns_${userId}`,
  AI_USAGE: (userId: string) => `ai_usage_${userId}`,
  BUSINESS_PROFILE: (userId: string) => `business_profile_${userId}`,
  UNIFIED_DATA: (userId: string) => `unified_data_${userId}`
};

export const CACHE_TAGS = {
  USER_DATA: 'user_data',
  ANALYTICS: 'analytics',
  AI_CONTENT: 'ai_content',
  CAMPAIGNS: 'campaigns',
  SOURCES: 'sources'
};