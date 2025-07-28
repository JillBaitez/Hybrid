/**
 * DAY 7 - OFFSCREEN DOC (OS SIDE)
 * Offscreen document implementation
 * - chrome.offscreen.createDocument singleton
 * - Hosts text-only iframes (no visual chrome)
 * - Relays blob ↔ token securely
 */

import { 
  TextEventType, 
  TextEventPayload, 
  BusMessage, 
  BUS_CONFIG, 
  createBusMessage,
  BusError
} from './events';
import { stateManager } from './StateManager';

// Offscreen document configuration
export const OFFSCREEN_CONFIG = {
  URL: 'agent/offscreen.html',
  REASONS: ['USER_MEDIA', 'GEOLOCATION'],
  JUSTIFICATION: 'Text-only provider iframes for secure authentication'
} as const;

// Provider iframe configurations
interface IframeConfig {
  url: string;
  sandbox: string[];
  allowedOrigins: string[];
}

const IFRAME_CONFIGS: Record<string, IframeConfig> = {
  openai: {
    url: 'https://chat.openai.com',
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms'],
    allowedOrigins: ['https://chat.openai.com']
  },
  claude: {
    url: 'https://claude.ai',
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms'],
    allowedOrigins: ['https://claude.ai']
  },
  gemini: {
    url: 'https://gemini.google.com',
    sandbox: ['allow-scripts', 'allow-same-origin', 'allow-forms'],
    allowedOrigins: ['https://gemini.google.com']
  }
};

// Offscreen Document Manager
export class OffscreenDocument {
  private static instance: OffscreenDocument;
  private channel: BroadcastChannel;
  private iframes: Map<string, HTMLIFrameElement> = new Map();
  private tokenCache: Map<string, string> = new Map();
  private isInitialized = false;

  private constructor() {
    this.channel = new BroadcastChannel(BUS_CONFIG.CHANNEL_NAME);
    this.setupMessageHandlers();
  }

  public static getInstance(): OffscreenDocument {
    if (!OffscreenDocument.instance) {
      OffscreenDocument.instance = new OffscreenDocument();
    }
    return OffscreenDocument.instance;
  }

  /**
   * Create and initialize offscreen document
   */
  public static async create(): Promise<OffscreenDocument> {
    try {
      // Check if offscreen document already exists
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });

      if (existingContexts.length === 0) {
        // Create new offscreen document
        await chrome.offscreen.createDocument({
          url: OFFSCREEN_CONFIG.URL,
          reasons: OFFSCREEN_CONFIG.REASONS as any,
          justification: OFFSCREEN_CONFIG.JUSTIFICATION
        });
      }

      const instance = OffscreenDocument.getInstance();
      await instance.init();
      return instance;
    } catch (error) {
      console.error('OffscreenDocument: Failed to create', error);
      throw error;
    }
  }

  /**
   * Initialize the offscreen document
   */
  private async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('OffscreenDocument: Already initialized');
      return;
    }

    try {
      // Load tokens from state manager
      await this.loadTokens();

      // Create provider iframes
      await this.createProviderIframes();

      this.isInitialized = true;
      console.log('OffscreenDocument: Initialized successfully');
    } catch (error) {
      console.error('OffscreenDocument: Failed to initialize', error);
      throw error;
    }
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    this.channel.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Handle messages from service worker
   */
  private async handleMessage(event: MessageEvent<BusMessage>): Promise<void> {
    const message = event.data;
    
    if (!message || typeof message !== 'object') {
      console.warn('OffscreenDocument: Invalid message received', message);
      return;
    }

    try {
      switch (message.type) {
        case 'chunk':
          await this.handleChunk(message as BusMessage<'chunk'>);
          break;
        case 'done':
          await this.handleDone(message as BusMessage<'done'>);
          break;
        default:
          console.warn(`OffscreenDocument: Unhandled message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`OffscreenDocument: Error handling ${message.type}:`, error);
    }
  }

  /**
   * Handle chunk messages (text data or blob URLs)
   */
  private async handleChunk(message: BusMessage<'chunk'>): Promise<void> {
    const { id, data } = message.payload;
    
    // If it's a blob URL, store it for the UI
    if (data.startsWith('chrome-extension://')) {
      console.log(`OffscreenDocument: Received blob URL for ${id}: ${data}`);
      // Store blob URL in local storage for UI access
      localStorage.setItem(`blob_url_${id}`, data);
    } else {
      // It's text data - could relay to UI if needed
      console.log(`OffscreenDocument: Received chunk for ${id}: ${data.slice(0, 50)}...`);
    }
  }

  /**
   * Handle done messages (completion or error)
   */
  private async handleDone(message: BusMessage<'done'>): Promise<void> {
    const { id, usage, error } = message.payload;
    
    if (error) {
      console.error(`OffscreenDocument: Request ${id} failed: ${error}`);
    } else {
      console.log(`OffscreenDocument: Request ${id} completed`, usage);
    }

    // Clean up any related resources
    this.cleanupRequest(id);
  }

  /**
   * Load authentication tokens from secure storage
   */
  private async loadTokens(): Promise<void> {
    try {
      // Load from StateManager
      await stateManager.hydrate();
      
      // Cache tokens for iframe communication
      const providers = ['openai', 'claude', 'gemini'];
      for (const provider of providers) {
        const token = stateManager.getToken(provider);
        if (token) {
          this.tokenCache.set(provider, token);
        }
      }

      console.log(`OffscreenDocument: Loaded ${this.tokenCache.size} tokens`);
    } catch (error) {
      console.error('OffscreenDocument: Failed to load tokens', error);
    }
  }

  /**
   * Create text-only iframes for each provider
   */
  private async createProviderIframes(): Promise<void> {
    const container = document.getElementById('iframe-container') || this.createIframeContainer();

    for (const [provider, config] of Object.entries(IFRAME_CONFIGS)) {
      try {
        const iframe = this.createProviderIframe(provider, config);
        container.appendChild(iframe);
        this.iframes.set(provider, iframe);
        
        console.log(`OffscreenDocument: Created iframe for ${provider}`);
      } catch (error) {
        console.error(`OffscreenDocument: Failed to create iframe for ${provider}:`, error);
      }
    }
  }

  /**
   * Create iframe container element
   */
  private createIframeContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'iframe-container';
    container.style.display = 'none'; // Hidden - text-only
    document.body.appendChild(container);
    return container;
  }

  /**
   * Create individual provider iframe
   */
  private createProviderIframe(provider: string, config: IframeConfig): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    
    // Security configuration
    iframe.src = config.url;
    iframe.sandbox.add(...config.sandbox);
    iframe.style.display = 'none'; // Hidden - text-only
    iframe.width = '0';
    iframe.height = '0';
    
    // Set iframe attributes for identification
    iframe.setAttribute('data-provider', provider);
    iframe.setAttribute('data-purpose', 'text-only-auth');

    // Setup message handler for iframe communication
    iframe.addEventListener('load', () => {
      this.setupIframeAuth(provider, iframe);
    });

    return iframe;
  }

  /**
   * Setup authentication for provider iframe
   */
  private async setupIframeAuth(provider: string, iframe: HTMLIFrameElement): Promise<void> {
    try {
      const token = this.tokenCache.get(provider);
      if (!token) {
        console.warn(`OffscreenDocument: No token available for ${provider}`);
        return;
      }

      // Inject authentication into iframe
      await this.injectProviderAuth(provider, iframe, token);
      
      console.log(`OffscreenDocument: Authentication setup complete for ${provider}`);
    } catch (error) {
      console.error(`OffscreenDocument: Failed to setup auth for ${provider}:`, error);
    }
  }

  /**
   * Inject provider-specific authentication
   */
  private async injectProviderAuth(provider: string, iframe: HTMLIFrameElement, token: string): Promise<void> {
    const config = IFRAME_CONFIGS[provider];
    if (!config) return;

    try {
      // Use postMessage to communicate with iframe securely
      const authMessage = {
        type: 'AUTH_INJECT',
        provider,
        token,
        timestamp: Date.now()
      };

      // Wait for iframe to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      iframe.contentWindow?.postMessage(authMessage, config.url);
    } catch (error) {
      console.error(`OffscreenDocument: Failed to inject auth for ${provider}:`, error);
    }
  }

  /**
   * Send message to service worker
   */
  public sendMessage<T extends TextEventType>(
    type: T,
    payload: TextEventPayload<T>
  ): void {
    const message = createBusMessage(type, payload);
    this.channel.postMessage(message);
  }

  /**
   * Extract token from provider iframe
   */
  public async extractToken(provider: string): Promise<string | null> {
    const iframe = this.iframes.get(provider);
    if (!iframe) {
      console.warn(`OffscreenDocument: No iframe found for ${provider}`);
      return null;
    }

    try {
      // Request token extraction from iframe
      const extractMessage = {
        type: 'TOKEN_EXTRACT',
        provider,
        timestamp: Date.now()
      };

      const config = IFRAME_CONFIGS[provider];
      iframe.contentWindow?.postMessage(extractMessage, config.url);

      // Wait for token response (simplified - in production would use proper promise/callback)
      return new Promise((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'TOKEN_RESPONSE' && event.data?.provider === provider) {
            window.removeEventListener('message', handler);
            resolve(event.data.token || null);
          }
        };
        
        window.addEventListener('message', handler);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          window.removeEventListener('message', handler);
          resolve(null);
        }, 5000);
      });
    } catch (error) {
      console.error(`OffscreenDocument: Failed to extract token for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Update cached token for provider
   */
  public updateToken(provider: string, token: string): void {
    this.tokenCache.set(provider, token);
    stateManager.setToken(provider, token);
    
    // Update iframe auth if it exists
    const iframe = this.iframes.get(provider);
    if (iframe) {
      this.setupIframeAuth(provider, iframe);
    }
  }

  /**
   * Clean up request resources
   */
  private cleanupRequest(requestId: string): void {
    // Remove any stored blob URLs for this request
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes(requestId)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Get iframe for provider
   */
  public getIframe(provider: string): HTMLIFrameElement | undefined {
    return this.iframes.get(provider);
  }

  /**
   * Check if document is ready
   */
  public get isReady(): boolean {
    return this.isInitialized && this.iframes.size > 0;
  }

  /**
   * Destroy offscreen document
   */
  public async destroy(): Promise<void> {
    try {
      // Clean up iframes
      for (const iframe of this.iframes.values()) {
        iframe.remove();
      }
      this.iframes.clear();

      // Close broadcast channel
      this.channel.close();

      // Clear token cache
      this.tokenCache.clear();

      this.isInitialized = false;
      console.log('OffscreenDocument: Destroyed');
    } catch (error) {
      console.error('OffscreenDocument: Error during destroy', error);
    }
  }
}

// Export singleton access
export const offscreenDocument = OffscreenDocument.getInstance();