/**
 * DAY 6 - BUS IMPLEMENTATION (SW SIDE)
 * Service Worker side of the message bus
 * - Uses BroadcastChannel('bus.channel') to talk to offscreen doc
 * - Maps 'ask' → ProviderRegistry.ask
 * - Maps 'blobIdToObjectUrl' → chrome.runtime.getURL('_blob/' + id)
 */

import { 
  TextEventType, 
  TextEventPayload, 
  BusMessage, 
  BUS_CONFIG, 
  createBusMessage,
  BusError,
  BusTimeoutError
} from './events';
import { ProviderRegistry } from './ProviderRegistry';
import { stateManager } from './StateManager';
import { netRules } from './NetRules';

// Bus implementation for Service Worker context
export class ServiceWorkerBus {
  private channel: BroadcastChannel;
  private messageHandlers: Map<string, (message: BusMessage) => Promise<void>> = new Map();
  private activeRequests: Map<string, AbortController> = new Map();
  private isInitialized = false;

  constructor() {
    this.channel = new BroadcastChannel(BUS_CONFIG.CHANNEL_NAME);
    this.setupMessageHandlers();
  }

  /**
   * Initialize the service worker bus
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('ServiceWorkerBus: Already initialized');
      return;
    }

    try {
      // Initialize dependencies
      await netRules.init();
      await stateManager.hydrate();

      // Setup message listener
      this.channel.addEventListener('message', this.handleMessage.bind(this));

      this.isInitialized = true;
      console.log('ServiceWorkerBus: Initialized successfully');
    } catch (error) {
      console.error('ServiceWorkerBus: Failed to initialize', error);
      throw error;
    }
  }

  /**
   * Setup message handlers for each event type
   */
  private setupMessageHandlers(): void {
    this.messageHandlers.set('ask', this.handleAsk.bind(this));
    this.messageHandlers.set('blobIdToObjectUrl', this.handleBlobIdToObjectUrl.bind(this));
  }

  /**
   * Handle incoming messages from offscreen document
   */
  private async handleMessage(event: MessageEvent<BusMessage>): Promise<void> {
    const message = event.data;
    
    if (!message || typeof message !== 'object') {
      console.warn('ServiceWorkerBus: Invalid message received', message);
      return;
    }

    const handler = this.messageHandlers.get(message.type);
    if (!handler) {
      console.warn(`ServiceWorkerBus: No handler for message type: ${message.type}`);
      return;
    }

    try {
      await handler(message);
    } catch (error) {
      console.error(`ServiceWorkerBus: Error handling ${message.type}:`, error);
      
      // Send error response
      this.sendMessage('done', {
        id: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle 'ask' events - delegate to ProviderRegistry
   */
  private async handleAsk(message: BusMessage<'ask'>): Promise<void> {
    const { provider, prompt } = message.payload;
    const requestId = message.id;

    // Create abort controller for this request
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      // Validate provider is available
      if (!ProviderRegistry.isProviderAvailable(provider)) {
        throw new BusError(`Provider ${provider} is not available (missing auth token)`);
      }

      // Stream response chunks
      const stream = ProviderRegistry.ask(provider, prompt, true);
      
      for await (const chunk of stream) {
        // Check if request was aborted
        if (abortController.signal.aborted) {
          break;
        }

        // Send chunk to offscreen document
        this.sendMessage('chunk', {
          id: requestId,
          data: chunk
        });
      }

      // Send completion signal
      this.sendMessage('done', {
        id: requestId,
        usage: { provider, prompt_tokens: prompt.length } // Basic usage info
      });

    } catch (error) {
      this.sendMessage('done', {
        id: requestId,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Handle 'blobIdToObjectUrl' events - generate blob URLs
   */
  private async handleBlobIdToObjectUrl(message: BusMessage<'blobIdToObjectUrl'>): Promise<void> {
    const { id } = message.payload;
    
    try {
      // Generate object URL for blob
      const objectUrl = chrome.runtime.getURL(BUS_CONFIG.BLOB_URL_PREFIX + id);
      
      // Send response back (reusing the chunk event for URL delivery)
      this.sendMessage('chunk', {
        id: message.id,
        data: objectUrl
      });

      this.sendMessage('done', {
        id: message.id
      });

    } catch (error) {
      this.sendMessage('done', {
        id: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send message to offscreen document
   */
  private sendMessage<T extends TextEventType>(
    type: T,
    payload: TextEventPayload<T>
  ): void {
    const message = createBusMessage(type, payload);
    this.channel.postMessage(message);
  }

  /**
   * Broadcast message to all listeners
   */
  public broadcast<T extends TextEventType>(
    type: T,
    payload: TextEventPayload<T>
  ): void {
    this.sendMessage(type, payload);
  }

  /**
   * Cancel active request
   */
  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Get active request count
   */
  public get activeRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Cancel all active requests
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();

    // Close broadcast channel
    this.channel.close();
    
    this.isInitialized = false;
    console.log('ServiceWorkerBus: Destroyed');
  }

  /**
   * Health check
   */
  public get isHealthy(): boolean {
    return this.isInitialized && this.channel;
  }
}

// Service Worker Bus Test Helper
export class MockOffscreenDocument {
  private channel: BroadcastChannel;
  private responses: BusMessage[] = [];

  constructor() {
    this.channel = new BroadcastChannel(BUS_CONFIG.CHANNEL_NAME);
    this.channel.addEventListener('message', (event) => {
      this.responses.push(event.data);
    });
  }

  sendAsk(provider: string, prompt: string): string {
    const message = createBusMessage('ask', { provider, prompt });
    this.channel.postMessage(message);
    return message.id;
  }

  sendBlobRequest(blobId: string): string {
    const message = createBusMessage('blobIdToObjectUrl', { id: blobId });
    this.channel.postMessage(message);
    return message.id;
  }

  getResponses(): BusMessage[] {
    return [...this.responses];
  }

  clearResponses(): void {
    this.responses = [];
  }

  destroy(): void {
    this.channel.close();
  }
}

// Export singleton instance
export const swBus = new ServiceWorkerBus();