/**
 * HTOS Message Bus - BroadcastChannel Implementation
 * 
 * Unified communication system for all extension components
 * Replaces chrome.runtime.sendMessage with more reliable BroadcastChannel
 * HTOS-PILLAR-CHECK: Reliable inter-component communication with message persistence
 */

import { 
  BaseMessage, 
  HTOSMessage, 
  MessageSource, 
  MessageTarget, 
  MessageResponse,
  MessageType,
  isHTOSMessage,
  createMessage,
  createResponse
} from '../types/message-bus';

export interface MessageHandler<T extends HTOSMessage = HTOSMessage> {
  (message: T): Promise<void> | void;
}

export interface MessageSubscription {
  id: string;
  messageType: MessageType | MessageType[];
  handler: MessageHandler;
  source?: MessageSource;
  once?: boolean;
}

export interface MessageBusOptions {
  channelName?: string;
  enablePersistence?: boolean;
  maxQueueSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Core Message Bus Implementation
 */
export class HTOSMessageBus {
  private channel: BroadcastChannel;
  private subscriptions = new Map<string, MessageSubscription>();
  private pendingResponses = new Map<string, {
    resolve: (response: MessageResponse) => void;
    reject: (error: Error) => void;
    timeout: number;
  }>();
  private messageQueue: HTOSMessage[] = [];
  private isOnline = true;
  private source: MessageSource;
  private options: Required<MessageBusOptions>;

  constructor(source: MessageSource, options: MessageBusOptions = {}) {
    this.source = source;
    this.options = {
      channelName: 'htos-message-bus',
      enablePersistence: true,
      maxQueueSize: 1000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };

    // Initialize BroadcastChannel
    this.channel = new BroadcastChannel(this.options.channelName);
    this.channel.addEventListener('message', this.handleIncomingMessage.bind(this));

    // Handle channel errors
    this.channel.addEventListener('messageerror', (event) => {
      console.error('[HTOS] Message bus error:', event);
    });

    // Initialize persistence if enabled
    if (this.options.enablePersistence) {
      this.initializePersistence();
    }

    console.log(`[HTOS] Message bus initialized for ${source}`);
  }

  /**
   * Subscribe to messages of specific types
   */
  subscribe<T extends HTOSMessage>(
    messageType: T['type'] | T['type'][],
    handler: MessageHandler<T>,
    options?: {
      source?: MessageSource;
      once?: boolean;
    }
  ): string {
    const subscriptionId = crypto.randomUUID();
    
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      messageType: Array.isArray(messageType) ? messageType : [messageType],
      handler: handler as MessageHandler,
      source: options?.source,
      once: options?.once || false
    });

    console.log(`[HTOS] Subscribed to ${Array.isArray(messageType) ? messageType.join(', ') : messageType}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(subscriptionId: string): boolean {
    const removed = this.subscriptions.delete(subscriptionId);
    if (removed) {
      console.log(`[HTOS] Unsubscribed ${subscriptionId}`);
    }
    return removed;
  }

  /**
   * Send a message (fire and forget)
   */
  async send<T extends HTOSMessage>(
    type: T['type'],
    data: T['data'],
    options?: {
      target?: MessageTarget;
      priority?: T['priority'];
    }
  ): Promise<void> {
    const message = createMessage<T>(type, this.source, data, {
      target: options?.target,
      priority: options?.priority
    });

    await this.sendMessage(message);
  }

  /**
   * Send a message and wait for response
   */
  async sendAndWaitForResponse<T extends HTOSMessage, R = any>(
    type: T['type'],
    data: T['data'],
    options?: {
      target?: MessageTarget;
      timeout?: number;
    }
  ): Promise<MessageResponse<R>> {
    const correlationId = crypto.randomUUID();
    const timeout = options?.timeout || 30000; // 30 second default

    const message = createMessage<T>(type, this.source, data, {
      target: options?.target,
      correlationId
    });

    // Set up response handler
    const responsePromise = new Promise<MessageResponse<R>>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(correlationId);
        reject(new Error(`Message timeout after ${timeout}ms`));
      }, timeout);

      this.pendingResponses.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutId
      });
    });

    // Send the message
    await this.sendMessage(message);

    return responsePromise;
  }

  /**
   * Send response to a request
   */
  async sendResponse<T = any>(
    correlationId: string,
    success: boolean,
    data?: T,
    error?: string
  ): Promise<void> {
    const response: MessageResponse<T> = {
      success,
      correlationId,
      data,
      error
    };

    // Send response as a special system message
    const message: HTOSMessage = {
      type: 'htos.system.response' as any,
      source: this.source,
      timestamp: Date.now(),
      correlationId,
      data: response
    };

    this.channel.postMessage(message);
  }

  /**
   * Broadcast a message to all components
   */
  async broadcast<T extends HTOSMessage>(
    type: T['type'],
    data: T['data']
  ): Promise<void> {
    await this.send(type, data, { target: 'broadcast' });
  }

  /**
   * Get bus statistics
   */
  getStats(): {
    subscriptions: number;
    pendingResponses: number;
    queuedMessages: number;
    isOnline: boolean;
  } {
    return {
      subscriptions: this.subscriptions.size,
      pendingResponses: this.pendingResponses.size,
      queuedMessages: this.messageQueue.length,
      isOnline: this.isOnline
    };
  }

  /**
   * Destroy the message bus
   */
  destroy(): void {
    // Clear all subscriptions
    this.subscriptions.clear();

    // Clear pending responses
    for (const [id, pending] of this.pendingResponses) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Message bus destroyed'));
    }
    this.pendingResponses.clear();

    // Close channel
    this.channel.close();

    console.log(`[HTOS] Message bus destroyed for ${this.source}`);
  }

  /**
   * Handle incoming messages from BroadcastChannel
   */
  private async handleIncomingMessage(event: MessageEvent): Promise<void> {
    try {
      const message = event.data;

      // Validate message format
      if (!isHTOSMessage(message)) {
        console.warn('[HTOS] Invalid message format:', message);
        return;
      }

      // Don't process our own messages
      if (message.source === this.source) {
        return;
      }

      // Check if message is targeted to us or broadcast
      if (message.target && message.target !== 'broadcast' && message.target !== this.source && message.target !== 'any') {
        return;
      }

      // Handle response messages
      if (message.type === 'htos.system.response' && message.correlationId) {
        const pendingRequest = this.pendingResponses.get(message.correlationId);
        if (pendingRequest) {
          this.pendingResponses.delete(message.correlationId);
          
          const responseData = message.data as MessageResponse<any>;
          if (responseData && responseData.success) {
            pendingRequest.resolve(responseData.data);
          } else {
            const error = responseData?.error || 'Request failed';
            pendingRequest.reject(new Error(error));
          }
        }
        return;
      }

      // Process message through subscriptions
      await this.processMessage(message);

    } catch (error) {
      console.error('[HTOS] Error handling incoming message:', error);
    }
  }

  /**
   * Process message through subscriptions
   */
  private async processMessage(message: HTOSMessage): Promise<void> {
    const matchingSubscriptions = Array.from(this.subscriptions.values()).filter(sub => {
      // Check message type match
      const typeMatches = Array.isArray(sub.messageType) 
        ? sub.messageType.includes(message.type)
        : sub.messageType === message.type;

      // Check source filter
      const sourceMatches = !sub.source || sub.source === message.source;

      return typeMatches && sourceMatches;
    });

    // Execute handlers
    for (const subscription of matchingSubscriptions) {
      try {
        await subscription.handler(message);

        // Remove one-time subscriptions
        if (subscription.once) {
          this.subscriptions.delete(subscription.id);
        }
      } catch (error) {
        console.error(`[HTOS] Error in message handler for ${subscription.id}:`, error);
      }
    }
  }

  /**
   * Send message with retry logic
   */
  private async sendMessage(message: HTOSMessage, attempt = 1): Promise<void> {
    try {
      if (!this.isOnline && this.options.enablePersistence) {
        // Queue message for later delivery
        this.queueMessage(message);
        return;
      }

      this.channel.postMessage(message);
      
    } catch (error) {
      console.error(`[HTOS] Failed to send message (attempt ${attempt}):`, error);

      if (attempt < this.options.retryAttempts) {
        // Retry with exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
        setTimeout(() => {
          this.sendMessage(message, attempt + 1);
        }, delay);
      } else if (this.options.enablePersistence) {
        // Queue for later if all retries failed
        this.queueMessage(message);
      }
    }
  }

  /**
   * Queue message for later delivery
   */
  private queueMessage(message: HTOSMessage): void {
    if (this.messageQueue.length >= this.options.maxQueueSize) {
      // Remove oldest message to make room
      this.messageQueue.shift();
    }

    this.messageQueue.push(message);
    console.log(`[HTOS] Queued message ${message.type} (queue size: ${this.messageQueue.length})`);
  }

  /**
   * Initialize persistence features
   */
  private initializePersistence(): void {
    // Handle online/offline status
    if (typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine;
      
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushMessageQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }

    // Periodic queue flush
    setInterval(() => {
      if (this.isOnline && this.messageQueue.length > 0) {
        this.flushMessageQueue();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Flush queued messages
   */
  private async flushMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    console.log(`[HTOS] Flushing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      try {
        await this.sendMessage(message);
      } catch (error) {
        console.error('[HTOS] Failed to flush queued message:', error);
        // Re-queue failed messages
        this.queueMessage(message);
      }
    }
  }
}

// Singleton instances for different contexts
let serviceworkerBus: HTOSMessageBus | null = null;
let contentScriptBus: HTOSMessageBus | null = null;
let offscreenBus: HTOSMessageBus | null = null;
let popupBus: HTOSMessageBus | null = null;

/**
 * Get or create message bus for specific context
 */
export function getMessageBus(source: MessageSource): HTOSMessageBus {
  switch (source) {
    case 'service_worker':
      if (!serviceworkerBus) {
        serviceworkerBus = new HTOSMessageBus(source);
      }
      return serviceworkerBus;
      
    case 'content_script':
      if (!contentScriptBus) {
        contentScriptBus = new HTOSMessageBus(source);
      }
      return contentScriptBus;
      
    case 'offscreen':
      if (!offscreenBus) {
        offscreenBus = new HTOSMessageBus(source);
      }
      return offscreenBus;
      
    case 'popup':
      if (!popupBus) {
        popupBus = new HTOSMessageBus(source);
      }
      return popupBus;
      
    default:
      throw new Error(`Unknown message source: ${source}`);
  }
}

/**
 * Destroy all message buses (for cleanup)
 */
export function destroyAllMessageBuses(): void {
  serviceworkerBus?.destroy();
  contentScriptBus?.destroy();
  offscreenBus?.destroy();
  popupBus?.destroy();
  
  serviceworkerBus = null;
  contentScriptBus = null;
  offscreenBus = null;
  popupBus = null;
}
