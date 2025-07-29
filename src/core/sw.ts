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
import { ServiceWorkerBus } from './bus.js';
import { IBusMessage, IBusResponse } from '../types/bus.js';
import { IPromptJob } from '../types/prompt-job.js';
import { dispatchPrompt } from './dispatch.js';
import { updateTokenRules, buildCSPBypassRule } from './dnr.js';
import { HTOSStorage } from '../storage/idb.js';

// Global state - MUST remain in service worker memory only
let offscreenTabId: number | null = null;
let htosStorage: HTOSStorage;
let isInitialized = false;

// IMMUTABLE PILLAR 1: DNR rules MUST be registered synchronously on startup
chrome.runtime.onStartup.addListener(initializeServiceWorker);
chrome.runtime.onInstalled.addListener(initializeServiceWorker);

// DNR Rules - MUST be registered synchronously before any other async work
const HTOS_DNR_RULES = [
  {
    id: 1001,
    priority: 1,
    condition: {
      urlFilter: "https://chat.openai.com/backend-api/*",
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
    },
    action: {
      type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
      requestHeaders: [{
        header: "Authorization",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: ""
      }]
    }
  },
  {
    id: 1002,
    priority: 1,
    condition: {
      urlFilter: "https://claude.ai/api/*",
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
    },
    action: {
      type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
      requestHeaders: [{
        header: "Authorization",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: ""
      }]
    }
  },
  {
    id: 1003,
    priority: 1,
    condition: {
      urlFilter: "https://gemini.google.com/app/*",
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
    },
    action: {
      type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
      requestHeaders: [{
        header: "Authorization",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: ""
      }]
    }
  }
];

/**
 * Initialize service worker - CRITICAL: DNR rules MUST be first
 */
async function initializeServiceWorker(): Promise<void> {
  if (isInitialized) return;
  
  console.log('[HTOS] Initializing service worker...');
  
  // IMMUTABLE PILLAR 1: Register DNR rules SYNCHRONOUSLY before any other work
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: HTOS_DNR_RULES,
      removeRuleIds: HTOS_DNR_RULES.map(rule => rule.id)
    });
    console.log('[HTOS] DNR rules registered successfully');
  } catch (error) {
    console.error('[HTOS] Failed to register DNR rules:', error);
    throw error;
  }
  
  // Initialize IndexedDB storage
  htosStorage = new HTOSStorage();
  await htosStorage.init();
  console.log('[HTOS] IndexedDB storage initialized');
  
  // IMMUTABLE PILLAR 2: Ensure offscreen document
  await ensureOffscreen();
  
  // Setup token refresh alarm
  await chrome.alarms.create('tokenRefresh', { periodInMinutes: 30 });
  console.log('[HTOS] Token refresh alarm created');
  
  isInitialized = true;
  console.log('[HTOS] Service worker initialized');
  // Initialize BroadcastChannel bus
  const bus = new ServiceWorkerBus();
  await bus.init();
}

/**
 * IMMUTABLE PILLAR 2: Offscreen document singleton
 */
async function ensureOffscreen(): Promise<void> {
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
      url: chrome.runtime.getURL('dist/host/0h.html'),
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

/**
 * Token management - IMMUTABLE PILLAR 3: SW-only authority
 */
const tokenManager: ITokenStore = {
  async get(provider: string): Promise<IToken | undefined> {
    const storageToken = await htosStorage.getToken(provider);
    if (!storageToken) return undefined;
    
    // Convert storage schema to IToken interface
    return {
      provider: storageToken.provider,
      value: storageToken.token,
      expiresAt: storageToken.expires
    };
  },
  
  async set(token: IToken): Promise<void> {
    // Convert IToken to storage schema
    await htosStorage.setToken(token.provider, {
      type: 'session',
      token: token.value,
      expires: token.expiresAt
    });
    // Update DNR rule with new token
    await updateTokenRules(token.provider, token.value);
  },
  
  async delete(provider: string): Promise<void> {
    await htosStorage.removeToken(provider);
    await updateTokenRules(provider, '');
  }
};

/**
 * Update DNR rule with new token value
 */
async function updateDNRToken(provider: string, tokenValue: string): Promise<void> {
  const ruleId = getRuleIdForProvider(provider);
  if (!ruleId) return;
  
  try {
    const rule = HTOS_DNR_RULES.find(r => r.id === ruleId);
    if (rule && rule.action.requestHeaders) {
      rule.action.requestHeaders[0].value = tokenValue;
      
      await chrome.declarativeNetRequest.updateSessionRules({
        addRules: [rule],
        removeRuleIds: [ruleId]
      });
    }
  } catch (error) {
    console.error(`[HTOS] Failed to update DNR token for ${provider}:`, error);
  }
}

function getRuleIdForProvider(provider: string): number | null {
  switch (provider) {
    case 'chatgpt': return 1001;
    case 'claude': return 1002; 
    case 'gemini': return 1003;
    default: return null;
  }
}

/**
 * Legacy Message handling - DEPRECATED
 * Replaced by BroadcastChannel bus for all messaging
 * Keeping CSP bypass functionality until fully migrated
 */
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
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

async function handleMessage(msg: any): Promise<any> {
  switch (msg.type) {
    case 'htos.token.get': {
      const token = await tokenManager.get(msg.provider);
      return { id: msg.id, ok: true, data: token };
    }
    case 'htos.token.set': {
      await tokenManager.set(msg.token);
      return { id: msg.id, ok: true };
    }
    case 'htos.dispatch': {
      try {
        const job: IPromptJob = {
          id: msg.id || crypto.randomUUID(),
          prompt: msg.prompt,
          providers: msg.providers,
        };
        const result = await dispatchPrompt(job);
        return { id: job.id, ok: true, data: result };
      } catch (error) {
        return { id: msg.id || crypto.randomUUID(), ok: false, error: (error as Error).message };
      }
    }
    case 'htos.csp.allowOnce': {
      try {
        const { tabId, url } = msg;
        const rule = buildCSPBypassRule(9999, url);
        await chrome.declarativeNetRequest.updateSessionRules({
          addRules: [rule]
        });
        await chrome.tabs.reload(tabId);
        return { id: msg.id, ok: true };
      } catch (error) {
        return { id: msg.id, ok: false, error: (error as Error).message };
      }
    }
    default:
      return { id: msg.id, ok: false, error: 'Unknown message type' };
  }
}

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

// Service worker lifecycle events
chrome.runtime.onStartup.addListener(initializeServiceWorker);
chrome.runtime.onInstalled.addListener(initializeServiceWorker);