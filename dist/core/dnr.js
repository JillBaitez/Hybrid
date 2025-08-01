import { secureTokenStore } from '../storage/secure-token-store.js';
import { providerRegistry } from '../providers/provider-registry.js';

/**
 * HTOS Advanced Declarative Net Request Manager
 * @security Implements just-in-time rule activation to prevent Claude blank page issue
 * @pattern HARPA-inspired conditional DNR with tab-specific scoping
 */
// Note: HTOSStorage will be implemented - using mock for now
class MockHTOSStorage {
    async init() {
        // Mock implementation
    }
    async getToken(provider) {
        // Mock implementation - will be replaced with real storage
        return null;
    }
}
/**
 * Advanced DNR Manager with conditional activation
 * Solves Claude blank page by activating rules just-in-time for API calls only
 */
class DNRManager {
    constructor() {
        this.lastRuleId = 1000;
        this.rules = [];
        this.activeRules = {};
        this.cleanupInterval = null;
        this.storage = new MockHTOSStorage();
    }
    async init() {
        await this.storage.init();
        await this.dropAllSessionRules();
        this.startPeriodicCleanup();
        // HARPA-inspired: Listen for API requests to activate rules just-in-time
        // Non-blocking observation only - we don't modify requests, just detect them
        if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
            // Get all API endpoints from provider registry
            const apiEndpoints = providerRegistry.getAllApiEndpoints();
            chrome.webRequest.onBeforeRequest.addListener(this.onApiRequest.bind(this), {
                urls: apiEndpoints
            }
            // No third parameter needed for non-blocking observation
            );
            console.log(`[HTOS] Monitoring ${apiEndpoints.length} API endpoints for DNR activation`);
        }
        else {
            console.warn('[HTOS] webRequest API not available - DNR rules will not auto-activate');
        }
        // Clean up rules when tabs are closed
        chrome.tabs.onRemoved.addListener(this.onTabRemoved.bind(this));
    }
    /**
     * Called just-in-time when an API call is detected
     * This is the key to solving Claude blank page - rules activate ONLY for API calls
     * HARPA-inspired: non-blocking observation only
     */
    onApiRequest(details) {
        const tabId = details.tabId;
        if (tabId < 0)
            return; // Skip non-tab requests
        const provider = this.getProviderFromUrl(details.url);
        if (!provider)
            return;
        // Activate rule for this specific tab and provider (fire and forget)
        // This is non-blocking - we don't modify the request, just trigger rule registration
        this.registerRules(provider, tabId).catch(console.error);
    }
    /**
     * Register DNR rules for a provider and tab using provider registry
     */
    async registerRules(provider, tabId) {
        try {
            // Get provider adapter
            const providerAdapter = providerRegistry.getProvider(provider);
            if (!providerAdapter) {
                console.warn(`[HTOS] Unknown provider: ${provider}`);
                return;
            }
            // Get token for provider
            const tokenData = await secureTokenStore.getToken(provider);
            if (!tokenData || secureTokenStore.isExpired(tokenData)) {
                console.warn(`[HTOS] No valid token for ${provider}, skipping DNR activation`);
                return;
            }
            // Build rules using provider-specific logic
            const rules = providerAdapter.buildDNRRules(tokenData.token, tabId);
            if (rules.length === 0) {
                console.warn(`[HTOS] No rules generated for ${provider}`);
                return;
            }
            // Register the rules
            await chrome.declarativeNetRequest.updateDynamicRules({
                addRules: rules
            });
            // Track rules for cleanup
            this.activeRules[tabId] = {
                provider,
                ruleIds: rules.map(r => r.id),
                timestamp: Date.now()
            };
            console.log(`[HTOS] Activated ${rules.length} DNR rules for ${provider} on tab ${tabId}`);
            // Schedule cleanup after 30 seconds
            setTimeout(() => {
                this.cleanupTabRules(tabId).catch(console.error);
            }, 30000);
        }
        catch (error) {
            console.error(`[HTOS] Failed to register rules for ${provider}:`, error);
        }
    }
    /**
     * Clean up rules for a specific tab
     */
    async cleanupTabRules(tabId) {
        const rulesToRemove = this.activeRules[tabId];
        if (!rulesToRemove)
            return;
        const ruleIds = rulesToRemove.ruleIds;
        await this.unregisterByIds(ruleIds);
        delete this.activeRules[tabId];
        console.log(`[HTOS] Cleaned up ${ruleIds.length} DNR rules for tab ${tabId}`);
    }
    /**
     * Clean up rules when tab is removed
     */
    async onTabRemoved(tabId) {
        await this.cleanupTabRules(tabId);
    }
    /**
     * Public method to manually activate rules for a tab and provider
     * Used by universal bus system for explicit activation
     */
    async activateRulesForTab(tabId, provider) {
        console.log(`[HTOS DNR] Manual activation requested for ${provider} on tab ${tabId}`);
        await this.registerRules(provider, tabId);
    }
    /**
     * Public method to manually deactivate rules for a tab
     * Used by universal bus system for explicit deactivation
     */
    async deactivateRulesForTab(tabId) {
        console.log(`[HTOS DNR] Manual deactivation requested for tab ${tabId}`);
        await this.cleanupTabRules(tabId);
    }
    /**
     * Remove rules by IDs
     */
    async unregisterByIds(ruleIds) {
        if (ruleIds.length === 0)
            return;
        await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: ruleIds
        });
        // Remove from tracking
        for (const tabId in this.activeRules) {
            if (this.activeRules[tabId].ruleIds.some(id => ruleIds.includes(id))) {
                delete this.activeRules[tabId];
            }
        }
    }
    /**
     * Drop all session rules on startup
     */
    async dropAllSessionRules() {
        const existingRules = await chrome.declarativeNetRequest.getSessionRules();
        const ruleIds = existingRules.map(r => r.id);
        if (ruleIds.length > 0) {
            await chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: ruleIds
            });
        }
        this.rules = [];
    }
    /**
     * Periodic cleanup of expired rules
     */
    startPeriodicCleanup() {
        this.cleanupInterval = setInterval(async () => {
            const now = Date.now();
            for (const tabId in this.activeRules) {
                const rules = this.activeRules[tabId];
                if (rules.timestamp < now - 30000) {
                    await this.unregisterByIds(rules.ruleIds);
                    delete this.activeRules[tabId];
                }
            }
        }, 10000); // Check every 10 seconds
    }
    /**
     * Get provider name from URL using provider registry
     */
    getProviderFromUrl(url) {
        const provider = providerRegistry.getProviderByUrl(url);
        return provider ? provider.config.name : null;
    }
    /**
     * Cleanup on shutdown
     */
    async destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        await this.dropAllSessionRules();
    }
}
// Legacy functions for backward compatibility
function buildAuthRule(id, urlFilter, token) {
    return {
        id,
        priority: 1,
        condition: {
            urlFilter,
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
        },
        action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [{
                    header: 'Authorization',
                    operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                    value: `Bearer ${token}`
                }]
        }
    };
}
function buildCSPBypassRule(id, urlFilter) {
    return {
        id,
        priority: 1,
        condition: {
            urlFilter,
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
        },
        action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: [{
                    header: 'content-security-policy',
                    operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
                }]
        }
    };
}

export { DNRManager, buildAuthRule, buildCSPBypassRule };
