/**
 * HTOS Secure Token Storage - Production Implementation
 *
 * Implements encrypted IndexedDB storage for AI provider tokens
 * Service Worker only - ensures tokens never leak to content scripts
 * HTOS-PILLAR-CHECK: SW-only authority with encryption at rest
 */
/**
 * Secure IndexedDB-based token storage with encryption
 * Only accessible from service worker context
 */
class SecureTokenStore {
    constructor() {
        this.db = null;
        this.dbName = 'HTOSTokenStore';
        this.dbVersion = 1;
        this.storeName = 'tokens';
        this.encryptionKey = null;
    }
    /**
     * Initialize the secure storage system
     */
    async init() {
        if (this.db)
            return; // Already initialized
        // Ensure we're in service worker context
        if (typeof importScripts === 'undefined') {
            throw new Error('[HTOS] SecureTokenStore can only be used in service worker context');
        }
        try {
            // Initialize encryption key
            await this.initEncryptionKey();
            // Open IndexedDB
            this.db = await this.openDatabase();
            console.log('[HTOS] Secure token storage initialized');
        }
        catch (error) {
            console.error('[HTOS] Failed to initialize secure token storage:', error);
            throw error;
        }
    }
    /**
     * Get token for a specific provider
     */
    async getToken(provider) {
        if (!this.db || !this.encryptionKey) {
            throw new Error('[HTOS] Storage not initialized');
        }
        try {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const result = await this.promisifyRequest(store.get(provider));
            if (!result)
                return null;
            // Decrypt the token data
            const decryptedData = await this.decryptTokenData(result.encryptedData);
            // Check if token is expired
            if (this.isExpired(decryptedData)) {
                // Clean up expired token
                await this.deleteToken(provider);
                return null;
            }
            // Update last used timestamp
            decryptedData.lastUsed = Date.now();
            await this.setToken(provider, decryptedData);
            return decryptedData;
        }
        catch (error) {
            console.error(`[HTOS] Failed to get token for ${provider}:`, error);
            return null;
        }
    }
    /**
     * Store encrypted token for a provider
     */
    async setToken(provider, tokenData) {
        if (!this.db || !this.encryptionKey) {
            throw new Error('[HTOS] Storage not initialized');
        }
        try {
            const fullTokenData = {
                ...tokenData,
                provider,
                created: Date.now(),
                lastUsed: Date.now()
            };
            // Encrypt the token data
            const encryptedData = await this.encryptTokenData(fullTokenData);
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            await this.promisifyRequest(store.put({
                provider,
                encryptedData,
                expires: tokenData.expires // Store expiration unencrypted for cleanup queries
            }));
            console.log(`[HTOS] Token stored securely for provider: ${provider}`);
        }
        catch (error) {
            console.error(`[HTOS] Failed to store token for ${provider}:`, error);
            throw error;
        }
    }
    /**
     * Delete token for a specific provider
     */
    async deleteToken(provider) {
        if (!this.db) {
            throw new Error('[HTOS] Storage not initialized');
        }
        try {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            await this.promisifyRequest(store.delete(provider));
            console.log(`[HTOS] Token deleted for provider: ${provider}`);
        }
        catch (error) {
            console.error(`[HTOS] Failed to delete token for ${provider}:`, error);
            throw error;
        }
    }
    /**
     * Get all stored tokens (decrypted)
     */
    async getAllTokens() {
        if (!this.db || !this.encryptionKey) {
            throw new Error('[HTOS] Storage not initialized');
        }
        try {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const results = await this.promisifyRequest(store.getAll());
            const tokens = {};
            for (const result of results) {
                try {
                    const decryptedData = await this.decryptTokenData(result.encryptedData);
                    if (!this.isExpired(decryptedData)) {
                        tokens[result.provider] = decryptedData;
                    }
                }
                catch (error) {
                    console.warn(`[HTOS] Failed to decrypt token for ${result.provider}, skipping`);
                }
            }
            return tokens;
        }
        catch (error) {
            console.error('[HTOS] Failed to get all tokens:', error);
            return {};
        }
    }
    /**
     * Remove all expired tokens from storage
     */
    async clearExpiredTokens() {
        if (!this.db) {
            throw new Error('[HTOS] Storage not initialized');
        }
        try {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const results = await this.promisifyRequest(store.getAll());
            const now = Date.now();
            let cleanedCount = 0;
            for (const result of results) {
                if (result.expires && result.expires < now) {
                    await this.promisifyRequest(store.delete(result.provider));
                    cleanedCount++;
                }
            }
            if (cleanedCount > 0) {
                console.log(`[HTOS] Cleaned up ${cleanedCount} expired tokens`);
            }
        }
        catch (error) {
            console.error('[HTOS] Failed to clear expired tokens:', error);
        }
    }
    /**
     * Check if token data is expired
     */
    isExpired(tokenData) {
        return tokenData.expires > 0 && tokenData.expires < Date.now();
    }
    /**
     * Initialize encryption key using Web Crypto API
     */
    async initEncryptionKey() {
        try {
            // Try to get existing key from storage
            const keyData = await chrome.storage.local.get('htos_encryption_key');
            if (keyData.htos_encryption_key) {
                // Import existing key
                this.encryptionKey = await crypto.subtle.importKey('raw', new Uint8Array(keyData.htos_encryption_key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
            }
            else {
                // Generate new key
                this.encryptionKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
                // Export and store key
                const exportedKey = await crypto.subtle.exportKey('raw', this.encryptionKey);
                await chrome.storage.local.set({
                    htos_encryption_key: Array.from(new Uint8Array(exportedKey))
                });
            }
            console.log('[HTOS] Encryption key initialized');
        }
        catch (error) {
            console.error('[HTOS] Failed to initialize encryption key:', error);
            throw error;
        }
    }
    /**
     * Encrypt token data using AES-GCM
     */
    async encryptTokenData(data) {
        if (!this.encryptionKey) {
            throw new Error('[HTOS] Encryption key not initialized');
        }
        try {
            const encoder = new TextEncoder();
            const dataString = JSON.stringify(data);
            const dataBuffer = encoder.encode(dataString);
            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            // Encrypt data
            const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.encryptionKey, dataBuffer);
            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedData), iv.length);
            return combined.buffer;
        }
        catch (error) {
            console.error('[HTOS] Failed to encrypt token data:', error);
            throw error;
        }
    }
    /**
     * Decrypt token data using AES-GCM
     */
    async decryptTokenData(encryptedBuffer) {
        if (!this.encryptionKey) {
            throw new Error('[HTOS] Encryption key not initialized');
        }
        try {
            const combined = new Uint8Array(encryptedBuffer);
            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);
            // Decrypt data
            const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.encryptionKey, encryptedData);
            // Parse decrypted data
            const decoder = new TextDecoder();
            const dataString = decoder.decode(decryptedBuffer);
            return JSON.parse(dataString);
        }
        catch (error) {
            console.error('[HTOS] Failed to decrypt token data:', error);
            throw error;
        }
    }
    /**
     * Open IndexedDB database
     */
    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Create object store for tokens
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'provider' });
                    store.createIndex('expires', 'expires', { unique: false });
                }
            };
        });
    }
    /**
     * Convert IDBRequest to Promise
     */
    promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
// Export singleton instance for service worker use
const secureTokenStore = new SecureTokenStore();

export { SecureTokenStore, secureTokenStore };
