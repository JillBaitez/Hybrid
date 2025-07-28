/**
 * HTOS Offscreen Host - Iframe Engine Manager
 * 
 * This file manages the offscreen iframe that handles:
 * - WASM SHA3 computations
 * - Provider authentication
 * - Token extraction
 * 
 * Ported from HARPA os.js with iframe management logic
 */

import { IBusMessage, IBusResponse } from '../types/bus.js';
import { createProviderIframe, manageIframeStability } from './iframe-factory.js';

// Global state
let iframe: HTMLIFrameElement | null = null;
let isInitialized = false;

/**
 * Initialize the offscreen host
 */
function initializeOffscreenHost(): void {
  if (isInitialized) return;
  
  console.log('[HTOS] Initializing offscreen host...');
  
  // Create and manage the iframe
  createIframe();
  manageIframeStability();
  
  // Set up message handling
  setupMessageHandling();
  
  isInitialized = true;
  console.log('[HTOS] Offscreen host initialized');
}

/**
 * Create the iframe for WASM and provider operations
 * HTOS-PILLAR-CHECK: preserves DNR-before-JS & SW-only authority
 */
async function createIframe(): Promise<void> {
  const providerUrl = chrome.runtime.getURL('pow/0f.html');
  iframe = await createProviderIframe(providerUrl, { provider: 'pow' });
  
  // Set up iframe stability management using HARPA pattern
  manageIframeStability(iframe, providerUrl, pingIframe);
  
  console.log('[HTOS] Dynamic iframe created using factory pattern');
}

/**
 * IMMUTABLE PILLAR 6: Iframe Stability Guard
 * Manages iframe health and recreates if unresponsive
 */
async function manageIframeStability(): Promise<void> {
  // Wait for network if offline
  if (!navigator.onLine) {
    console.log('[HTOS] Waiting for online...');
    await new Promise<void>((resolve) => {
      const onlineHandler = () => {
        if (navigator.onLine) {
          window.removeEventListener('online', onlineHandler);
          resolve();
        }
      };
      window.addEventListener('online', onlineHandler);
    });
    
    // Refresh iframe source after coming online
    if (iframe) {
      iframe.src = chrome.runtime.getURL('pow/0f.html');
    }
  }
  
  // Retry logic for iframe startup
  const retry = async (retryCount = 0): Promise<void> => {
    if (await pingIframe()) return;
    
    const retrySeconds = retryCount < 4 ? 3 : 60;
    console.log(`[HTOS] Failed to start iframe engine, trying again in ${retrySeconds}s...`);
    
    await sleep(retrySeconds * 1000);
    
    if (iframe) {
      iframe.src = chrome.runtime.getURL('pow/0f.html');
    }
    
    await retry(retryCount + 1);
  };
  
  await retry();
  
  // Set up periodic health check (every 5 minutes)
  setInterval(async () => {
    if (!(await pingIframe())) {
      console.log('[HTOS] Failed to ping iframe engine, restarting...');
      if (iframe) {
        iframe.src = chrome.runtime.getURL('pow/0f.html');
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Ping the iframe to check if it's responsive
 */
async function pingIframe(): Promise<boolean> {
  if (!iframe || !iframe.contentWindow) return false;
  
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000); // 5 second timeout
    
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'htos.pow.ready') {
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        resolve(true);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send ping to iframe
    iframe!.contentWindow!.postMessage({
      type: 'htos.pow.ping',
      id: crypto.randomUUID()
    }, '*');
  });
}

/**
 * Set up message handling between service worker and iframe
 */
function setupMessageHandling(): void {
  // Listen for messages from service worker
  chrome.runtime.onMessage.addListener((message: IBusMessage, sender, sendResponse) => {
    handleMessage(message).then(response => {
      sendResponse(response);
    }).catch(error => {
      sendResponse({
        id: message.id,
        ok: false,
        error: error.message
      });
    });
    return true; // Keep message channel open
  });
  
  // Listen for messages from iframe
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source === iframe?.contentWindow) {
      handleIframeMessage(event.data);
    }
  });
}

/**
 * Handle messages from service worker
 */
async function handleMessage(message: IBusMessage): Promise<IBusResponse> {
  switch (message.type) {
    case 'htos.pow.solve':
      return await forwardToIframe(message);
      
    case 'htos.provider.login':
      return await forwardToIframe(message);
      
    case 'htos.provider.extract':
      return await forwardToIframe(message);
      
    case 'htos.ping':
      return { id: message.id, ok: true, data: 'pong' };
      
    default:
      return { id: message.id, ok: false, error: 'Unknown message type' };
  }
}

/**
 * Forward message to iframe and wait for response
 */
async function forwardToIframe(message: IBusMessage): Promise<IBusResponse> {
  if (!iframe || !iframe.contentWindow) {
    return { id: message.id, ok: false, error: 'Iframe not available' };
  }
  
  return new Promise<IBusResponse>((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ id: message.id, ok: false, error: 'Iframe timeout' });
    }, 30000); // 30 second timeout
    
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.id === message.id) {
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        resolve(event.data);
      }
    };
    
    window.addEventListener('message', messageHandler);
    iframe!.contentWindow!.postMessage(message, '*');
  });
}

/**
 * Handle messages from iframe
 */
function handleIframeMessage(data: any): void {
  if (data?.type === 'htos.pow.ready') {
    console.log('[HTOS] Iframe engine ready');
  }
  
  // Forward other messages to service worker if needed
  if (data?.type?.startsWith('htos.')) {
    chrome.runtime.sendMessage(data);
  }
}

/**
 * Utility function for sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOffscreenHost);
} else {
  initializeOffscreenHost();
}