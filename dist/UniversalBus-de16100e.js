import { Environment } from './bus/Environment.js';
import { Serializer } from './bus/Serializer.js';

/**
 * HTOS Universal Bus System - Type Definitions
 *
 * Based on HARPA's proven multi-layered communication architecture
 * Supports all Chrome extension contexts with automatic transport selection
 */
// HTOS-specific message types
const HTOSMessageTypes = {
    // Token management
    TOKEN_EXTRACTED: 'htos.token.extracted',
    TOKEN_REFRESH: 'htos.token.refresh',
    TOKEN_STATUS: 'htos.token.status',
    TOKEN_DELETE: 'htos.token.delete',
    // DNR coordination
    DNR_ACTIVATE: 'htos.dnr.activate',
    DNR_DEACTIVATE: 'htos.dnr.deactivate',
    DNR_RULES_ACTIVATED: 'htos.dnr.rules_activated',
    // System messages
    SYSTEM_READY: 'htos.system.ready',
    SYSTEM_ERROR: 'htos.system.error',
    SYSTEM_HEALTH_CHECK: 'htos.system.health_check',
    // Prompt dispatch
    PROMPT_DISPATCH: 'htos.prompt.dispatch',
    PROMPT_RESPONSE: 'htos.prompt.response',
    PROMPT_PROGRESS: 'htos.prompt.progress',
    // UI updates
    UI_UPDATE: 'htos.ui.update',
    UI_NOTIFICATION: 'htos.ui.notification',
    UI_STATE_CHANGE: 'htos.ui.state_change',
    // Offscreen document
    OFFSCREEN_CREATE: 'htos.offscreen.create',
    OFFSCREEN_READY: 'htos.offscreen.ready',
    OFFSCREEN_IFRAME: 'htos.offscreen.iframe',
    // Bus system
    BUS_PROXY: 'bus.proxy',
    BUS_GET_TAB_DATA: 'bus.getTabData',
    BUS_SEND_TO_CS: 'bus.sendToCs',
    BUS_REMOVE_CS_PROXIES: 'bus.removeCsProxies'
};

/**
 * HTOS Universal Bus System - Core Controller
 *
 * Multi-layered communication system based on HARPA's proven architecture
 * Handles all Chrome extension contexts with automatic transport selection
 */
class UniversalBus {
    constructor(config) {
        this._handlers = {};
        this._tabId = null;
        this._iframe = null;
        this._channel = null;
        this._isInitialized = false;
        this._responseHandlers = new Map();
        this._config = {
            debug: false,
            version: '1.0.0',
            ...config
        };
        this._locus = Environment.getLocus();
    }
    async init() {
        if (this._isInitialized)
            return;
        this._log('Initializing universal bus for context:', Environment.getContextName());
        // Context-specific initialization
        switch (this._locus) {
            case 'bg':
                this._setupBackground();
                break;
            case 'cs':
                await this._setupContentScript();
                break;
            case 'nj':
                this._setupInjectedScript();
                break;
            case 'pp':
                this._setupPopup();
                break;
            case 'os':
                this._setupOffscreen();
                break;
            case 'oi':
                this._setupOnlineIframe();
                break;
            case 'fg':
                this._setupForeground();
                break;
        }
        this._isInitialized = true;
        this._log('Universal bus initialized. Available transports:', Environment.getAvailableTransports());
    }
    // Public API Implementation
    on(eventName, handler, thisArg) {
        this._on(eventName, null, handler, thisArg);
    }
    off(eventName, handler) {
        this._off(eventName, null, handler);
    }
    once(eventName, handler) {
        const onceHandler = async (...args) => {
            this.off(eventName, onceHandler);
            return await handler(...args);
        };
        this.on(eventName, onceHandler);
    }
    async send(eventName, ...args) {
        if (!this._isInitialized) {
            throw new Error('Bus not initialized. Call init() first.');
        }
        // Handle tab-specific sends (number as first arg)
        if (typeof eventName === 'number') {
            const tabId = eventName;
            eventName = args[0];
            args = args.slice(1);
            return await this._sendToTab(tabId, eventName, ...args);
        }
        // Route based on context
        switch (this._locus) {
            case 'bg':
            case 'cs':
            case 'os':
                return await this._pick([
                    this._sendToExt(eventName, ...args),
                    this._callHandlers({ name: eventName, args }, (h) => !h.proxy),
                ]);
            case 'nj':
                return await this._sendToPage(eventName, ...args);
            case 'oi':
                return await this._sendToParent(eventName, ...args);
            case 'pp':
                return await this._sendToExt(eventName, ...args);
            case 'fg':
                this._log('FG Send:', eventName, ...args);
                return;
            default:
                throw new Error(`Send not implemented for context: ${this._locus}`);
        }
    }
    async call(eventName, ...args) {
        return this._callHandlers({ name: eventName, args }, (h) => !h.proxy);
    }
    async poll(eventName, ...args) {
        return await this._waitFor(() => this.send(eventName, ...args));
    }
    async getTabId() {
        if (this._locus === 'bg')
            return null;
        if (this._locus === 'pp') {
            const urlParams = new URLSearchParams(location.search);
            const tabId = urlParams.get('tabId');
            return tabId ? Number(tabId) : null;
        }
        if (this._tabId)
            return this._tabId;
        try {
            const { tabId } = await this.send(HTOSMessageTypes.BUS_GET_TAB_DATA);
            this._tabId = tabId;
            return tabId;
        }
        catch {
            return null;
        }
    }
    destroy() {
        this._handlers = {};
        this._responseHandlers.clear();
        if (this._channel) {
            this._channel.close();
            this._channel = null;
        }
        this._isInitialized = false;
        this._log('Universal bus destroyed');
    }
    // Context Setup Methods
    _setupBackground() {
        this._channel = new BroadcastChannel('htos-bus-channel');
        // Handle messages from content scripts, popup, offscreen
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (!this._isBusMsg(message))
                return;
            const result = this._callHandlers(message);
            if (result) {
                result.then(Serializer.serialize).then(sendResponse);
                return true; // Keep sendResponse alive
            }
        });
        // Handle BroadcastChannel messages (for blob transfers)
        this._channel.addEventListener('message', ({ data }) => {
            this._handleBroadcastMessage(data);
        });
        // Register background-specific handlers
        this.on(HTOSMessageTypes.BUS_GET_TAB_DATA, () => ({ tabId: null }));
        this.on(HTOSMessageTypes.BUS_SEND_TO_CS, this._handleSendToCs.bind(this));
    }
    async _setupContentScript() {
        // Handle messages from background/popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (!this._isBusMsg(message))
                return;
            const result = this._callHandlers(message);
            if (result) {
                result.then(Serializer.serialize).then(sendResponse);
                return true;
            }
        });
        // Handle messages from injected scripts (page context)
        window.addEventListener('message', async ({ data: message }) => {
            if (!this._isBusMsg(message) || message.locus !== 'nj')
                return;
            if (message.name === HTOSMessageTypes.BUS_PROXY) {
                const [eventName, shouldProxy] = message.args || [];
                shouldProxy
                    ? this._on(eventName, 'nj', (...args) => this._sendToPage(eventName, ...args))
                    : this._off(eventName, 'nj');
                return this._respondToPage(message);
            }
            const result = await this._pick([
                this._sendToExt(message.name, ...(message.args || [])),
                this._callHandlers(message, (h) => !h.proxy),
            ]);
            this._respondToPage(message, result);
        });
        // Clean up any existing proxies
        await this._sendToProxier(HTOSMessageTypes.BUS_REMOVE_CS_PROXIES);
    }
    _setupInjectedScript() {
        let messageHandler = window.__$htos_njOnMsg__;
        if (messageHandler) {
            window.removeEventListener('message', messageHandler);
        }
        messageHandler = async ({ data: message }) => {
            if (!this._isBusMsg(message) || message.locus !== 'cs')
                return;
            const result = await this._callHandlers(message);
            window.postMessage({ resId: message.reqId, result }, '*');
        };
        window.addEventListener('message', messageHandler);
        window.__$htos_njOnMsg__ = messageHandler;
    }
    _setupPopup() {
        // Popup uses chrome.runtime.sendMessage to background
        // No additional setup needed
    }
    _setupOffscreen() {
        this._channel = new BroadcastChannel('htos-bus-channel');
        // Handle messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (!this._isBusMsg(message))
                return;
            const result = this._callHandlers(message);
            if (result) {
                result.then(Serializer.serialize).then(sendResponse);
                return true;
            }
        });
        // Handle messages from provider iframes
        window.addEventListener('message', async ({ data: message }) => {
            if (!this._isBusMsg(message))
                return;
            if (message.name === HTOSMessageTypes.BUS_PROXY) {
                const [eventName, shouldProxy] = message.args || [];
                shouldProxy
                    ? this._on(eventName, 'oi', (...args) => this._sendToIframe(eventName, ...args))
                    : this._off(eventName, 'oi');
                return this._respondToIframe(message);
            }
            const result = await this._pick([
                this._sendToExt(message.name, ...message.args),
                this._callHandlers(message, (h) => !h.proxy),
            ]);
            this._respondToIframe(message, result);
        });
        // Handle BroadcastChannel messages
        this._channel.addEventListener('message', ({ data }) => {
            this._handleBroadcastMessage(data);
        });
    }
    _setupOnlineIframe() {
        // Provider iframe context
        window.addEventListener('message', async ({ data: message }) => {
            if (!this._isBusMsg(message))
                return;
            const result = await this._callHandlers(message);
            window.parent.postMessage({ resId: message.reqId, result }, '*');
        });
    }
    _setupForeground() {
        // Development context - just log
        this._log('Foreground context initialized');
    }
    // Internal Handler Management
    _on(eventName, proxy, handler, thisArg) {
        if (!this._handlers[eventName]) {
            this._handlers[eventName] = [];
        }
        // Auto-setup proxy for cross-context communication
        if (Environment.is('cs', 'nj', 'oi') && this._handlers[eventName].length === 0) {
            this._sendToProxier(HTOSMessageTypes.BUS_PROXY, eventName, true);
        }
        const handlerObj = { fn: handler, name: eventName };
        if (proxy)
            handlerObj.proxy = proxy;
        if (thisArg)
            handlerObj.this = thisArg;
        this._handlers[eventName].push(handlerObj);
    }
    _off(eventName, proxy = null, handler) {
        if (!this._handlers[eventName])
            return;
        this._handlers[eventName] = this._handlers[eventName].filter((h) => {
            const handlerMatches = !handler || handler === h.fn;
            const proxyMatches = proxy === (h.proxy || null);
            return !handlerMatches || !proxyMatches;
        });
        if (this._handlers[eventName].length === 0) {
            delete this._handlers[eventName];
            if (Environment.is('cs', 'nj', 'oi')) {
                this._sendToProxier(HTOSMessageTypes.BUS_PROXY, eventName, false);
            }
        }
    }
    async _callHandlers(message, filter) {
        const handlers = this._handlers[message.name] || [];
        const filteredHandlers = filter ? handlers.filter(filter) : handlers;
        if (filteredHandlers.length === 0)
            return undefined;
        const results = await Promise.all(filteredHandlers.map(async (handler) => {
            try {
                return await handler.fn.apply(handler.this, message.args || []);
            }
            catch (error) {
                this._log('Handler error:', error);
                return undefined;
            }
        }));
        return results.find((result) => result !== undefined);
    }
    // Transport Methods
    async _sendToExt(eventName, ...args) {
        const argsStr = Serializer.serialize(args);
        const message = this._createBusMsg({ name: eventName, argsStr });
        const result = await new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        this._log('Runtime error:', chrome.runtime.lastError);
                        resolve(null);
                    }
                    else {
                        resolve(response);
                    }
                });
            }
            catch (error) {
                if (error.message === 'Extension context invalidated.') {
                    return;
                }
                this._log('Send error:', error);
                resolve(null);
            }
        });
        return result ? Serializer.deserialize(result) : null;
    }
    async _sendToTab(tabId, eventName, ...args) {
        if (!chrome.tabs?.sendMessage) {
            return await this.send(HTOSMessageTypes.BUS_SEND_TO_CS, tabId, eventName, ...args);
        }
        const argsStr = Serializer.serialize(args);
        const message = this._createBusMsg({ name: eventName, argsStr, target: 'cs' });
        const result = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    resolve(null);
                }
                else {
                    resolve(response);
                }
            });
        });
        return result ? Serializer.deserialize(result) : null;
    }
    async _sendToPage(eventName, ...args) {
        const reqId = this._generateId();
        const message = this._createBusMsg({
            name: eventName,
            args,
            reqId,
            locus: this._locus,
        });
        window.postMessage(message, '*');
        return await this._waitForResponseMessage(reqId);
    }
    async _sendToIframe(eventName, ...args) {
        if (!this._iframe?.contentWindow)
            return null;
        const reqId = this._generateId();
        const message = this._createBusMsg({ name: eventName, args, reqId });
        this._iframe.contentWindow.postMessage(message, '*');
        return await this._waitForResponseMessage(reqId);
    }
    async _sendToParent(eventName, ...args) {
        const reqId = this._generateId();
        const message = this._createBusMsg({ name: eventName, args, reqId });
        window.parent.postMessage(message, '*');
        return await this._waitForResponseMessage(reqId);
    }
    async _sendToProxier(eventName, ...args) {
        switch (this._locus) {
            case 'cs':
                return await this._sendToExt(eventName, ...args);
            case 'nj':
                return await this._sendToPage(eventName, ...args);
            case 'oi':
                return await this._sendToParent(eventName, ...args);
            default:
                return undefined;
        }
    }
    // Utility Methods
    _createBusMsg(options) {
        return {
            $bus: true,
            appName: this._config.appName,
            version: this._config.version,
            ...options,
        };
    }
    _isBusMsg(message) {
        return message?.$bus && message?.appName === this._config.appName;
    }
    _generateId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    async _waitForResponseMessage(reqId) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('Message timeout'));
            }, 30000);
            const handler = (event) => {
                if (event.data?.resId === reqId) {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handler);
                    resolve(event.data.result);
                }
            };
            window.addEventListener('message', handler);
        });
    }
    async _pick(promises) {
        const results = await Promise.allSettled(promises);
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value !== null && result.value !== undefined) {
                return result.value;
            }
        }
        return null;
    }
    async _waitFor(fn, timeout = 30000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const result = await fn();
                if (result !== null && result !== undefined) {
                    return result;
                }
            }
            catch {
                // Continue polling
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Poll timeout');
    }
    _respondToPage(message, result) {
        window.postMessage({ resId: message.reqId, result }, '*');
    }
    _respondToIframe(message, result) {
        if (this._iframe?.contentWindow) {
            this._iframe.contentWindow.postMessage({ resId: message.reqId, result }, '*');
        }
    }
    _handleBroadcastMessage(data) {
        // Handle blob transfers and other broadcast messages
        if (data.blob && data.reqId) {
            const objectUrl = URL.createObjectURL(data.blob);
            this._channel?.postMessage({ resId: data.reqId, objectUrl });
        }
    }
    async _handleSendToCs(tabId, eventName, ...args) {
        return await this._sendToTab(tabId, eventName, ...args);
    }
    _log(...args) {
        if (this._config.debug) {
            console.log(`[HTOS Bus:${this._locus}]`, ...args);
        }
    }
    // Setters for context-specific setup
    setIframe(iframe) {
        this._iframe = iframe;
    }
}

export { HTOSMessageTypes as H, UniversalBus as U };
