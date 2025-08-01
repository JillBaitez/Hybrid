/**
 * HTOS Simple Message Bus - Pragmatic Integration
 * 
 * Simplified BroadcastChannel-based messaging for Phase 2
 * Focuses on working functionality over perfect TypeScript types
 * HTOS-PILLAR-CHECK: Working system first, then refine types
 */

export type MessageSource = 'service_worker' | 'content_script' | 'offscreen' | 'popup';

export interface SimpleMessage {
  type: string;
  source: MessageSource;
  timestamp: number;
  correlationId?: string;
  data?: any;
}

/**
 * Simple Message Bus Implementation
 * Uses BroadcastChannel for reliable inter-component communication
 */
export class SimpleMessageBus {
  private channel: BroadcastChannel;
  private source: MessageSource;
  private subscriptions = new Map<string, Set<(message: SimpleMessage) => void>>();
  private isDestroyed = false;

  constructor(source: MessageSource, channelName: string = 'htos-messages') {
    this.source = source;
    this.channel = new BroadcastChannel(channelName);
    this.channel.addEventListener('message', this.handleMessage.bind(this));
    
    console.log(`[HTOS] Simple message bus initialized for ${source}`);
  }

  /**
   * Send a message
   */
  async send(type: string, data?: any): Promise<void> {
    if (this.isDestroyed) return;

    const message: SimpleMessage = {
      type,
      source: this.source,
      timestamp: Date.now(),
      data
    };

    this.channel.postMessage(message);
  }

  /**
   * Subscribe to messages of a specific type
   */
  subscribe(type: string, handler: (message: SimpleMessage) => void): () => void {
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Set());
    }
    
    this.subscriptions.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(type);
        }
      }
    };
  }

  /**
   * Broadcast a message to all contexts
   */
  async broadcast(type: string, data?: any): Promise<void> {
    await this.send(type, data);
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent<SimpleMessage>): void {
    if (this.isDestroyed) return;

    const message = event.data;
    
    // Don't process our own messages
    if (message.source === this.source) return;

    // Process subscriptions
    const handlers = this.subscriptions.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`[HTOS] Error in message handler for ${message.type}:`, error);
        }
      });
    }
  }

  /**
   * Destroy the message bus
   */
  destroy(): void {
    this.isDestroyed = true;
    this.channel.close();
    this.subscriptions.clear();
    console.log(`[HTOS] Simple message bus destroyed for ${this.source}`);
  }
}

// Global bus instances
let serviceBus: SimpleMessageBus | null = null;
let contentBus: SimpleMessageBus | null = null;
let offscreenBus: SimpleMessageBus | null = null;
let popupBus: SimpleMessageBus | null = null;

/**
 * Get message bus instance for context
 */
export function getSimpleMessageBus(source: MessageSource): SimpleMessageBus {
  switch (source) {
    case 'service_worker':
      if (!serviceBus) serviceBus = new SimpleMessageBus(source);
      return serviceBus;
      
    case 'content_script':
      if (!contentBus) contentBus = new SimpleMessageBus(source);
      return contentBus;
      
    case 'offscreen':
      if (!offscreenBus) offscreenBus = new SimpleMessageBus(source);
      return offscreenBus;
      
    case 'popup':
      if (!popupBus) popupBus = new SimpleMessageBus(source);
      return popupBus;
      
    default:
      throw new Error(`Unknown message source: ${source}`);
  }
}

/**
 * Message type constants for common use
 */
export const MessageTypes = {
  // Token management
  TOKEN_EXTRACTED: 'htos.token.extracted',
  TOKEN_REFRESH: 'htos.token.refresh',
  TOKEN_STATUS: 'htos.token.status',
  
  // DNR coordination
  DNR_ACTIVATE: 'htos.dnr.activate',
  DNR_DEACTIVATE: 'htos.dnr.deactivate',
  
  // System messages
  SYSTEM_READY: 'htos.system.ready',
  SYSTEM_ERROR: 'htos.system.error',
  
  // Prompt dispatch
  PROMPT_DISPATCH: 'htos.prompt.dispatch',
  PROMPT_RESPONSE: 'htos.prompt.response',
  
  // UI updates
  UI_UPDATE: 'htos.ui.update',
  UI_NOTIFICATION: 'htos.ui.notification'
} as const;
