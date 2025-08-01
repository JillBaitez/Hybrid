/**
 * HTOS Service Worker - Core Orchestrator
 * 
 * This is the main service worker that implements the two immutable pillars:
 * 1. DNR-before-JS race win
 * 2. Service-Worker-only authority
 * 
 * Ported from HARPA bg.js with renamed identifiers
 */

import { IToken, ITokenStore } from '../types/tokens.js';
import { HTOSBus, HTOSMessageTypes, BusContext } from '../bus';
import { DNRManager } from './dnr';
import { SecureTokenStore } from '../storage/secure-token-store';
import { TokenRefreshManager } from './token-refresh-manager';
import { ProviderRegistry } from '../providers/provider-registry';

// Global state - MUST remain in service worker memory only
let offscreenTabId: number | null = null;
let dnrManager: DNRManager;
let isInitialized = false;

class HTOSServiceWorker {
  private dnrManager: DNRManager;
  private tokenStorage: SecureTokenStore;
  private tokenRefreshManager: TokenRefreshManager;
  private providerRegistry: ProviderRegistry;
  private isInitialized = false;

  constructor() {
    this.dnrManager = new DNRManager();
    this.tokenStorage = new SecureTokenStore();
    this.tokenRefreshManager = new TokenRefreshManager();
    this.providerRegistry = new ProviderRegistry();
  }

  // Public getter for token storage access
  get tokenStore(): SecureTokenStore {
    return this.tokenStorage;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[HTOS SW] Initializing service worker...');

    try {
      // Initialize universal bus first
      await HTOSBus.init();
      console.log('[HTOS SW] Universal bus initialized for context:', BusContext.getContextName());

      // Initialize core managers
      await this.tokenStorage.init();
      console.log('[HTOS SW] Token storage initialized');

      await this.dnrManager.init();
      console.log('[HTOS SW] DNR manager initialized');

      await this.tokenRefreshManager.init();
      console.log('[HTOS SW] Token refresh manager initialized');

      // Provider registry doesn't need init - it's a static registry
      console.log('[HTOS SW] Provider registry ready');

      // Set up universal bus subscriptions
      this.setupUniversalBusSubscriptions();

      // Set up offscreen document management
      this.setupOffscreenManagement();

      // Set up token refresh alarm
      await chrome.alarms.create('tokenRefresh', { periodInMinutes: 30 });

      this.isInitialized = true;
      console.log('[HTOS SW] Service worker fully initialized');

      // Broadcast system ready using universal bus
      await HTOSBus.broadcastSystemEvent(HTOSMessageTypes.SYSTEM_READY, {
        timestamp: Date.now(),
        context: BusContext.getContextName(),
        locus: BusContext.getLocus()
      });

    } catch (error) {
      console.error('[HTOS SW] Initialization failed:', error);
      throw error;
    }
  }

  private setupUniversalBusSubscriptions(): void {
    const bus = HTOSBus.get();

    // Token refresh events
    bus.on(HTOSMessageTypes.TOKEN_REFRESH, async (data: any) => {
      console.log('[HTOS SW] Token refresh requested:', data);
      if (data.provider) {
        await this.tokenRefreshManager.refreshToken(data.provider);
      }
    });

    // Token extraction events
    bus.on(HTOSMessageTypes.TOKEN_EXTRACTED, async (provider: string, domain: string) => {
      console.log(`[HTOS SW] Token extracted for ${provider} from ${domain}`);
      // Trigger DNR activation for the provider
      const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });
      for (const tab of tabs) {
        if (tab.id) {
          await this.dnrManager.activateRulesForTab(tab.id, provider);
        }
      }
    });

    // DNR activation events
    bus.on(HTOSMessageTypes.DNR_ACTIVATE, async (provider: string, tabId: number) => {
      console.log(`[HTOS SW] DNR activation requested for ${provider} on tab ${tabId}`);
      await this.dnrManager.activateRulesForTab(tabId, provider);
      
      // Notify that rules were activated
      await HTOSBus.sendSystemMessage(HTOSMessageTypes.DNR_RULES_ACTIVATED, {
        provider,
        tabId,
        timestamp: Date.now()
      });
    });

    // DNR deactivation events
    bus.on(HTOSMessageTypes.DNR_DEACTIVATE, async (tabId: number) => {
      console.log(`[HTOS SW] DNR deactivation requested for tab ${tabId}`);
      await this.dnrManager.deactivateRulesForTab(tabId);
    });

    // System health checks
    bus.on(HTOSMessageTypes.SYSTEM_HEALTH_CHECK, () => {
      return {
        status: 'healthy',
        initialized: this.isInitialized,
        context: BusContext.getContextName(),
        locus: BusContext.getLocus(),
        timestamp: Date.now(),
        transports: BusContext.getAvailableTransports(),
        managers: {
          dnr: this.dnrManager ? 'ready' : 'not_ready',
          tokenStorage: this.tokenStorage ? 'ready' : 'not_ready',
          tokenRefresh: this.tokenRefreshManager ? 'ready' : 'not_ready',
          providerRegistry: this.providerRegistry ? 'ready' : 'not_ready'
        }
      };
    });

    // Offscreen document management
    bus.on(HTOSMessageTypes.OFFSCREEN_CREATE, async (reason: string) => {
      console.log(`[HTOS SW] Offscreen document creation requested: ${reason}`);
      await this.ensureOffscreenDocument();
    });
  }

  /**
   * Set up offscreen document management
   */
  private setupOffscreenManagement(): void {
    // Offscreen document will be created on demand
    console.log('[HTOS SW] Offscreen document management configured');
  }

  /**
   * Ensure offscreen document exists
   */
  private async ensureOffscreenDocument(): Promise<void> {
    try {
      // Check if offscreen document already exists
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });

      if (existingContexts.length > 0) {
        console.log('[HTOS SW] Offscreen document already exists');
        return;
      }

      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.DOM_SCRAPING, chrome.offscreen.Reason.IFRAME_SCRIPTING],
        justification: 'Token extraction and AI provider communication'
      });

      console.log('[HTOS SW] Offscreen document created successfully');
    } catch (error) {
      if ((error as Error).message.includes('Only a single offscreen document may be created')) {
        console.log('[HTOS SW] Offscreen document already exists (expected)');
      } else {
        console.error('[HTOS SW] Failed to create offscreen document:', error);
      }
    }
  }

  async ensureOffscreen(): Promise<void> {
    // CRITICAL: Check if off-screen document already exists using getContexts()
    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      
      if (contexts.length > 0) {
        console.log('[HTOS] Offscreen document already exists, skipping creation');
        return;
      }
    } catch (error) {
      console.error('[HTOS] Failed to check existing contexts:', error);
    }
    
    // No existing off-screen document found, create new one
    try {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('OS/0h.html'),
        reasons: [
          chrome.offscreen.Reason.LOCAL_STORAGE,
          chrome.offscreen.Reason.BLOBS,
          chrome.offscreen.Reason.IFRAME_SCRIPTING
        ],
        justification: 'HTOS requires offscreen document for iframe management and token handling'
      });
      console.log('[HTOS] Offscreen document created');
    } catch (error) {
      console.error('[HTOS] Failed to create offscreen document:', error);
      // Don't throw - extension should still work even if off-screen fails
    }
  }
}

const serviceWorker = new HTOSServiceWorker();

// IMMUTABLE PILLAR 1: DNR rules MUST be registered synchronously on startup
chrome.runtime.onStartup.addListener(serviceWorker.init.bind(serviceWorker));
chrome.runtime.onInstalled.addListener(serviceWorker.init.bind(serviceWorker));

// Service worker event handlers using class instance

/**
 * Token management - IMMUTABLE PILLAR 3: SW-only authority
 * Now using secure encrypted storage via class instance
 */
const tokenManager: ITokenStore = {
  async get(provider: string): Promise<IToken | undefined> {
    const tokenData = await serviceWorker.tokenStore.getToken(provider);
    if (!tokenData) return undefined;
    
    return {
      provider: tokenData.provider,
      value: tokenData.token,
      expiresAt: tokenData.expires
    };
  },

  async set(token: IToken): Promise<void> {
    await serviceWorker.tokenStore.setToken(token.provider, {
      type: 'session',
      token: token.value,
      expires: token.expiresAt || Date.now() + 24 * 60 * 60 * 1000
    });
    
    // Notify via universal bus instead of direct access
    await HTOSBus.sendSystemMessage(HTOSMessageTypes.TOKEN_REFRESH, {
      provider: token.provider,
      expires: token.expiresAt || Date.now() + 24 * 60 * 60 * 1000
    });
  },

  async delete(provider: string): Promise<void> {
    await serviceWorker.tokenStore.deleteToken(provider);
    await HTOSBus.sendSystemMessage(HTOSMessageTypes.TOKEN_DELETE, { provider });
  }
};

/**
}

/**
 * Handle token extraction notification from content scripts
 * This triggers DNR rule activation for the specific provider
 */
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'htos.token.extracted') {
    console.log(`[HTOS] Token extracted for ${msg.provider}, DNR rules will activate on next API call`);
    // DNR rules will be activated automatically by the manager when API calls are detected
    sendResponse({ ok: true });
    return;
  }
  
  // Keep CSP bypass for emergency fallback
  if (msg.type === 'htos.csp.error') {
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [{
        id: 9999,
        priority: 100,
        condition: { urlFilter: msg.tabUrl },
        action: { type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType, responseHeaders: [{ header: 'content-security-policy', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE }] }
      }]
    });
    await chrome.tabs.reload(msg.tabId);
    return;
  }
  
  // All other messages now use BroadcastChannel bus
  console.warn('[HTOS] Legacy runtime message received:', msg.type, '- should use bus');
  sendResponse({ ok: false, error: 'Use BroadcastChannel bus for messaging' });
  return true;
});

/**
 * External message handling - DEPRECATED
 * Legacy support for external messages
 * TODO: Remove after confirming no external dependencies
 */
/*
chrome.runtime.onMessageExternal.addListener(async (msg, sender, sendResponse) => {
  console.warn('[HTOS] Legacy external message received:', msg.type, '- should use bus');
  sendResponse({ ok: false, error: 'Use BroadcastChannel bus for messaging' });
  return true;
});
*/

// Legacy message handler removed - now using Universal Bus system
// Phase 3 features (prompt dispatch, CSP bypass) will be implemented later

/**
 * Token refresh alarm handler
 * @security Refreshes tokens periodically to maintain session
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tokenRefresh') {
    console.log('[HTOS] Refreshing tokens...');
    await refreshTokens();
  }
});

/**
 * Refresh all stored tokens
 * @security Uses offscreen iframe for session-based refresh
 */
async function refreshTokens(): Promise<void> {
  try {
    // Get all stored tokens
    const providers = ['chatgpt', 'claude', 'gemini'];
    
    for (const provider of providers) {
      const token = await tokenManager.get(provider);
      if (token) {
        // TODO: Implement token refresh logic via offscreen iframe
        console.log(`[HTOS] Refreshing token for ${provider}`);
      }
    }
  } catch (error) {
    console.error('[HTOS] Token refresh failed:', error);
  }
}

// Service worker lifecycle events - using class instance
chrome.runtime.onStartup.addListener(() => serviceWorker.init());
chrome.runtime.onInstalled.addListener(() => serviceWorker.init());