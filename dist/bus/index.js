import { U as UniversalBus, H as HTOSMessageTypes } from '../UniversalBus-de16100e.js';
import { Environment } from './Environment.js';
export { Serializer } from './Serializer.js';

/**
 * HTOS Universal Bus System - Main Export
 *
 * Factory for creating context-aware bus instances
 * Based on HARPA's proven multi-layered communication architecture
 */
// Global bus instance
let _globalBus = null;
/**
 * Create or get global bus instance
 */
function createBus(config) {
    if (_globalBus) {
        return _globalBus;
    }
    const defaultConfig = {
        appName: 'htos',
        version: '1.0.0',
        debug: process.env.NODE_ENV === 'development',
        ...config
    };
    _globalBus = new UniversalBus(defaultConfig);
    return _globalBus;
}
/**
 * Get existing bus instance (throws if not created)
 */
function getBus() {
    if (!_globalBus) {
        throw new Error('Bus not initialized. Call createBus() first.');
    }
    return _globalBus;
}
/**
 * Initialize bus for current context
 */
async function initBus(config) {
    const bus = createBus(config);
    await bus.init();
    return bus;
}
/**
 * Destroy global bus instance
 */
function destroyBus() {
    if (_globalBus) {
        _globalBus.destroy();
        _globalBus = null;
    }
}
/**
 * Quick context check utilities
 */
const BusContext = {
    is: Environment.is.bind(Environment),
    getLocus: Environment.getLocus.bind(Environment),
    getContextName: Environment.getContextName.bind(Environment),
    hasRuntimeAPI: Environment.hasRuntimeAPI.bind(Environment),
    hasBroadcastChannel: Environment.hasBroadcastChannel.bind(Environment),
    hasPostMessage: Environment.hasPostMessage.bind(Environment),
    getAvailableTransports: Environment.getAvailableTransports.bind(Environment)
};
// HTOS-specific convenience functions
class HTOSBus {
    /**
     * Initialize HTOS bus with default configuration
     */
    static async init() {
        if (this.bus)
            return this.bus;
        this.bus = await initBus({
            appName: 'htos',
            debug: BusContext.is('fg') || process.env.NODE_ENV === 'development'
        });
        // Set up HTOS-specific handlers
        await this.setupHTOSHandlers();
        return this.bus;
    }
    /**
     * Get initialized HTOS bus
     */
    static get() {
        if (!this.bus) {
            throw new Error('HTOS Bus not initialized. Call HTOSBus.init() first.');
        }
        return this.bus;
    }
    /**
     * Set up HTOS-specific message handlers
     */
    static async setupHTOSHandlers() {
        if (!this.bus)
            return;
        // System health check handler
        this.bus.on(HTOSMessageTypes.SYSTEM_HEALTH_CHECK, () => ({
            status: 'healthy',
            context: BusContext.getContextName(),
            locus: BusContext.getLocus(),
            timestamp: Date.now(),
            transports: BusContext.getAvailableTransports()
        }));
        // Context-specific setup
        const locus = BusContext.getLocus();
        if (locus === 'bg') {
            await this.setupBackgroundHandlers();
        }
        else if (locus === 'cs') {
            await this.setupContentScriptHandlers();
        }
        else if (locus === 'os') {
            await this.setupOffscreenHandlers();
        }
        else if (locus === 'pp') {
            await this.setupPopupHandlers();
        }
    }
    /**
     * Background-specific handlers
     */
    static async setupBackgroundHandlers() {
        if (!this.bus)
            return;
        // Token management events
        this.bus.on(HTOSMessageTypes.TOKEN_EXTRACTED, (provider, domain) => {
            console.log(`[HTOS Bus] Token extracted for ${provider} from ${domain}`);
        });
        // DNR activation events
        this.bus.on(HTOSMessageTypes.DNR_ACTIVATE, async (provider, tabId) => {
            console.log(`[HTOS Bus] DNR activation requested for ${provider} on tab ${tabId}`);
        });
        // System ready notification
        this.bus.on(HTOSMessageTypes.SYSTEM_READY, () => {
            console.log('[HTOS Bus] System ready notification received');
        });
    }
    /**
     * Content script-specific handlers
     */
    static async setupContentScriptHandlers() {
        if (!this.bus)
            return;
        // UI update handlers
        this.bus.on(HTOSMessageTypes.UI_UPDATE, (update) => {
            console.log('[HTOS Bus] UI update received:', update);
        });
        // Prompt dispatch handlers
        this.bus.on(HTOSMessageTypes.PROMPT_DISPATCH, async (prompt) => {
            console.log('[HTOS Bus] Prompt dispatch received:', prompt);
        });
    }
    /**
     * Offscreen-specific handlers
     */
    static async setupOffscreenHandlers() {
        if (!this.bus)
            return;
        // Offscreen ready notification
        this.bus.on(HTOSMessageTypes.OFFSCREEN_READY, () => {
            console.log('[HTOS Bus] Offscreen document ready');
        });
        // Iframe management
        this.bus.on(HTOSMessageTypes.OFFSCREEN_IFRAME, (action, data) => {
            console.log(`[HTOS Bus] Offscreen iframe ${action}:`, data);
        });
    }
    /**
     * Popup-specific handlers
     */
    static async setupPopupHandlers() {
        if (!this.bus)
            return;
        // UI state changes
        this.bus.on(HTOSMessageTypes.UI_STATE_CHANGE, (state) => {
            console.log('[HTOS Bus] UI state change:', state);
        });
        // Notifications
        this.bus.on(HTOSMessageTypes.UI_NOTIFICATION, (notification) => {
            console.log('[HTOS Bus] Notification:', notification);
        });
    }
    /**
     * Send HTOS system message
     */
    static async sendSystemMessage(type, ...args) {
        const bus = this.get();
        return await bus.send(type, ...args);
    }
    /**
     * Broadcast HTOS system event
     */
    static async broadcastSystemEvent(type, ...args) {
        const bus = this.get();
        // Send to all contexts that might be listening
        const promises = [];
        if (BusContext.is('bg')) {
            // Background can send to all contexts
            promises.push(bus.send(type, ...args));
        }
        else {
            // Other contexts send to background which can relay
            promises.push(bus.send(type, ...args));
        }
        await Promise.allSettled(promises);
    }
    /**
     * Get system health across all contexts
     */
    static async getSystemHealth() {
        const bus = this.get();
        const results = [];
        try {
            // Check current context
            const localHealth = await bus.call(HTOSMessageTypes.SYSTEM_HEALTH_CHECK);
            results.push(localHealth);
            // Try to check other contexts
            if (BusContext.is('bg')) {
                // Background can check all contexts
                // This would be implemented based on active tabs/contexts
            }
        }
        catch (error) {
            console.warn('[HTOS Bus] Health check failed:', error);
        }
        return results;
    }
    /**
     * Destroy HTOS bus
     */
    static destroy() {
        if (this.bus) {
            this.bus.destroy();
            this.bus = null;
        }
        destroyBus();
    }
}
HTOSBus.bus = null;

export { BusContext, Environment, HTOSBus, HTOSMessageTypes, UniversalBus, createBus, destroyBus, getBus, initBus };
