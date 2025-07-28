/**
 * HTOS Service Worker
 * @security All token handling must occur in service worker, never in content scripts
 */

console.log('[HTOS] Service worker loading...');

// Initialize DNR rules for auth headers - following HARPA's pattern
function initializeAuthRules() {
  const chatgptRule = {
    id: 1001,
    priority: 1,
    condition: {
      urlFilter: "https://chat.openai.com/backend-api/*",
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
    },
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [{
        header: "Authorization",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: ""
      }]
    }
  };
  
  const claudeRule = {
    id: 1002,
    priority: 1,
    condition: {
      urlFilter: "https://claude.ai/api/*",
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
    },
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [{
        header: "Authorization",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: ""
      }]
    }
  };
  
  const geminiRule = {
    id: 1003,
    priority: 1,
    condition: {
      urlFilter: "https://*.google.com/v1beta/*",
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
    },
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [{
        header: "Authorization",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: ""
      }]
    }
  };
  
  // Add rules to session
  chrome.declarativeNetRequest.updateSessionRules({
    addRules: [chatgptRule, claudeRule, geminiRule]
  });
  
  // CRITICAL: Initialize bus controller - HARPA does this early
  initializeBusController();
  
  console.log('[HTOS] DNR rules registered successfully');
}

// Helper function to build CSP bypass rule
function buildCSPBypassRule(ruleId: number, urlFilter: string) {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      responseHeaders: [
        {
          header: "content-security-policy",
          operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
        }
      ]
    },
    condition: {
      urlFilter: urlFilter,
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
    }
  };
}

// Create offscreen document following HARPA's pattern
async function ensureOffscreenDocument() {
  // Check if offscreen document exists
  try {
    if (await chrome.offscreen.hasDocument()) {
      console.log('[HTOS] Offscreen document already exists');
      return;
    }
  } catch (error) {
    console.warn('[HTOS] Error checking offscreen document:', error);
  }
  
  try {
    // Create offscreen document for provider iframes
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('host/0h.html'),
      reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
      justification: 'Required for provider session management'
    });
    
    console.log('[HTOS] Offscreen document created');
  } catch (error) {
    console.error('[HTOS] Failed to create offscreen document:', error);
  }
}

// HARPA-style direct message handling - NO async wrapper
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[HTOS] Message received:', message?.type || 'unknown');
  
  // Direct synchronous handling for simpler messages
  if (message?.type === 'htos.ping') {
    sendResponse({ ok: true, data: 'pong' });
    return true;
  }
  
  // For async responses, use Promise and then call sendResponse
  const promise = new Promise(async (resolve) => {
    try {
      const response = await processMessage(message, sender);
      resolve(response);
    } catch (error) {
      resolve({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
  
  promise.then(response => {
    console.log('[HTOS] Sending response:', response);
    sendResponse(response);
  });
  
  // Must return true to indicate async response
  return true;
});

/**
 * Process message without nested async/await
 * HARPA uses this pattern to avoid promise chain issues
 */
async function processMessage(message: any, sender: chrome.runtime.MessageSender) {
  const msg = message || {};
  
  // Exactly match HARPA's switch statement pattern
  switch (msg.type) {
    case 'htos.dispatch':
      return handleDispatch(msg);
      
    case 'htos.csp.allowOnce':
      return handleCSPAllowOnce(msg);
      
    default:
      console.warn(`[HTOS] Unknown message type: ${msg.type}`);
      return { 
        ok: false, 
        error: `Unknown message type` 
      };
  }
}

/**
 * Handle dispatch request
 */
async function handleDispatch(msg: any) {
  try {
    // Extract prompt and providers
    const { prompt, providers } = msg;
    
    if (!prompt) {
      return { 
        ok: false, 
        error: 'Missing required parameter: prompt' 
      };
    }
    
    // Here you would call your dispatcher
    // For now returning mock response
    console.log('[HTOS] Handling dispatch for prompt:', prompt);
    
    return {
      ok: true,
      data: {
        results: [{ provider: 'mockProvider', content: 'Response to: ' + prompt }],
        timing: { duration: 123 }
      }
    };
  } catch (error) {
    console.error('[HTOS] Dispatch error:', error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error in dispatch' 
    };
  }
}

/**
 * Handle CSP bypass request
 */
async function handleCSPAllowOnce(msg: any) {
  try {
    // Extract parameters from either flat structure or payload wrapper
    const payload = msg.payload || msg;
    const { tabId, url } = payload;
    
    if (!tabId || !url) {
      return { 
        ok: false, 
        error: 'Missing required parameters: tabId and url' 
      };
    }
    
    const rule = buildCSPBypassRule(9999, url);
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [rule]
    });
    await chrome.tabs.reload(tabId);
    return { ok: true };
  } catch (error) {
    console.error('[HTOS] CSP bypass error:', error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error in CSP bypass' 
    };
  }
}

// Initialize service worker
async function initialize() {
  console.log('[HTOS] Initializing service worker...');
  
  // Initialize DNR rules first
  initializeAuthRules();
  
  // Create offscreen document
  await ensureOffscreenDocument();
  
  console.log('[HTOS] Service worker initialized');
}

// Service worker installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('[HTOS] Service worker installed');
  initialize();
});

// Service worker startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[HTOS] Service worker started');
  initialize();
});

// Start initialization
initialize();
