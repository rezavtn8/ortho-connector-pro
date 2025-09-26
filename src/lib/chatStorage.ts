// IndexedDB storage for chat messages and data caching
const DB_NAME = 'AIChatAssistant';
const DB_VERSION = 1;
const MESSAGE_STORE = 'messages';
const CACHE_STORE = 'cache';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'analysis' | 'suggestion' | 'general';
  status?: 'sending' | 'sent' | 'failed';
  retryCount?: number;
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiry: number;
}

class ChatStorageManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Messages store
        if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
          const messageStore = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('userId', 'userId', { unique: false });
        }

        // Cache store
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          const cacheStore = db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
          cacheStore.createIndex('expiry', 'expiry', { unique: false });
        }
      };
    });
  }

  async saveMessage(userId: string, message: ChatMessage): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([MESSAGE_STORE], 'readwrite');
    const store = transaction.objectStore(MESSAGE_STORE);
    
    const messageWithUserId = {
      ...message,
      userId,
      timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp)
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(messageWithUserId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getMessages(userId: string, limit: number = 10, offset: number = 0): Promise<ChatMessage[]> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([MESSAGE_STORE], 'readonly');
    const store = transaction.objectStore(MESSAGE_STORE);
    const index = store.index('timestamp');
    
    return new Promise((resolve, reject) => {
      const messages: ChatMessage[] = [];
      const request = index.openCursor(null, 'prev'); // Latest first
      let count = 0;
      let skipped = 0;
      
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (!cursor || count >= limit) {
          resolve(messages.reverse()); // Reverse to chronological order
          return;
        }
        
        if (cursor.value.userId === userId) {
          if (skipped >= offset) {
            messages.push({
              ...cursor.value,
              timestamp: new Date(cursor.value.timestamp)
            });
            count++;
          } else {
            skipped++;
          }
        }
        
        cursor.continue();
      };
    });
  }

  async getAllMessages(userId: string): Promise<ChatMessage[]> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([MESSAGE_STORE], 'readonly');
    const store = transaction.objectStore(MESSAGE_STORE);
    const index = store.index('userId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const messages = request.result
          .map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        resolve(messages);
      };
    });
  }

  async updateMessage(userId: string, messageId: string, updates: Partial<ChatMessage>): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([MESSAGE_STORE], 'readwrite');
    const store = transaction.objectStore(MESSAGE_STORE);
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(messageId);
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const message = getRequest.result;
        if (!message || message.userId !== userId) {
          reject(new Error('Message not found'));
          return;
        }
        
        const updatedMessage = { ...message, ...updates };
        const putRequest = store.put(updatedMessage);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  async deleteMessage(userId: string, messageId: string): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([MESSAGE_STORE], 'readwrite');
    const store = transaction.objectStore(MESSAGE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(messageId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async setCache(key: string, data: any, ttlMinutes: number = 5): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([CACHE_STORE], 'readwrite');
    const store = transaction.objectStore(CACHE_STORE);
    
    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      expiry: Date.now() + (ttlMinutes * 60 * 1000)
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getCache(key: string): Promise<any> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([CACHE_STORE], 'readonly');
    const store = transaction.objectStore(CACHE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result;
        if (!entry || Date.now() > entry.expiry) {
          resolve(null);
          return;
        }
        resolve(entry.data);
      };
    });
  }

  async clearExpiredCache(): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([CACHE_STORE], 'readwrite');
    const store = transaction.objectStore(CACHE_STORE);
    const index = store.index('expiry');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.upperBound(Date.now()));
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (!cursor) {
          resolve();
          return;
        }
        
        cursor.delete();
        cursor.continue();
      };
    });
  }

  async saveDraft(userId: string, content: string): Promise<void> {
    await this.setCache(`draft_${userId}`, content, 60); // 1 hour TTL
  }

  async getDraft(userId: string): Promise<string | null> {
    return await this.getCache(`draft_${userId}`);
  }

  async clearDraft(userId: string): Promise<void> {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([CACHE_STORE], 'readwrite');
    const store = transaction.objectStore(CACHE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(`draft_${userId}`);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const chatStorage = new ChatStorageManager();