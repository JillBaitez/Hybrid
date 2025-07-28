/**
 * DAY 3 - NET RULES
 * Synchronous init that registers CSP-stripping & auth-header rules for text endpoints only
 */

// Provider endpoints for text-only communication
export const TEXT_ENDPOINTS = {
  CHATGPT: 'https://chat.openai.com/backend-api/*',
  CLAUDE: 'https://claude.ai/api/*',
  GEMINI: 'https://gemini.google.com/_/BardChatUi/*'
} as const;

// Rule IDs for declarativeNetRequest
export const RULE_IDS = {
  CSP_STRIP_CHATGPT: 10001,
  CSP_STRIP_CLAUDE: 10002,
  CSP_STRIP_GEMINI: 10003,
  AUTH_HEADER_CHATGPT: 10004,
  AUTH_HEADER_CLAUDE: 10005,
  AUTH_HEADER_GEMINI: 10006
} as const;

export interface NetRuleConfig {
  enableCSPStripping: boolean;
  enableAuthHeaders: boolean;
  providers: ('chatgpt' | 'claude' | 'gemini')[];
}

export class NetRules {
  private static instance: NetRules;
  private isInitialized = false;
  private activeRuleIds: number[] = [];

  private constructor() {}

  public static getInstance(): NetRules {
    if (!NetRules.instance) {
      NetRules.instance = new NetRules();
    }
    return NetRules.instance;
  }

  /**
   * Synchronous initialization - registers rules immediately
   */
  public async init(config: NetRuleConfig = this.getDefaultConfig()): Promise<void> {
    if (this.isInitialized) {
      console.warn('NetRules: Already initialized');
      return;
    }

    try {
      // Clear any existing rules first
      await this.clearRules();

      // Register new rules based on config
      const rulesToAdd: chrome.declarativeNetRequest.Rule[] = [];

      if (config.enableCSPStripping) {
        rulesToAdd.push(...this.createCSPStripRules(config.providers));
      }

      if (config.enableAuthHeaders) {
        rulesToAdd.push(...this.createAuthHeaderRules(config.providers));
      }

      if (rulesToAdd.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: rulesToAdd
        });
        
        this.activeRuleIds = rulesToAdd.map(rule => rule.id);
        console.log(`NetRules: Registered ${rulesToAdd.length} rules for providers:`, config.providers);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('NetRules: Failed to initialize', error);
      throw error;
    }
  }

  /**
   * Create CSP-stripping rules for text endpoints
   */
  private createCSPStripRules(providers: string[]): chrome.declarativeNetRequest.Rule[] {
    const rules: chrome.declarativeNetRequest.Rule[] = [];

    providers.forEach(provider => {
      switch (provider) {
        case 'chatgpt':
          rules.push({
            id: RULE_IDS.CSP_STRIP_CHATGPT,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              responseHeaders: [
                {
                  header: 'content-security-policy',
                  operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
                },
                {
                  header: 'content-security-policy-report-only',
                  operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
                }
              ]
            },
            condition: {
              urlFilter: TEXT_ENDPOINTS.CHATGPT,
              resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
            }
          });
          break;

        case 'claude':
          rules.push({
            id: RULE_IDS.CSP_STRIP_CLAUDE,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              responseHeaders: [
                {
                  header: 'content-security-policy',
                  operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
                },
                {
                  header: 'content-security-policy-report-only',
                  operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
                }
              ]
            },
            condition: {
              urlFilter: TEXT_ENDPOINTS.CLAUDE,
              resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
            }
          });
          break;

        case 'gemini':
          rules.push({
            id: RULE_IDS.CSP_STRIP_GEMINI,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              responseHeaders: [
                {
                  header: 'content-security-policy',
                  operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
                },
                {
                  header: 'content-security-policy-report-only',
                  operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
                }
              ]
            },
            condition: {
              urlFilter: TEXT_ENDPOINTS.GEMINI,
              resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
            }
          });
          break;
      }
    });

    return rules;
  }

  /**
   * Create auth header injection rules for text endpoints
   */
  private createAuthHeaderRules(providers: string[]): chrome.declarativeNetRequest.Rule[] {
    const rules: chrome.declarativeNetRequest.Rule[] = [];

    providers.forEach(provider => {
      switch (provider) {
        case 'chatgpt':
          rules.push({
            id: RULE_IDS.AUTH_HEADER_CHATGPT,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              requestHeaders: [
                {
                  header: 'authorization',
                  operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                  value: 'Bearer {{HTOS_CHATGPT_TOKEN}}'
                }
              ]
            },
            condition: {
              urlFilter: TEXT_ENDPOINTS.CHATGPT,
              resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
            }
          });
          break;

        case 'claude':
          rules.push({
            id: RULE_IDS.AUTH_HEADER_CLAUDE,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              requestHeaders: [
                {
                  header: 'cookie',
                  operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                  value: 'sessionKey={{HTOS_CLAUDE_TOKEN}}'
                }
              ]
            },
            condition: {
              urlFilter: TEXT_ENDPOINTS.CLAUDE,
              resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
            }
          });
          break;

        case 'gemini':
          rules.push({
            id: RULE_IDS.AUTH_HEADER_GEMINI,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              requestHeaders: [
                {
                  header: 'cookie',
                  operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                  value: '__Secure-1PSID={{HTOS_GEMINI_TOKEN}}'
                }
              ]
            },
            condition: {
              urlFilter: TEXT_ENDPOINTS.GEMINI,
              resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
            }
          });
          break;
      }
    });

    return rules;
  }

  /**
   * Clear all dynamic rules
   */
  public async clearRules(): Promise<void> {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);
      
      if (ruleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
        console.log(`NetRules: Cleared ${ruleIds.length} existing rules`);
      }
      
      this.activeRuleIds = [];
    } catch (error) {
      console.error('NetRules: Failed to clear rules', error);
      throw error;
    }
  }

  /**
   * Get current active rules
   */
  public async getActiveRules(): Promise<chrome.declarativeNetRequest.Rule[]> {
    try {
      return await chrome.declarativeNetRequest.getDynamicRules();
    } catch (error) {
      console.error('NetRules: Failed to get active rules', error);
      return [];
    }
  }

  /**
   * Update token placeholders in auth header rules
   */
  public async updateTokens(tokens: Record<string, string>): Promise<void> {
    try {
      const activeRules = await this.getActiveRules();
      const updatedRules: chrome.declarativeNetRequest.Rule[] = [];

      activeRules.forEach(rule => {
        if (rule.action.type === chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS) {
          const modifyAction = rule.action as chrome.declarativeNetRequest.ModifyHeaderInfo;
          const requestHeaders = modifyAction.requestHeaders;
          
          if (requestHeaders) {
            const updatedHeaders = requestHeaders.map(header => {
              let value = header.value || '';
              
              // Replace token placeholders
              Object.entries(tokens).forEach(([provider, token]) => {
                const placeholder = `{{HTOS_${provider.toUpperCase()}_TOKEN}}`;
                value = value.replace(placeholder, token);
              });
              
              return { ...header, value };
            });

            updatedRules.push({
              ...rule,
              action: {
                ...rule.action,
                requestHeaders: updatedHeaders
              }
            });
          }
        }
      });

      if (updatedRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: activeRules.map(rule => rule.id),
          addRules: updatedRules
        });
        console.log(`NetRules: Updated ${updatedRules.length} rules with new tokens`);
      }
    } catch (error) {
      console.error('NetRules: Failed to update tokens', error);
      throw error;
    }
  }

  /**
   * Default configuration
   */
  private getDefaultConfig(): NetRuleConfig {
    return {
      enableCSPStripping: true,
      enableAuthHeaders: true,
      providers: ['chatgpt', 'claude', 'gemini']
    };
  }

  /**
   * Check if NetRules is initialized
   */
  public get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get active rule IDs
   */
  public get ruleIds(): number[] {
    return [...this.activeRuleIds];
  }
}

// Export singleton instance
export const netRules = NetRules.getInstance();