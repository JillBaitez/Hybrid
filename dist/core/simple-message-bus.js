/**
 * HTOS Simple Message Bus - Pragmatic Integration
 *
 * Simplified BroadcastChannel-based messaging for Phase 2
 * Focuses on working functionality over perfect TypeScript types
 * HTOS-PILLAR-CHECK: Working system first, then refine types
 */
/**
 * Simple Message Bus Implementation
 * Uses BroadcastChannel for reliable inter-component communication
 */
class SimpleMessageBus {
    constructor(source, channelName = 'htos-messages') {
        this.subscriptions = new Map();
        this.isDestroyed = false;
        this.source = source;
        this.channel = new BroadcastChannel(channelName);
        this.channel.addEventListener('message', this.handleMessage.bind(this));
        console.log(`[HTOS] Simple message bus initialized for ${source}`);
    }
    /**
     * Send a message
     */
    async send(type, data) {
        if (this.isDestroyed)
            return;
        const message = {
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
    subscribe(type, handler) {
        if (!this.subscriptions.has(type)) {
            this.subscriptions.set(type, new Set());
        }
        this.subscriptions.get(type).add(handler);
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
    async broadcast(type, data) {
        await this.send(type, data);
    }
    /**
     * Handle incoming messages
     */
    handleMessage(event) {
        if (this.isDestroyed)
            return;
        const message = event.data;
        // Don't process our own messages
        if (message.source === this.source)
            return;
        // Process subscriptions
        const handlers = this.subscriptions.get(message.type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(message);
                }
                catch (error) {
                    console.error(`[HTOS] Error in message handler for ${message.type}:`, error);
                }
            });
        }
    }
    /**
     * Destroy the message bus
     */
    destroy() {
        this.isDestroyed = true;
        this.channel.close();
        this.subscriptions.clear();
        console.log(`[HTOS] Simple message bus destroyed for ${this.source}`);
    }
}
// Global bus instances
let serviceBus = null;
let contentBus = null;
let offscreenBus = null;
let popupBus = null;
/**
 * Get message bus instance for context
 */
function getSimpleMessageBus(source) {
    switch (source) {
        case 'service_worker':
            if (!serviceBus)
                serviceBus = new SimpleMessageBus(source);
            return serviceBus;
        case 'content_script':
            if (!contentBus)
                contentBus = new SimpleMessageBus(source);
            return contentBus;
        case 'offscreen':
            if (!offscreenBus)
                offscreenBus = new SimpleMessageBus(source);
            return offscreenBus;
        case 'popup':
            if (!popupBus)
                popupBus = new SimpleMessageBus(source);
            return popupBus;
        default:
            throw new Error(`Unknown message source: ${source}`);
    }
}
/**
 * Message type constants for common use
 */
const MessageTypes = {
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
};

export { MessageTypes, SimpleMessageBus, getSimpleMessageBus };
