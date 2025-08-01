/**
 * HTOS Provider Registry - Multi-Provider Abstraction Layer
 * 
 * Implements provider-specific authentication, token extraction, and API patterns
 * Supports ChatGPT, Claude, Gemini with extensible architecture for new providers
 * HTOS-PILLAR-CHECK: Provider-agnostic orchestration with specific implementations
 */

export interface IProviderConfig {
  name: string;
  domain: string;
  apiEndpoints: string[];
  tokenType: 'session' | 'api_key' | 'bearer';
  tokenExpirationHours: number;
  authenticationPattern: 'cookie' | 'header' | 'hybrid';
  requiresCSPBypass: boolean;
  supportedFeatures: string[];
}

export interface IProviderAdapter {
  config: IProviderConfig;
  extractToken(domain: string): Promise<string | null>;
  validateToken(token: string): Promise<boolean>;
  getAuthHeaders(token: string): Record<string, string>;
  detectAuthenticationSuccess(url: string, headers?: Record<string, string>): boolean;
  buildDNRRules(token: string, tabId: number): chrome.declarativeNetRequest.Rule[];
}

/**
 * Base provider adapter with common functionality
 */
export abstract class BaseProviderAdapter implements IProviderAdapter {
  abstract config: IProviderConfig;

  /**
   * Default token extraction - can be overridden by specific providers
   */
  async extractToken(domain: string): Promise<string | null> {
    try {
      // Create extraction iframe
      const iframe = await this.createExtractionIframe(domain);
      
      try {
        // Send extraction message
        const token = await this.sendExtractionMessage(iframe, {
          type: 'htos.extract.token',
          domain,
          provider: this.config.name
        });
        
        return token;
      } finally {
        iframe.remove();
      }
    } catch (error) {
      console.error(`[HTOS] Token extraction failed for ${this.config.name}:`, error);
      return null;
    }
  }

  /**
   * Default token validation - can be overridden
   */
  async validateToken(token: string): Promise<boolean> {
    return !!(token && token.length > 10); // Basic validation, ensure boolean return
  }

  /**
   * Get authentication headers for API requests
   */
  abstract getAuthHeaders(token: string): Record<string, string>;

  /**
   * Detect successful authentication from URL/headers
   */
  abstract detectAuthenticationSuccess(url: string, headers?: Record<string, string>): boolean;

  /**
   * Build DNR rules for this provider
   */
  abstract buildDNRRules(token: string, tabId: number): chrome.declarativeNetRequest.Rule[];

  /**
   * Create iframe for token extraction
   */
  protected async createExtractionIframe(domain: string): Promise<HTMLIFrameElement> {
    const iframe = document.createElement('iframe');
    
    iframe.src = `https://${domain}`;
    iframe.name = `htos-extract-${this.config.name}`;
    iframe.sandbox = 'allow-scripts allow-same-origin allow-storage-access-by-user-activation';
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none';
    
    document.body.appendChild(iframe);
    
    // Wait for iframe to load
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Iframe load timeout')), 10000);
      
      iframe.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      iframe.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Iframe load error'));
      };
    });
    
    return iframe;
  }

  /**
   * Send extraction message to iframe
   */
  protected async sendExtractionMessage(iframe: HTMLIFrameElement, message: any): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const messageId = crypto.randomUUID();
      const timeout = setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        reject(new Error('Token extraction timeout'));
      }, 30000);
      
      const messageHandler = (event: MessageEvent) => {
        if (event.source === iframe.contentWindow && event.data?.id === messageId) {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          
          if (event.data.success) {
            resolve(event.data.token);
          } else {
            reject(new Error(event.data.error || 'Token extraction failed'));
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      iframe.contentWindow?.postMessage({
        ...message,
        id: messageId
      }, '*');
    });
  }
}

/**
 * ChatGPT Provider Adapter
 */
export class ChatGPTAdapter extends BaseProviderAdapter {
  config: IProviderConfig = {
    name: 'chatgpt',
    domain: 'chat.openai.com',
    apiEndpoints: [
      '*://chat.openai.com/backend-api/conversation*',
      '*://chatgpt.com/backend-api/conversation*'
    ],
    tokenType: 'session',
    tokenExpirationHours: 24,
    authenticationPattern: 'cookie',
    requiresCSPBypass: true,
    supportedFeatures: ['streaming', 'file_upload', 'code_execution']
  };

  getAuthHeaders(token: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  detectAuthenticationSuccess(url: string, headers?: Record<string, string>): boolean {
    return url.includes('chat.openai.com') && 
           (url.includes('/chat') || url.includes('/backend-api/'));
  }

  buildDNRRules(token: string, tabId: number): chrome.declarativeNetRequest.Rule[] {
    const baseId = 100000 + tabId;
    
    return [
      {
        id: baseId,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: 'Authorization',
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: `Bearer ${token}`
            }
          ]
        },
        condition: {
          urlFilter: '*://chat.openai.com/backend-api/conversation*',
          tabIds: [tabId],
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
        }
      },
      {
        id: baseId + 1,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: 'Authorization',
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: `Bearer ${token}`
            }
          ]
        },
        condition: {
          urlFilter: '*://chatgpt.com/backend-api/conversation*',
          tabIds: [tabId],
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
        }
      }
    ];
  }
}

/**
 * Claude Provider Adapter
 */
export class ClaudeAdapter extends BaseProviderAdapter {
  config: IProviderConfig = {
    name: 'claude',
    domain: 'claude.ai',
    apiEndpoints: [
      '*://claude.ai/api/append_message*',
      '*://claude.ai/api/organizations/*/chat_conversations*'
    ],
    tokenType: 'session',
    tokenExpirationHours: 24,
    authenticationPattern: 'cookie',
    requiresCSPBypass: true,
    supportedFeatures: ['streaming', 'file_upload', 'artifacts']
  };

  getAuthHeaders(token: string): Record<string, string> {
    return {
      'Cookie': token,
      'Content-Type': 'application/json'
    };
  }

  detectAuthenticationSuccess(url: string, headers?: Record<string, string>): boolean {
    return url.includes('claude.ai') && 
           (url.includes('/chat') || url.includes('/api/'));
  }

  buildDNRRules(token: string, tabId: number): chrome.declarativeNetRequest.Rule[] {
    const baseId = 200000 + tabId;
    
    return [
      {
        id: baseId,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: 'Cookie',
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: token
            }
          ]
        },
        condition: {
          urlFilter: '*://claude.ai/api/append_message*',
          tabIds: [tabId],
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
        }
      }
    ];
  }
}

/**
 * Gemini Provider Adapter
 */
export class GeminiAdapter extends BaseProviderAdapter {
  config: IProviderConfig = {
    name: 'gemini',
    domain: 'gemini.google.com',
    apiEndpoints: [
      '*://gemini.google.com/_/BardChatUi/data/batchexecute*'
    ],
    tokenType: 'session',
    tokenExpirationHours: 12,
    authenticationPattern: 'cookie',
    requiresCSPBypass: false,
    supportedFeatures: ['streaming', 'multimodal']
  };

  getAuthHeaders(token: string): Record<string, string> {
    return {
      'Cookie': token,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  }

  detectAuthenticationSuccess(url: string, headers?: Record<string, string>): boolean {
    return url.includes('gemini.google.com') && 
           url.includes('/app');
  }

  buildDNRRules(token: string, tabId: number): chrome.declarativeNetRequest.Rule[] {
    const baseId = 300000 + tabId;
    
    return [
      {
        id: baseId,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: 'Cookie',
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: token
            }
          ]
        },
        condition: {
          urlFilter: '*://gemini.google.com/_/BardChatUi/data/batchexecute*',
          tabIds: [tabId],
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]
        }
      }
    ];
  }
}

/**
 * Provider Registry - Central management of all providers
 */
export class ProviderRegistry {
  private providers = new Map<string, IProviderAdapter>();
  private domainToProvider = new Map<string, string>();

  constructor() {
    this.registerDefaultProviders();
  }

  /**
   * Register default providers
   */
  private registerDefaultProviders(): void {
    const chatgpt = new ChatGPTAdapter();
    const claude = new ClaudeAdapter();
    const gemini = new GeminiAdapter();

    this.registerProvider(chatgpt);
    this.registerProvider(claude);
    this.registerProvider(gemini);
  }

  /**
   * Register a provider adapter
   */
  registerProvider(adapter: IProviderAdapter): void {
    this.providers.set(adapter.config.name, adapter);
    this.domainToProvider.set(adapter.config.domain, adapter.config.name);
    
    console.log(`[HTOS] Registered provider: ${adapter.config.name}`);
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): IProviderAdapter | null {
    return this.providers.get(name) || null;
  }

  /**
   * Get provider by domain
   */
  getProviderByDomain(domain: string): IProviderAdapter | null {
    const providerName = this.domainToProvider.get(domain);
    return providerName ? this.getProvider(providerName) : null;
  }

  /**
   * Get provider by URL
   */
  getProviderByUrl(url: string): IProviderAdapter | null {
    for (const [domain, providerName] of this.domainToProvider) {
      if (url.includes(domain)) {
        return this.getProvider(providerName);
      }
    }
    return null;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): IProviderAdapter[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider configurations
   */
  getProviderConfigs(): Record<string, IProviderConfig> {
    const configs: Record<string, IProviderConfig> = {};
    for (const [name, adapter] of this.providers) {
      configs[name] = adapter.config;
    }
    return configs;
  }

  /**
   * Check if domain is supported
   */
  isSupported(domain: string): boolean {
    return this.domainToProvider.has(domain);
  }

  /**
   * Get API endpoints for DNR rule matching
   */
  getAllApiEndpoints(): string[] {
    const endpoints: string[] = [];
    for (const adapter of this.providers.values()) {
      endpoints.push(...adapter.config.apiEndpoints);
    }
    return endpoints;
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();
