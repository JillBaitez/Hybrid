/**
 * HTOS Declarative Net Request Rule Builder
 * @security Handles token injection at runtime - never logs tokens
 */

export interface HTOSRule {
  id: number;
  priority: number;
  condition: {
    urlFilter: string;
    resourceTypes: chrome.declarativeNetRequest.ResourceType[];
  };
  action: {
    type: chrome.declarativeNetRequest.RuleActionType;
    requestHeaders?: chrome.declarativeNetRequest.ModifyHeaderInfo[];
    responseHeaders?: chrome.declarativeNetRequest.ModifyHeaderInfo[];
  };
}

/**
 * Build authorization header injection rule
 */
export function buildAuthRule(id: number, urlFilter: string, token: string): HTOSRule {
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

/**
 * Build CSP bypass rule for emergency access
 */
export function buildCSPBypassRule(id: number, urlFilter: string): HTOSRule {
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

/**
 * Updates session rules with token injection
 * @security Replaces existing rules to prevent token leakage
 */
export async function updateTokenRules(provider: string, token: string): Promise<void> {
  const ruleId = getProviderRuleId(provider);
  const urlFilter = getProviderUrlFilter(provider);
  
  // Remove existing rule first
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId]
  });
  
  // Add new rule with fresh token
  const rule = buildAuthRule(ruleId, urlFilter, token);
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: [rule]
  });
}

function getProviderRuleId(provider: string): number {
  const ruleIds: Record<string, number> = {
    'chatgpt': 10001,
    'claude': 10002,
    'gemini': 10003
  };
  return ruleIds[provider] || 10000;
}

function getProviderUrlFilter(provider: string): string {
  const urlFilters: Record<string, string> = {
    'chatgpt': '*://chat.openai.com/backend-api/*',
    'claude': '*://claude.ai/api/*',
    'gemini': '*://gemini.google.com/app/*'
  };
  return urlFilters[provider] || '*://*/*';
}