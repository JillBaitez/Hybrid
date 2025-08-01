/**
 * HTOS Universal Bus System - Environment Detection
 * 
 * Automatically detects Chrome extension context for proper transport selection
 * Based on HARPA's proven context detection patterns
 */

import { BusContext } from './types';

export class Environment {
  private static _locus: BusContext | null = null;

  /**
   * Detect current Chrome extension context
   */
  static getLocus(): BusContext {
    if (this._locus) return this._locus;

    const { protocol, host, pathname, href } = location;
    
    // Check for online iframe context (provider iframes)
    if (href.includes('/oi') || href.includes('harpa.ai/oi') || 
        href.includes('claude.ai') || href.includes('openai.com') || 
        href.includes('gemini.google.com')) {
      this._locus = 'oi';
    }
    // Check for content script context
    else if (protocol !== 'chrome-extension:' && typeof chrome?.runtime?.getURL === 'function') {
      this._locus = 'cs';
    }
    // Check for development context
    else if (host.includes('localhost:3050') || host.includes('localhost:3000')) {
      this._locus = 'fg';
    }
    // Check for injected script context (page context)
    else if (protocol !== 'chrome-extension:') {
      this._locus = 'nj';
    }
    // Extension contexts
    else if (protocol === 'chrome-extension:') {
      if (pathname.includes('popup.html') || pathname.includes('harpa.html')) {
        this._locus = 'pp';
      } else if (pathname.includes('offscreen.html') || pathname.includes('0h.html')) {
        this._locus = 'os';
      } else {
        this._locus = 'bg';
      }
    }
    // Fallback to background
    else {
      this._locus = 'bg';
    }

    return this._locus;
  }

  /**
   * Check if current context matches any of the provided contexts
   */
  static is(...contexts: BusContext[]): boolean {
    return contexts.includes(this.getLocus());
  }

  /**
   * Reset cached context (for testing)
   */
  static reset(): void {
    this._locus = null;
  }

  /**
   * Get human-readable context name
   */
  static getContextName(): string {
    const contextNames = {
      'bg': 'Service Worker',
      'cs': 'Content Script',
      'nj': 'Page Context (Injected)',
      'pp': 'Popup',
      'os': 'Offscreen Document',
      'oi': 'Provider Iframe',
      'fg': 'Development/Foreground'
    };
    
    return contextNames[this.getLocus()] || 'Unknown Context';
  }

  /**
   * Check if context supports chrome.runtime APIs
   */
  static hasRuntimeAPI(): boolean {
    return this.is('bg', 'cs', 'pp', 'os');
  }

  /**
   * Check if context supports BroadcastChannel
   */
  static hasBroadcastChannel(): boolean {
    return typeof BroadcastChannel !== 'undefined';
  }

  /**
   * Check if context supports window.postMessage
   */
  static hasPostMessage(): boolean {
    return typeof window !== 'undefined' && typeof window.postMessage === 'function';
  }

  /**
   * Get available transport mechanisms for current context
   */
  static getAvailableTransports(): string[] {
    const transports: string[] = [];
    
    if (this.hasRuntimeAPI()) {
      transports.push('chrome.runtime');
    }
    
    if (this.hasBroadcastChannel()) {
      transports.push('BroadcastChannel');
    }
    
    if (this.hasPostMessage()) {
      transports.push('window.postMessage');
    }
    
    return transports;
  }
}
