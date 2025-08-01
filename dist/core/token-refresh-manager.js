import { secureTokenStore } from '../storage/secure-token-store.js';
import { extractTokenFromProvider } from '../utils/token-extractor.js';

/**
 * HTOS Token Refresh Manager
 *
 * Implements automatic token refresh using Chrome alarms API
 * Ensures tokens are refreshed before expiration to maintain seamless operation
 * HTOS-PILLAR-CHECK: SW-only authority with proactive token management
 */
/**
 * Manages automatic token refresh using Chrome alarms
 */
class TokenRefreshManager {
    constructor() {
        this.REFRESH_BUFFER_MS = 60 * 60 * 1000; // Refresh 1 hour before expiration
        this.CLEANUP_INTERVAL_MS = 4 * 60 * 60 * 1000; // Cleanup every 4 hours
        this.MAX_REFRESH_ATTEMPTS = 3;
        this.refreshAttempts = new Map();
        this.isInitialized = false;
    }
    /**
     * Initialize the token refresh manager
     */
    async init() {
        if (this.isInitialized)
            return;
        try {
            // Ensure secure storage is initialized
            await secureTokenStore.init();
            // Set up alarm listener for token refresh
            chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
            // Schedule cleanup alarm
            await chrome.alarms.create('htos-token-cleanup', {
                delayInMinutes: this.CLEANUP_INTERVAL_MS / (60 * 1000),
                periodInMinutes: this.CLEANUP_INTERVAL_MS / (60 * 1000)
            });
            // Schedule refresh for existing tokens
            await this.scheduleExistingTokens();
            this.isInitialized = true;
            console.log('[HTOS] Token refresh manager initialized');
        }
        catch (error) {
            console.error('[HTOS] Failed to initialize token refresh manager:', error);
            throw error;
        }
    }
    /**
     * Schedule refresh for a specific token
     */
    async scheduleRefresh(provider, tokenData) {
        try {
            const refreshTime = tokenData.expires - this.REFRESH_BUFFER_MS;
            const now = Date.now();
            // Don't schedule if token expires too soon or is already expired
            if (refreshTime <= now) {
                console.warn(`[HTOS] Token for ${provider} expires too soon, skipping refresh schedule`);
                return;
            }
            const delayMinutes = Math.max(1, (refreshTime - now) / (60 * 1000));
            const alarmName = `htos-refresh-${provider}`;
            // Clear existing alarm
            await chrome.alarms.clear(alarmName);
            // Create new refresh alarm
            await chrome.alarms.create(alarmName, {
                delayInMinutes: delayMinutes
            });
            console.log(`[HTOS] Scheduled token refresh for ${provider} in ${Math.round(delayMinutes)} minutes`);
        }
        catch (error) {
            console.error(`[HTOS] Failed to schedule refresh for ${provider}:`, error);
        }
    }
    /**
     * Cancel scheduled refresh for a provider
     */
    async cancelRefresh(provider) {
        try {
            const alarmName = `htos-refresh-${provider}`;
            await chrome.alarms.clear(alarmName);
            this.refreshAttempts.delete(provider);
            console.log(`[HTOS] Cancelled refresh schedule for ${provider}`);
        }
        catch (error) {
            console.error(`[HTOS] Failed to cancel refresh for ${provider}:`, error);
        }
    }
    /**
     * Refresh token for a specific provider
     */
    async refreshToken(provider) {
        try {
            const attempts = this.refreshAttempts.get(provider) || 0;
            if (attempts >= this.MAX_REFRESH_ATTEMPTS) {
                console.warn(`[HTOS] Max refresh attempts reached for ${provider}, giving up`);
                await this.cancelRefresh(provider);
                return false;
            }
            this.refreshAttempts.set(provider, attempts + 1);
            // Get provider domain for token extraction
            const domain = this.getProviderDomain(provider);
            if (!domain) {
                console.error(`[HTOS] Unknown provider domain for ${provider}`);
                return false;
            }
            console.log(`[HTOS] Attempting to refresh token for ${provider} (attempt ${attempts + 1})`);
            // Extract new token
            const newToken = await extractTokenFromProvider(domain);
            if (newToken) {
                // Reset attempt counter on success
                this.refreshAttempts.delete(provider);
                // Get the updated token data to schedule next refresh
                const tokenData = await secureTokenStore.getToken(provider);
                if (tokenData) {
                    await this.scheduleRefresh(provider, tokenData);
                }
                console.log(`[HTOS] Successfully refreshed token for ${provider}`);
                return true;
            }
            else {
                console.warn(`[HTOS] Failed to refresh token for ${provider}, will retry`);
                // Schedule retry with exponential backoff
                const retryDelay = Math.min(30, 5 * Math.pow(2, attempts)); // 5, 10, 20, 30 minutes max
                const alarmName = `htos-refresh-${provider}`;
                await chrome.alarms.create(alarmName, {
                    delayInMinutes: retryDelay
                });
                return false;
            }
        }
        catch (error) {
            console.error(`[HTOS] Error refreshing token for ${provider}:`, error);
            return false;
        }
    }
    /**
     * Refresh all stored tokens
     */
    async refreshAllTokens() {
        try {
            const allTokens = await secureTokenStore.getAllTokens();
            const refreshPromises = Object.keys(allTokens).map(provider => this.refreshToken(provider));
            const results = await Promise.allSettled(refreshPromises);
            const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
            console.log(`[HTOS] Bulk refresh completed: ${successful}/${results.length} tokens refreshed`);
        }
        catch (error) {
            console.error('[HTOS] Error during bulk token refresh:', error);
        }
    }
    /**
     * Clean up expired tokens and failed refresh attempts
     */
    async cleanupExpiredTokens() {
        try {
            await secureTokenStore.clearExpiredTokens();
            // Clean up failed refresh attempts for non-existent tokens
            const allTokens = await secureTokenStore.getAllTokens();
            const existingProviders = new Set(Object.keys(allTokens));
            for (const [provider] of this.refreshAttempts) {
                if (!existingProviders.has(provider)) {
                    this.refreshAttempts.delete(provider);
                    await this.cancelRefresh(provider);
                }
            }
            console.log('[HTOS] Token cleanup completed');
        }
        catch (error) {
            console.error('[HTOS] Error during token cleanup:', error);
        }
    }
    /**
     * Handle Chrome alarm events
     */
    async handleAlarm(alarm) {
        try {
            if (alarm.name === 'htos-token-cleanup') {
                await this.cleanupExpiredTokens();
            }
            else if (alarm.name.startsWith('htos-refresh-')) {
                const provider = alarm.name.replace('htos-refresh-', '');
                await this.refreshToken(provider);
            }
        }
        catch (error) {
            console.error(`[HTOS] Error handling alarm ${alarm.name}:`, error);
        }
    }
    /**
     * Schedule refresh for all existing tokens
     */
    async scheduleExistingTokens() {
        try {
            const allTokens = await secureTokenStore.getAllTokens();
            for (const [provider, tokenData] of Object.entries(allTokens)) {
                if (!secureTokenStore.isExpired(tokenData)) {
                    await this.scheduleRefresh(provider, tokenData);
                }
            }
            console.log(`[HTOS] Scheduled refresh for ${Object.keys(allTokens).length} existing tokens`);
        }
        catch (error) {
            console.error('[HTOS] Error scheduling existing tokens:', error);
        }
    }
    /**
     * Get provider domain for token extraction
     */
    getProviderDomain(provider) {
        const domainMap = {
            'chatgpt': 'chat.openai.com',
            'claude': 'claude.ai',
            'gemini': 'gemini.google.com'
        };
        return domainMap[provider] || null;
    }
}
// Export singleton instance for service worker use
const tokenRefreshManager = new TokenRefreshManager();

export { TokenRefreshManager, tokenRefreshManager };
