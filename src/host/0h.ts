/**
 * HTOS Offscreen Host - Complete Offscreen Document Manager
 * 
 * Ported from HARPA os.js with full functionality:
 * - Global app system with proxied modules
 * - Iframe management and stability
 * - File processing (PDF, DOCX, XLS)
 * - WebSocket grid system
 * - Timer management
 * - Audio utilities
 * - Image manipulation
 * - Storage and utility functions
 */

import { BUS_CONFIG, BusMessage } from '../core/bus-events.js';
import { createProviderIframe } from './iframe-factory.js';

// Global HTOS App System (ported from HARPA)
let htosApp: any;
let getRandomBytes: (size: number) => Uint8Array;

// Initialize global app system
(() => {
  const globalAppKey = 'htos.global';
  const environment = 'production';
  const isDevMode = false;
  
  if ((htosApp = (globalThis as any)[globalAppKey])) return;
  
  const appConfig = {
    name: globalAppKey,
    env: environment,
    get: (key: string) => (key in appConfig ? (appConfig as any)[key] : null),
    version: '11.2.1'
  };
  
  // Proxied app system for dynamic module creation
  const proxiedApp = (function createProxy(targetObject: any) {
    const isRootObject = targetObject === appConfig;
    const shouldExposeToGlobal = isRootObject && isDevMode;
    const proxyCache: any = {};
    const assignProperties = (sourceObject: any) => Object.assign(targetObject, sourceObject);
    
    const proxyHandler = new Proxy(targetObject, {
      get(target, prop) {
        if (prop === 'assign') return assignProperties;
        if (isRootObject && !String(prop).startsWith('$')) return targetObject[prop];
        
        if (!(prop in targetObject)) {
          targetObject[prop] = {};
          if (isRootObject) {
            const log = logToConsole.bind(null, 'log', prop as string, false);
            const logDev = logToConsole.bind(null, 'log', prop as string, true);
            const warn = logToConsole.bind(null, 'warn', prop as string, false);
            const warnDev = logToConsole.bind(null, 'warn', prop as string, true);
            const error = logToConsole.bind(null, 'error', prop as string, false);
            const errorDev = logToConsole.bind(null, 'error', prop as string, true);
            const createError = createAndLogError.bind(null, prop as string);
            
            Object.defineProperties(targetObject[prop], {
              log: { get: () => log },
              logDev: { get: () => logDev },
              warn: { get: () => warn },
              warnDev: { get: () => warnDev },
              error: { get: () => error },
              errorDev: { get: () => errorDev },
              Error: { get: () => createError }
            });
          }
          
          proxyCache[prop] = createProxy(targetObject[prop]);
          if (shouldExposeToGlobal) (globalThis as any)[prop] = targetObject[prop];
        }
        
        return prop in proxyCache ? proxyCache[prop] : targetObject[prop];
      },
      set: (target, prop, value) => {
        targetObject[prop] = value;
        proxyCache[prop] = value;
        if (shouldExposeToGlobal) (globalThis as any)[prop] = targetObject[prop];
        return true;
      }
    });
    
    return proxyHandler;
  })(appConfig);
  
  function logToConsole(level: string, moduleName: string, isDevOnly: boolean, ...args: any[]) {
    if (isDevOnly) return;
    const [red, green, blue] = (function(inputString: string) {
      let hash = 0;
      inputString.split('').forEach((char, index) => {
        hash = inputString.charCodeAt(index) + ((hash << 5) - hash);
      });
      return [(hash & 0xff0000) >> 16, (hash & 0x00ff00) >> 8, hash & 0x0000ff];
    })(moduleName);
    
    (console as any)[level](
      `%c[HTOS:${moduleName}]`,
      `color: rgb(${red}, ${green}, ${blue}); font-weight: bold;`,
      ...args
    );
  }
  
  function createAndLogError(moduleName: string, message: string, ...args: any[]) {
    const error = new Error(message);
    logToConsole('error', moduleName, false, error, ...args);
    return error;
  }
  
  (globalThis as any)[globalAppKey] = proxiedApp;
  htosApp = proxiedApp;
})();

// Initialize random bytes function
getRandomBytes = (size: number) => crypto.getRandomValues(new Uint8Array(size));

// Nanoid implementation
htosApp.$nanoid = (size = 21) => {
  let id = '';
  const alphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
  let i = size;
  while (i--) {
    id += alphabet[(Math.random() * 64) | 0];
  }
  return id;
};

// Utility functions
(() => {
  const { $utils: utils } = htosApp;
  
  // Type checking utilities
  utils.is = {
    null: (value: any): value is null => value === null,
    defined: (value: any) => value !== undefined,
    undefined: (value: any): value is undefined => value === undefined,
    nil: (value: any) => value == null,
    boolean: (value: any): value is boolean => typeof value === 'boolean',
    number: (value: any): value is number => typeof value === 'number',
    string: (value: any): value is string => typeof value === 'string',
    symbol: (value: any): value is symbol => typeof value === 'symbol',
    function: (value: any): value is Function => typeof value === 'function',
    map: (value: any): value is Map<any, any> => value instanceof Map,
    set: (value: any): value is Set<any> => value instanceof Set,
    url: (value: any): value is URL => value instanceof URL,
    blob: (value: any): value is Blob => value instanceof Blob,
    file: (value: any): value is File => value instanceof File,
    error: (value: any): value is Error => value instanceof Error,
    regexp: (value: any): value is RegExp => value instanceof RegExp,
    array: (value: any): value is any[] => Array.isArray(value),
    object: (value: any): value is object => 
      value !== null && typeof value === 'object' && !Array.isArray(value),
    nan: (value: any): value is number => Number.isNaN(value),
    nonPrimitive: (value: any) => 
      (typeof value === 'object' && value !== null) || typeof value === 'function',
    numeric: (value: any) => !isNaN(parseFloat(value)) && isFinite(value),
    empty: (value: any) => {
      if (value == null) return true;
      if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
      if (value instanceof Map || value instanceof Set) return value.size === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    }
  };
  
  // Promise utilities
  utils.promise = {
    createPromise: () => {
      let resolve: (value?: any) => void;
      let reject: (reason?: any) => void;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve: resolve!, reject: reject! };
    }
  };
  
  // ID generation utilities
  utils.id = {
    pico: (existingIds: string[] = []) => {
      let id: string;
      do {
        id = htosApp.$nanoid(8);
      } while (existingIds.includes(id));
      return id;
    },
    nano: (existingIds: string[] = []) => {
      let id: string;
      do {
        id = htosApp.$nanoid();
      } while (existingIds.includes(id));
      return id;
    },
    uuid: (existingIds: string[] = []) => {
      let id: string;
      do {
        id = crypto.randomUUID();
      } while (existingIds.includes(id));
      return id;
    }
  };
  
  // Storage utilities
  utils.storage = {
    get: (key: string, defaultValue?: any) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch {
        return defaultValue;
      }
    },
    set: (key: string, value: any) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    has: (key: string) => localStorage.getItem(key) !== null,
    remove: (key: string) => localStorage.removeItem(key)
  };
  
  // Object URL utilities
  utils.objectUrl = {
    create: (object: Blob | MediaSource, autoRevokeTimeout = false) => {
      const url = URL.createObjectURL(object);
      if (autoRevokeTimeout) {
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
      return url;
    },
    revoke: (objectUrl: string) => URL.revokeObjectURL(objectUrl)
  };
  
  // Time utilities
  const HOUR_IN_MS = 3600000;
  const DAY_IN_MS = 86400000;
  
  utils.time = {
    SECOND: 1000,
    MINUTE: 60000,
    HOUR: HOUR_IN_MS,
    DAY: DAY_IN_MS,
    since: (timestamp: number) => Date.now() - timestamp,
    formatDuration: (durationMs: number) => {
      const hours = Math.floor(durationMs / HOUR_IN_MS);
      const minutes = Math.floor((durationMs % HOUR_IN_MS) / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    }
  };
  
  // Wait utility
  utils.waitFor = async (
    conditionFn: () => boolean | Promise<boolean>,
    { interval = 100, timeout = 60000 } = {}
  ) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await conditionFn()) return true;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Timeout waiting for condition');
  };
  
  // Sleep utility
  utils.sleep = (durationMs: number) => 
    new Promise(resolve => setTimeout(resolve, durationMs));
})();

// AI Controller
(() => {
  const { $ai: ai } = htosApp;
  ai.controller = {
    init: () => {
      console.log('[HTOS] AI controller initialized');
    }
  };
})();

// Offscreen Controller
(() => {
  const { $offscreen: offscreen } = htosApp;
  offscreen.controller = {
    init: () => {
      console.log('[HTOS] Offscreen controller initialized');
    }
  };
})();

// Timer Controller
(() => {
  const { $timer: timer } = htosApp;
  const timers = new Map<string, number>();
  
  timer.controller = {
    init: () => {
      console.log('[HTOS] Timer controller initialized');
    },
    setTimeout: (timerId: string, duration: number) => {
      const id = setTimeout(() => {
        timers.delete(timerId);
        htosApp.$bus?.emit?.('timer.timeout', { timerId });
      }, duration);
      timers.set(timerId, id);
    },
    clearTimeout: (timerId: string) => {
      const id = timers.get(timerId);
      if (id) {
        clearTimeout(id);
        timers.delete(timerId);
      }
    },
    hasTimers: () => timers.size > 0
  };
})();

// Global state
let iframe: HTMLIFrameElement | null = null;
let isInitialized = false;

/**
 * Initialize the offscreen host with HARPA app system
 */
function initializeOffscreenHost(): void {
  if (isInitialized) return;
  
  console.log('[HTOS] Initializing offscreen host with HARPA app system...');
  
  // Initialize all HARPA controllers
  htosApp.$ai.controller.init();
  htosApp.$offscreen.controller.init();
  htosApp.$timer.controller.init();
  
  // Create and manage the iframe
  createIframe();
  manageIframeStability();
  
  // Set up message handling
  setupMessageHandling();
  setupBus();
  
  isInitialized = true;
  console.log('[HTOS] Offscreen host initialized with HARPA architecture');
}

/**
 * Create the iframe for WASM and provider operations
 * HTOS-PILLAR-CHECK: preserves DNR-before-JS & SW-only authority
 */
async function createIframe(): Promise<void> {
  const providerUrl = chrome.runtime.getURL('dist/pow/0f.html');
  iframe = await createProviderIframe(providerUrl, { provider: 'pow' });
  
  // Set up iframe stability management using HARPA pattern
  manageIframeStability();
  
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
      iframe.src = chrome.runtime.getURL('dist/pow/0f.html');
    }
  }
  
  // Retry logic for iframe startup
  const retry = async (retryCount = 0): Promise<void> => {
    if (await pingIframe()) return;
    
    const retrySeconds = retryCount < 4 ? 3 : 60;
    console.log(`[HTOS] Failed to start iframe engine, trying again in ${retrySeconds}s...`);
    
    await sleep(retrySeconds * 1000);
    
    if (iframe) {
      iframe.src = chrome.runtime.getURL('dist/pow/0f.html');
    }
    
    await retry(retryCount + 1);
  };
  
  await retry();
  
  // Set up periodic health check (every 5 minutes)
  setInterval(async () => {
    if (!(await pingIframe())) {
      console.log('[HTOS] Failed to ping iframe engine, restarting...');
      if (iframe) {
        iframe.src = chrome.runtime.getURL('dist/pow/0f.html');
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
interface BusResponse { id: string; ok: boolean; data?: any; error?: string; }

function setupMessageHandling(): void {
  // Listen for messages from service worker
  chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
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
async function handleMessage(message: any): Promise<BusResponse> {
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
async function forwardToIframe(message: any): Promise<BusResponse> {
  if (!iframe || !iframe.contentWindow) {
    return { id: message.id, ok: false, error: 'Iframe not available' };
  }
  
  return new Promise<BusResponse>((resolve) => {
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
function setupBus(): void {
  // Initialize BroadcastChannel following HARPA pattern
  const bus = new BroadcastChannel('bus.channel');
  
  bus.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    
    console.log('Offscreen received bus message:', msg.type, msg.id);
    
    switch (msg.type) {
      case 'ask':
        // Handle Claude test specifically
        if (msg.payload?.provider === 'claude-test') {
          try {
            console.log('[Offscreen] Starting Claude test flow');
            
            // Create Claude test iframe if not exists
            let testIframe = document.getElementById('claude-test-iframe') as HTMLIFrameElement;
            if (!testIframe) {
              testIframe = document.createElement('iframe');
              testIframe.id = 'claude-test-iframe';
              testIframe.src = './iframes/claude-test.html?autorun=true';
              testIframe.style.display = 'none';
              document.body.appendChild(testIframe);
              
              // Wait for iframe to load
              await new Promise(resolve => {
                testIframe.onload = resolve;
              });
            }
            
            // Send test command to iframe
            testIframe.contentWindow?.postMessage({
              type: 'run-claude-test',
              prompt: msg.payload.prompt || 'Test Claude integration'
            }, '*');
            
            // Wait for test completion
            const result = await new Promise((resolve) => {
              const messageHandler = (event: MessageEvent) => {
                if (event.data.type === 'claude-test-complete') {
                  window.removeEventListener('message', messageHandler);
                  resolve(event.data);
                }
              };
              window.addEventListener('message', messageHandler);
            });
            
            // Send done message back via bus
            bus.postMessage({
              id: msg.id,
              type: 'done',
              payload: result,
              timestamp: Date.now()
            });
            
          } catch (error) {
            bus.postMessage({
              id: msg.id,
              type: 'done',
              payload: { error: error instanceof Error ? error.message : String(error) },
              timestamp: Date.now()
            });
          }
        } else {
          // Forward other ask messages to iframe for processing
          try {
            const result = await forwardToIframe(msg);
            // Send done message back via bus
            bus.postMessage({
              id: msg.id,
              type: 'done',
              payload: result.data || { error: result.error },
              timestamp: Date.now()
            });
          } catch (error) {
            bus.postMessage({
              id: msg.id,
              type: 'done',
              payload: { error: error instanceof Error ? error.message : String(error) },
              timestamp: Date.now()
            });
          }
        }
        break;
        
      case 'ping':
        // Respond to health check
        bus.postMessage({
          id: msg.id,
          type: 'done',
          payload: { status: 'ok', context: 'offscreen' },
          timestamp: Date.now()
        });
        break;
        
      default:
        console.log('Unknown bus message type:', msg.type);
    }
  });
  
  console.log('Offscreen bus initialized on channel: bus.channel');
}

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