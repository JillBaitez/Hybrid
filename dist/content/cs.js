/**
 * HTOS Content Script
 *
 * Handles iframe injection, message relaying, and page interaction.
 * Ported from HARPA's cs.js with HTOS adaptations.
 *
 * Architecture:
 * - Iframe injection and management
 * - Message bus for page-to-runtime communication
 * - Anti-detection patches and stealth mode
 * - Provider authentication coordination
 *
 * HTOS-PILLAR-CHECK: preserves DNR-before-JS & SW-only authority
 */
// CRITICAL: Anti-bot DOM patches - MUST run before page scripts (document_start)
(() => {
    // Patch IntersectionObserver for anti-bot detection
    if (window.IntersectionObserver) {
        const OriginalIntersectionObserver = window.IntersectionObserver;
        window.IntersectionObserver = class extends OriginalIntersectionObserver {
            constructor(callback, options) {
                super(callback, options);
                // HTOS-PILLAR-CHECK: Anti-bot IntersectionObserver patch
            }
        };
    }
    // Patch document.visibilityState for anti-bot detection
    Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true
    });
    // Patch document.hidden for anti-bot detection
    Object.defineProperty(document, 'hidden', {
        get: () => false,
        configurable: true
    });
    // Patch requestAnimationFrame for anti-bot detection
    let lastFrameTimestamp = 0;
    window.requestAnimationFrame = (callback) => {
        const currentTime = performance.now();
        const nextFrameTime = Math.max(lastFrameTimestamp + 16, currentTime);
        return window.setTimeout(() => {
            callback((lastFrameTimestamp = nextFrameTime));
        }, nextFrameTime - currentTime);
    };
    // Patch WebGL for fingerprint masking
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextType, options) {
        // Only patch webgl / webgl2
        if (contextType !== 'webgl' && contextType !== 'webgl2') {
            return originalGetContext.call(this, contextType, options);
        }
        const ctx = originalGetContext.call(this, contextType, options);
        if (!ctx)
            return ctx;
        const originalGetParameter = ctx.getParameter.bind(ctx);
        ctx.getParameter = (parameter) => {
            if (parameter === ctx.RENDERER || parameter === ctx.VENDOR) {
                return 'HTOS-Masked';
            }
            return originalGetParameter(parameter);
        };
        return ctx;
    };
    // Patch navigator properties for stealth
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
    });
    console.log('[HTOS] Comprehensive anti-bot DOM patches applied at document_start');
})();
// Initialize HTOS content script
window.htos = {
    global: {},
    globals: {},
    $startup: {},
    $engine: {},
    $bus: {},
    $stealth: null,
};
const htos = window.htos;
// Utility functions
(() => {
    const utils = {
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        createPromise: () => {
            let resolve;
            let reject;
            const promise = new Promise((res, rej) => {
                resolve = res;
                reject = rej;
            });
            Object.defineProperty(promise, 'resolve', {
                get: () => resolve,
            });
            Object.defineProperty(promise, 'reject', {
                get: () => reject,
            });
            return promise;
        },
        is: {
            string: (value) => typeof value === 'string',
            defined: (value) => value !== undefined && value !== null,
        },
        pickRandom: (array) => {
            return array[Math.floor(Math.random() * array.length)];
        },
    };
    htos.$utils = utils;
})();
// Message Bus Implementation
(() => {
    htos.$bus = {
        handlers: new Map(),
        _tabId: null,
        on(event, handler) {
            if (!this.handlers.has(event)) {
                this.handlers.set(event, []);
            }
            this.handlers.get(event).push(handler);
        },
        off(event, handler) {
            const handlers = this.handlers.get(event);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index > -1) {
                    handlers.splice(index, 1);
                }
            }
        },
        emit(event, data) {
            const handlers = this.handlers.get(event);
            if (handlers) {
                handlers.forEach((handler) => {
                    try {
                        handler(data);
                    }
                    catch (error) {
                        console.error(`Error in event handler for ${event}:`, error);
                    }
                });
            }
        },
        async send(type, ...args) {
            return new Promise((resolve) => {
                chrome.runtime.sendMessage({ type, args }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve(null);
                    }
                    else {
                        resolve(response);
                    }
                });
            });
        },
        async call(type, ...args) {
            return this.send(type, ...args);
        },
        async getTabId() {
            if (this._tabId)
                return this._tabId;
            const response = await this.send('htos.getTabId');
            this._tabId = response?.tabId || 0;
            return this._tabId;
        },
        error(error) {
            console.error('HTOS Bus Error:', error);
        },
    };
})();
// Startup Controller
(() => {
    htos.$startup = {
        controller: {
            ensureRootElement() {
                let root = document.querySelector('htos-root');
                if (!root) {
                    root = document.createElement('htos-root');
                    root.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 0 !important;
            height: 0 !important;
            z-index: 2147483647 !important;
            pointer-events: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
          `;
                    (document.documentElement || document.body).appendChild(root);
                }
                return root;
            },
            executeJs(script) {
                const scriptElement = document.createElement('script');
                scriptElement.textContent = script;
                (document.head || document.documentElement).appendChild(scriptElement);
                scriptElement.remove();
            },
            insert(src) {
                if (src.endsWith('.js')) {
                    const script = document.createElement('script');
                    script.src = chrome.runtime.getURL(src);
                    script.type = 'module';
                    (document.head || document.documentElement).appendChild(script);
                }
                else if (src.endsWith('.css')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = chrome.runtime.getURL(src);
                    (document.head || document.documentElement).appendChild(link);
                }
            },
        },
    };
})();
// Engine Controller
(() => {
    const { $startup: startupModule, $bus: busModule, $utils: utils } = htos;
    htos.$engine = {
        controller: {
            connectionPromise: utils.createPromise(),
            async init() {
                // Initialize connection promise
                this.connectionPromise = utils.createPromise();
                // Listen for provider connection requests
                chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                    if (message.type === 'htos.connect') {
                        this.handleConnectionRequest(message.payload);
                        sendResponse({ ok: true });
                    }
                    return true;
                });
                console.log('HTOS Engine initialized');
            },
            async handleConnectionRequest(config) {
                try {
                    const injector = this.createInjector();
                    injector.inject(config);
                    await this.connectionPromise;
                    console.log('HTOS connection established');
                }
                catch (error) {
                    console.error('HTOS connection failed:', error);
                }
            },
            createInjector() {
                return {
                    config: null,
                    _root: null,
                    _tabId: null,
                    inject(config) {
                        this.config = this._parseConfig(config);
                        if (this.config && this.config.frameName) {
                            this._root = startupModule.controller.ensureRootElement();
                            try {
                                localStorage.setItem('htos.config', JSON.stringify(this.config));
                            }
                            catch { }
                            this._propagateEvents(this.config);
                            if (!this.config.noPatches) {
                                this._insertStealth(this.config);
                                this._insertPatches(this.config);
                            }
                            this._insertInjection();
                            return this;
                        }
                    },
                    _parseConfig(config) {
                        try {
                            const defaultConfig = {
                                beforeLoad: [
                                    'patch-console',
                                    'no-content-visibility',
                                    'no-prompt',
                                    'no-notification',
                                    'no-request-fullscreen',
                                    'force-visible',
                                    'shim-raf',
                                    'no-transitions',
                                    'patch-intersection-observer',
                                ],
                                afterLoad: [],
                                stealth: true,
                                waitForDocumentBody: true,
                                waitForDocumentReady: true,
                                ...config,
                                configString: btoa(JSON.stringify(config)),
                            };
                            this._constructNavigator(defaultConfig);
                            return defaultConfig;
                        }
                        catch (error) {
                            console.error('Config parse error:', error);
                            return null;
                        }
                    },
                    _constructNavigator(config) {
                        if (config.vua) {
                            const spoofedProfiles = {
                                'macbook-13.4': {
                                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
                                    platform: 'MacIntel',
                                },
                                'windows-pc': {
                                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36',
                                    platform: 'Win32',
                                },
                                'galaxy-s5': {
                                    userAgent: 'Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36',
                                    platform: 'Android',
                                },
                                'iphone-x': {
                                    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.5 Mobile/15E148 Safari/604.1',
                                    platform: 'iPhone',
                                    vendor: 'Apple Computer, Inc.',
                                },
                            };
                            const profile = spoofedProfiles[config.vua];
                            if (profile) {
                                config.navigator = {
                                    ...profile,
                                    appVersion: profile.userAgent.slice(8),
                                    vendor: profile.vendor || 'Google Inc.',
                                    webdriver: false,
                                    productSub: '20030107',
                                };
                            }
                        }
                        if (config.vlang) {
                            const formattedLang = config.vlang.replace('_', '-');
                            config.navigator = {
                                ...config.navigator,
                                language: formattedLang,
                                languages: [formattedLang],
                            };
                            if (formattedLang.includes('-')) {
                                config.navigator.languages.push(formattedLang.split('-')[1]);
                            }
                        }
                    },
                    _propagateEvents(config) {
                        const messageListener = async ({ data: messageData }) => {
                            if (!this._root?.isConnected) {
                                window.removeEventListener('message', messageListener);
                                return;
                            }
                            if (!messageData)
                                return;
                            if (messageData.frameName === config.frameName && messageData.type === 'connected') {
                                htos.$engine.controller.connectionPromise.resolve();
                                return;
                            }
                            if (messageData.frameName === config.frameName && messageData.type === 'execute') {
                                this._tabId ?? (this._tabId = await busModule.getTabId());
                                await busModule.send('engine.executeJs', this._tabId, messageData.js);
                                return;
                            }
                            if (messageData.frameName === config.frameName && messageData.type !== 'request') {
                                await chrome.runtime.sendMessage(messageData);
                            }
                        };
                        window.addEventListener('message', messageListener);
                    },
                    _insertStealth(config) {
                        if (config.stealth && typeof htos.$stealth === 'function') {
                            startupModule.controller.executeJs(`(${htos.$stealth.toString()})()`);
                        }
                    },
                    _insertPatches(config) {
                        const patchScript = `
              (function() {
                const config = ${JSON.stringify(config)};
                navigator.config = config;
                
                const originalVisibilityStateGetter = document.__lookupGetter__('visibilityState')?.bind(document);
                
                const defineObjectProperty = (target, propertyName, descriptor) => {
                  try {
                    Object.defineProperty(target, propertyName, descriptor);
                  } catch {}
                };
                
                const injectStyle = (cssText) => {
                  const styleElement = document.createElement('style');
                  styleElement.textContent = cssText;
                  document.querySelector('htos-root')?.append(styleElement);
                };
                
                const patchImplementations = {
                  'patch-console'() {
                    window.log = console.log;
                  },
                  
                  'no-content-visibility'() {
                    injectStyle('* { content-visibility: visible !important; }');
                  },
                  
                  'no-transitions'() {
                    injectStyle('body, body * { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }');
                  },
                  
                  'no-prompt'() {
                    window.prompt = () => {};
                  },
                  
                  'no-notification'() {
                    if ('Notification' in window) {
                      defineObjectProperty(window.Notification, 'permission', {
                        get: () => 'denied',
                      });
                      defineObjectProperty(window.Notification, 'requestPermission', {
                        value: (callback) => {
                          callback && callback('denied');
                          return Promise.resolve('denied');
                        },
                      });
                    }
                  },
                  
                  'force-visible'() {
                    const preventEventDefaultsHandler = (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.stopImmediatePropagation();
                    };
                    
                    const createValueGetter = (value = false) => ({
                      get: () => value,
                    });
                    
                    defineObjectProperty(document, 'visibilityState', createValueGetter('visible'));
                    defineObjectProperty(document, 'hidden', createValueGetter(false));
                    defineObjectProperty(document, 'webkitHidden', createValueGetter(false));
                    
                    document.__proto__.hasFocus = () => true;
                    
                    document.addEventListener('blur', preventEventDefaultsHandler, true);
                    window.addEventListener('blur', preventEventDefaultsHandler, true);
                    window.addEventListener('pagehide', preventEventDefaultsHandler, true);
                    
                    window.addEventListener('load', () => {
                      document.body?.focus({ preventScroll: true });
                      document.dispatchEvent(new Event('visibilitychange'));
                    });
                  },
                  
                  'shim-raf'() {
                    let lastFrameTimestamp = 0;
                    window.requestAnimationFrame = (callback) => {
                      const currentTime = window.performance.now();
                      const nextFrameTime = Math.max(lastFrameTimestamp + 16, currentTime);
                      return setTimeout(() => {
                        callback(lastFrameTimestamp = nextFrameTime);
                      }, nextFrameTime - currentTime);
                    };
                    window.cancelAnimationFrame = (timeoutId) => clearTimeout(timeoutId);
                  },
                  
                  'no-request-fullscreen'() {
                    window.addEventListener('DOMContentLoaded', () => {
                      if (document.body) {
                        document.body.requestFullscreen = () => {};
                      }
                    });
                  },
                  
                  'patch-intersection-observer'() {
                    if (!originalVisibilityStateGetter || originalVisibilityStateGetter() === 'visible') return;
                    
                    let isPageHidden = true;
                    document.addEventListener('visibilitychange', () => {
                      isPageHidden = originalVisibilityStateGetter() === 'hidden';
                    });
                    
                    const OriginalIntersectionObserver = window.IntersectionObserver;
                    window.IntersectionObserver = class extends OriginalIntersectionObserver {
                      constructor(...args) {
                        super(...args);
                        this._cb = args[0].bind(this);
                        this._timer = null;
                        this._entries = [];
                        this._viewport = {
                          x: 0, y: 0, top: 0, left: 0,
                          right: window.innerWidth,
                          width: window.innerWidth,
                          bottom: Math.max(2100, window.innerHeight),
                          height: Math.max(2100, window.innerHeight),
                        };
                      }
                      
                      observe(targetElement) {
                        if (!isPageHidden) return super.observe(targetElement);
                        
                        const targetRect = targetElement.getBoundingClientRect();
                        this._entries.push({
                          time: 1000,
                          target: targetElement,
                          rootBounds: this._viewport,
                          intersectionRect: targetRect,
                          boundingClientRect: targetRect,
                          isVisible: true,
                          intersectionRatio: 1,
                          isIntersecting: targetRect.left < this._viewport.right &&
                                         targetRect.right > this._viewport.left &&
                                         targetRect.top < this._viewport.bottom &&
                                         targetRect.bottom > this._viewport.top,
                        });
                        
                        clearTimeout(this._timer);
                        this._timer = setTimeout(() => {
                          this._cb(this._entries, this);
                          this._entries = [];
                        }, 500);
                      }
                      
                      unobserve(targetElement) {
                        if (!isPageHidden) return super.unobserve(targetElement);
                      }
                    };
                  },
                };
                
                const executePatches = (patchNames) => {
                  for (const patchName of patchNames) {
                    const patchFunction = patchImplementations[patchName];
                    if (patchFunction) patchFunction();
                  }
                };
                
                // Apply navigator patches
                if (config.navigator) {
                  for (const propertyName in config.navigator) {
                    if (navigator[propertyName] === config.navigator[propertyName]) continue;
                    
                    const propertyDescriptor = {
                      get: () => config.navigator[propertyName],
                    };
                    
                    try {
                      Object.defineProperty(navigator, propertyName, propertyDescriptor);
                    } catch (error) {
                      globalThis.navigator = Object.create(navigator, {
                        [propertyName]: propertyDescriptor,
                      });
                    }
                  }
                }
                
                executePatches(config.beforeLoad);
                window.onload = () => executePatches(config.afterLoad);
              })();
            `;
                        startupModule.controller.executeJs(patchScript);
                    },
                    _insertInjection() {
                        // Insert the injected scripts for provider interaction
                        startupModule.controller.insert('src/session-layer/nj-engine.js');
                        startupModule.controller.insert('src/session-layer/nj-engine.css');
                    },
                };
            },
        },
    };
})();
// Provider Connection Handler
(() => {
    const { $engine: engineModule } = htos;
    // Auto-connect logic for provider detection
    const autoConnector = {
        async init() {
            // Check if we're on a supported provider domain
            const hostname = window.location.hostname;
            const supportedProviders = ['chat.openai.com', 'claude.ai', 'gemini.google.com'];
            if (supportedProviders.some(domain => hostname.includes(domain))) {
                // Request connection configuration from service worker
                const response = await chrome.runtime.sendMessage({
                    type: 'htos.shouldConnect',
                    hostname,
                });
                if (response?.config) {
                    engineModule.controller.handleConnectionRequest(response.config);
                }
            }
        },
    };
    // Initialize auto-connector when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => autoConnector.init());
    }
    else {
        autoConnector.init();
    }
})();
// Initialize HTOS Content Script
(() => {
    const { $engine: engineModule, $bus: busModule } = htos;
    // Initialize components
    engineModule.controller.init();
    // Set up message handling
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        busModule.emit(message.type, message);
        sendResponse({ ok: true });
        return true;
    });
    console.log('HTOS Content Script initialized');
})();
