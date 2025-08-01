/**
 * HTOS Universal Bus System - Core Controller
 * 
 * Multi-layered communication system based on HARPA's proven architecture
 * Handles all Chrome extension contexts with automatic transport selection
 */

import { IBus, BusMessage, BusHandler, BusConfig, BusContext, ResponseMessage, HTOSMessageTypes } from './types';
import { Environment } from './Environment';
import { Serializer } from './Serializer';

export class UniversalBus implements IBus {
  private _handlers: Record<string, BusHandler[]> = {};
  private _locus: BusContext;
  private _config: BusConfig;
  private _tabId: number | null = null;
  private _iframe: HTMLIFrameElement | null = null;
  private _channel: BroadcastChannel | null = null;
  private _isInitialized = false;
  private _responseHandlers = new Map<string, (result: any) => void>();

  constructor(config: BusConfig) {
    this._config = {
      debug: false,
      version: '1.0.0',
      ...config
    };
    this._locus = Environment.getLocus();
  }

  async init(): Promise<void> {
    if (this._isInitialized) return;

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
  on(eventName: string, handler: Function, thisArg?: any): void {
    this._on(eventName, null, handler, thisArg);
  }

  off(eventName: string, handler?: Function): void {
    this._off(eventName, null, handler);
  }

  once(eventName: string, handler: Function): void {
    const onceHandler = async (...args: any[]) => {
      this.off(eventName, onceHandler);
      return await handler(...args);
    };
    this.on(eventName, onceHandler);
  }

  async send(eventName: string, ...args: any[]): Promise<any> {
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

  async call(eventName: string, ...args: any[]): Promise<any> {
    return this._callHandlers({ name: eventName, args }, (h) => !h.proxy);
  }

  async poll(eventName: string, ...args: any[]): Promise<any> {
    return await this._waitFor(() => this.send(eventName, ...args));
  }

  async getTabId(): Promise<number | null> {
    if (this._locus === 'bg') return null;
    
    if (this._locus === 'pp') {
      const urlParams = new URLSearchParams(location.search);
      const tabId = urlParams.get('tabId');
      return tabId ? Number(tabId) : null;
    }

    if (this._tabId) return this._tabId;

    try {
      const { tabId } = await this.send(HTOSMessageTypes.BUS_GET_TAB_DATA);
      this._tabId = tabId;
      return tabId;
    } catch {
      return null;
    }
  }

  destroy(): void {
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
  private _setupBackground(): void {
    this._channel = new BroadcastChannel('htos-bus-channel');
    
    // Handle messages from content scripts, popup, offscreen
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!this._isBusMsg(message)) return;
      
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

  private async _setupContentScript(): Promise<void> {
    // Handle messages from background/popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!this._isBusMsg(message)) return;
      const result = this._callHandlers(message);
      if (result) {
        result.then(Serializer.serialize).then(sendResponse);
        return true;
      }
    });

    // Handle messages from injected scripts (page context)
    window.addEventListener('message', async ({ data: message }) => {
      if (!this._isBusMsg(message) || message.locus !== 'nj') return;

      if (message.name === HTOSMessageTypes.BUS_PROXY) {
        const [eventName, shouldProxy] = message.args || [];
        shouldProxy
          ? this._on(eventName, 'nj', (...args: any[]) => this._sendToPage(eventName, ...args))
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

  private _setupInjectedScript(): void {
    let messageHandler = (window as any).__$htos_njOnMsg__;
    
    if (messageHandler) {
      window.removeEventListener('message', messageHandler);
    }

    messageHandler = async ({ data: message }: MessageEvent) => {
      if (!this._isBusMsg(message) || message.locus !== 'cs') return;
      
      const result = await this._callHandlers(message);
      window.postMessage({ resId: message.reqId, result }, '*');
    };

    window.addEventListener('message', messageHandler);
    (window as any).__$htos_njOnMsg__ = messageHandler;
  }

  private _setupPopup(): void {
    // Popup uses chrome.runtime.sendMessage to background
    // No additional setup needed
  }

  private _setupOffscreen(): void {
    this._channel = new BroadcastChannel('htos-bus-channel');
    
    // Handle messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!this._isBusMsg(message)) return;
      const result = this._callHandlers(message);
      if (result) {
        result.then(Serializer.serialize).then(sendResponse);
        return true;
      }
    });

    // Handle messages from provider iframes
    window.addEventListener('message', async ({ data: message }) => {
      if (!this._isBusMsg(message)) return;

      if (message.name === HTOSMessageTypes.BUS_PROXY) {
        const [eventName, shouldProxy] = message.args || [];
        shouldProxy
          ? this._on(eventName, 'oi', (...args: any[]) => this._sendToIframe(eventName, ...args))
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

  private _setupOnlineIframe(): void {
    // Provider iframe context
    window.addEventListener('message', async ({ data: message }) => {
      if (!this._isBusMsg(message)) return;
      
      const result = await this._callHandlers(message);
      window.parent.postMessage({ resId: message.reqId, result }, '*');
    });
  }

  private _setupForeground(): void {
    // Development context - just log
    this._log('Foreground context initialized');
  }

  // Internal Handler Management
  private _on(eventName: string, proxy: string | null, handler: Function, thisArg?: any): void {
    if (!this._handlers[eventName]) {
      this._handlers[eventName] = [];
    }

    // Auto-setup proxy for cross-context communication
    if (Environment.is('cs', 'nj', 'oi') && this._handlers[eventName].length === 0) {
      this._sendToProxier(HTOSMessageTypes.BUS_PROXY, eventName, true);
    }

    const handlerObj: BusHandler = { fn: handler, name: eventName };
    if (proxy) handlerObj.proxy = proxy;
    if (thisArg) handlerObj.this = thisArg;

    this._handlers[eventName].push(handlerObj);
  }

  private _off(eventName: string, proxy: string | null = null, handler?: Function): void {
    if (!this._handlers[eventName]) return;

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

  private async _callHandlers(
    message: { name: string; args?: any[] },
    filter?: (handler: BusHandler) => boolean
  ): Promise<any> {
    const handlers = this._handlers[message.name] || [];
    const filteredHandlers = filter ? handlers.filter(filter) : handlers;

    if (filteredHandlers.length === 0) return undefined;

    const results = await Promise.all(
      filteredHandlers.map(async (handler) => {
        try {
          return await handler.fn.apply(handler.this, message.args || []);
        } catch (error) {
          this._log('Handler error:', error);
          return undefined;
        }
      })
    );

    return results.find((result) => result !== undefined);
  }

  // Transport Methods
  private async _sendToExt(eventName: string, ...args: any[]): Promise<any> {
    const argsStr = Serializer.serialize(args);
    const message = this._createBusMsg({ name: eventName, argsStr });

    const result = await new Promise<any>((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            this._log('Runtime error:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        if ((error as Error).message === 'Extension context invalidated.') {
          return;
        }
        this._log('Send error:', error);
        resolve(null);
      }
    });

    return result ? Serializer.deserialize(result) : null;
  }

  private async _sendToTab(tabId: number, eventName: string, ...args: any[]): Promise<any> {
    if (!chrome.tabs?.sendMessage) {
      return await this.send(HTOSMessageTypes.BUS_SEND_TO_CS, tabId, eventName, ...args);
    }

    const argsStr = Serializer.serialize(args);
    const message = this._createBusMsg({ name: eventName, argsStr, target: 'cs' });

    const result = await new Promise<any>((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });

    return result ? Serializer.deserialize(result) : null;
  }

  private async _sendToPage(eventName: string, ...args: any[]): Promise<any> {
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

  private async _sendToIframe(eventName: string, ...args: any[]): Promise<any> {
    if (!this._iframe?.contentWindow) return null;

    const reqId = this._generateId();
    const message = this._createBusMsg({ name: eventName, args, reqId });

    this._iframe.contentWindow.postMessage(message, '*');
    return await this._waitForResponseMessage(reqId);
  }

  private async _sendToParent(eventName: string, ...args: any[]): Promise<any> {
    const reqId = this._generateId();
    const message = this._createBusMsg({ name: eventName, args, reqId });

    window.parent.postMessage(message, '*');
    return await this._waitForResponseMessage(reqId);
  }

  private async _sendToProxier(eventName: string, ...args: any[]): Promise<any> {
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
  private _createBusMsg(options: {
    name: string;
    args?: any[];
    argsStr?: string;
    reqId?: string;
    locus?: BusContext;
    target?: BusContext | number;
  }): BusMessage {
    return {
      $bus: true,
      appName: this._config.appName,
      version: this._config.version,
      ...options,
    };
  }

  private _isBusMsg(message: any): message is BusMessage {
    return message?.$bus && message?.appName === this._config.appName;
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private async _waitForResponseMessage(reqId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Message timeout'));
      }, 30000);

      const handler = (event: MessageEvent) => {
        if (event.data?.resId === reqId) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(event.data.result);
        }
      };

      window.addEventListener('message', handler);
    });
  }

  private async _pick(promises: Promise<any>[]): Promise<any> {
    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null && result.value !== undefined) {
        return result.value;
      }
    }
    return null;
  }

  private async _waitFor(fn: () => Promise<any>, timeout = 30000): Promise<any> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const result = await fn();
        if (result !== null && result !== undefined) {
          return result;
        }
      } catch {
        // Continue polling
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Poll timeout');
  }

  private _respondToPage(message: BusMessage, result?: any): void {
    window.postMessage({ resId: message.reqId, result }, '*');
  }

  private _respondToIframe(message: BusMessage, result?: any): void {
    if (this._iframe?.contentWindow) {
      this._iframe.contentWindow.postMessage({ resId: message.reqId, result }, '*');
    }
  }

  private _handleBroadcastMessage(data: any): void {
    // Handle blob transfers and other broadcast messages
    if (data.blob && data.reqId) {
      const objectUrl = URL.createObjectURL(data.blob);
      this._channel?.postMessage({ resId: data.reqId, objectUrl });
    }
  }

  private async _handleSendToCs(tabId: number, eventName: string, ...args: any[]): Promise<any> {
    return await this._sendToTab(tabId, eventName, ...args);
  }

  private _log(...args: any[]): void {
    if (this._config.debug) {
      console.log(`[HTOS Bus:${this._locus}]`, ...args);
    }
  }

  // Setters for context-specific setup
  setIframe(iframe: HTMLIFrameElement): void {
    this._iframe = iframe;
  }
}
