/**
 * HTOS Storage Layer - IndexedDB Wrapper
 * 
 * Provides persistent storage for session tokens, provider configs,
 * and orchestration state using IndexedDB.
 * 
 * @security All token storage isolated to service worker context
 */

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  authType: 'session' | 'bearer' | 'cookie';
  endpoints: {
    chat?: string;
    models?: string;
    auth?: string;
  };
  headers?: Record<string, string>;
  rateLimit?: {
    requests: number;
    window: number;
  };
}

export interface StorageSchema {
  tokens: {
    key: string;
    provider: string;
    type: 'session' | 'auth' | 'reqid';
    token: string;
    expires?: number;
    metadata?: Record<string, any>;
  };
  
  providers: {
    key: string;
    name: string;
    config: ProviderConfig;
    enabled: boolean;
    lastUsed?: number;
  };
  
  jobs: {
    key: string;
    id: string;
    prompt: string;
    providers: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    results?: Record<string, any>;
    created: number;
    updated: number;
  };
}

export class HTOSStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'htos-storage';
  private readonly version = 1;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Tokens store
        if (!db.objectStoreNames.contains('tokens')) {
          const tokenStore = db.createObjectStore('tokens', { keyPath: 'key' });
          tokenStore.createIndex('provider', 'provider', { unique: false });
          tokenStore.createIndex('type', 'type', { unique: false });
        }
        
        // Providers store
        if (!db.objectStoreNames.contains('providers')) {
          const providerStore = db.createObjectStore('providers', { keyPath: 'key' });
          providerStore.createIndex('name', 'name', { unique: true });
          providerStore.createIndex('enabled', 'enabled', { unique: false });
        }
        
        // Jobs store
        if (!db.objectStoreNames.contains('jobs')) {
          const jobStore = db.createObjectStore('jobs', { keyPath: 'key' });
          jobStore.createIndex('id', 'id', { unique: true });
          jobStore.createIndex('status', 'status', { unique: false });
          jobStore.createIndex('created', 'created', { unique: false });
        }
      };
    });
  }

  async setToken(provider: string, tokenData: Omit<StorageSchema['tokens'], 'key' | 'provider'>): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const key = `token:${provider}:${tokenData.type}`;
    const record: StorageSchema['tokens'] = {
      key,
      provider,
      ...tokenData,
    };
    
    const transaction = this.db.transaction(['tokens'], 'readwrite');
    const store = transaction.objectStore('tokens');
    
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getToken(provider: string, type?: string): Promise<StorageSchema['tokens'] | null> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const transaction = this.db.transaction(['tokens'], 'readonly');
    const store = transaction.objectStore('tokens');
    const index = store.index('provider');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(provider);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tokens = request.result;
        if (tokens.length === 0) {
          resolve(null);
          return;
        }
        
        // Filter by type if specified
        const filtered = type ? tokens.filter(t => t.type === type) : tokens;
        if (filtered.length === 0) {
          resolve(null);
          return;
        }
        
        // Return most recent token
        const sorted = filtered.sort((a, b) => (b.expires || 0) - (a.expires || 0));
        resolve(sorted[0]);
      };
    });
  }

  async removeToken(provider: string, type?: string): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const transaction = this.db.transaction(['tokens'], 'readwrite');
    const store = transaction.objectStore('tokens');
    
    if (type) {
      const key = `token:${provider}:${type}`;
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } else {
      // Remove all tokens for provider
      const index = store.index('provider');
      return new Promise((resolve, reject) => {
        const request = index.getAll(provider);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const tokens = request.result;
          const deletePromises = tokens.map(token => {
            return new Promise<void>((res, rej) => {
              const deleteRequest = store.delete(token.key);
              deleteRequest.onerror = () => rej(deleteRequest.error);
              deleteRequest.onsuccess = () => res();
            });
          });
          
          Promise.all(deletePromises).then(() => resolve()).catch(reject);
        };
      });
    }
  }

  async setProvider(name: string, config: ProviderConfig, enabled = true): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const key = `provider:${name}`;
    const record: StorageSchema['providers'] = {
      key,
      name,
      config,
      enabled,
      lastUsed: Date.now(),
    };
    
    const transaction = this.db.transaction(['providers'], 'readwrite');
    const store = transaction.objectStore('providers');
    
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getProvider(name: string): Promise<StorageSchema['providers'] | null> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const key = `provider:${name}`;
    const transaction = this.db.transaction(['providers'], 'readonly');
    const store = transaction.objectStore('providers');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getEnabledProviders(): Promise<StorageSchema['providers'][]> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const transaction = this.db.transaction(['providers'], 'readonly');
    const store = transaction.objectStore('providers');
    const index = store.index('enabled');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async createJob(id: string, prompt: string, providers: string[]): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const key = `job:${id}`;
    const record: StorageSchema['jobs'] = {
      key,
      id,
      prompt,
      providers,
      status: 'pending',
      created: Date.now(),
      updated: Date.now(),
    };
    
    const transaction = this.db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    
    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async updateJob(id: string, updates: Partial<StorageSchema['jobs']>): Promise<void> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const key = `job:${id}`;
    const transaction = this.db.transaction(['jobs'], 'readwrite');
    const store = transaction.objectStore('jobs');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(key);
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error(`Job ${id} not found`));
          return;
        }
        
        const updated = {
          ...existing,
          ...updates,
          updated: Date.now(),
        };
        
        const putRequest = store.put(updated);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  async getJob(id: string): Promise<StorageSchema['jobs'] | null> {
    if (!this.db) throw new Error('Storage not initialized');
    
    const key = `job:${id}`;
    const transaction = this.db.transaction(['jobs'], 'readonly');
    const store = transaction.objectStore('jobs');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async cleanup(): Promise<void> {
    if (!this.db) return;
    
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    // Clean up expired tokens
    const tokenTransaction = this.db.transaction(['tokens'], 'readwrite');
    const tokenStore = tokenTransaction.objectStore('tokens');
    
    const tokenRequest = tokenStore.getAll();
    tokenRequest.onsuccess = () => {
      const tokens = tokenRequest.result;
      tokens.forEach(token => {
        if (token.expires && token.expires < now) {
          tokenStore.delete(token.key);
        }
      });
    };
    
    // Clean up old jobs
    const jobTransaction = this.db.transaction(['jobs'], 'readwrite');
    const jobStore = jobTransaction.objectStore('jobs');
    const jobIndex = jobStore.index('created');
    
    const jobRequest = jobIndex.getAll(IDBKeyRange.upperBound(oneWeekAgo));
    jobRequest.onsuccess = () => {
      const oldJobs = jobRequest.result;
      oldJobs.forEach(job => {
        if (job.status === 'completed' || job.status === 'failed') {
          jobStore.delete(job.key);
        }
      });
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}