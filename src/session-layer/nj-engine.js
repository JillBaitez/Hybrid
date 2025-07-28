/**
 * HTOS Injection Engine (nj-engine.js)
 * 
 * Injected into provider pages for session-based authentication.
 * Handles DOM automation, token extraction, and message relay.
 * Ported from HARPA's nj.js with HTOS adaptations.
 * 
 * Architecture:
 * - Provider-agnostic injection framework
 * - Session token extraction
 * - DOM automation utilities
 * - Message bus for iframe communication
 */

  // Global application object for HTOS injection engine
(() => {
  'use strict';

  // Initialize HTOS application object
  const app = globalThis.htosApp = {
    name: 'HTOS',
    version: '1.0.0',
    locus: 'nj',
    global: {},
    globals: {},
    $env: {},
    $startup: {},
    $bus: {},
    $utils: {},
    $session: {},
    $dom: {},
    $tokenExtractor: {},
  };

  // Environment detection
  (() => {
    const { $env: env } = app;
    
    env.getLocus = () => {
      const { protocol, host, pathname, href } = location;
      
      // Detect environment based on URL patterns
      if (href.includes('/htos-iframe') || href.includes('localhost:3000/iframe')) {
        return 'iframe';
      } else if (protocol !== 'chrome-extension:' && chrome?.runtime?.getURL) {
        return 'cs';
      } else if (host === 'localhost:3050') {
        return 'dev';
      } else if (protocol !== 'chrome-extension:') {
        return 'nj';
      } else if (pathname === '/offscreen.html') {
        return 'os';
      } else {
        return 'bg';
      }
    };

    env.isTopFrame = () => globalThis.top === globalThis;
    env.isIframe = () => globalThis !== globalThis.top;
  })();

  // Utility functions
  (() => {
    const { $utils: utils } = app;

    utils.createPromise = () => {
      let resolve, reject;
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
    };

    utils.sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

    utils.waitFor = async (conditionFn, { interval = 100, timeout = 60000 } = {}) => {
      if (timeout <= 0) throw new Error('waitFor: timeout exceeded');
      
      const startTime = Date.now();
      const result = await conditionFn();
      if (result) return result;
      
      await utils.sleep(interval);
      const elapsedTime = Date.now() - startTime;
      return utils.waitFor(conditionFn, {
        interval,
        timeout: timeout - elapsedTime,
      });
    };

    utils.is = {
      null: (value) => value === null,
      defined: (value) => value !== undefined,
      undefined: (value) => value === undefined,
      nil: (value) => value == null,
      boolean: (value) => typeof value === 'boolean',
      number: (value) => typeof value === 'number',
      string: (value) => typeof value === 'string',
      symbol: (value) => typeof value === 'symbol',
      function: (value) => typeof value === 'function',
      array: (value) => Array.isArray(value),
      object: (value) => Object.prototype.toString.call(value) === '[object Object]',
      error: (value) => value instanceof Error,
      empty: (value) => {
        if (utils.is.nil(value)) return true;
        if (utils.is.array(value)) return value.length === 0;
        if (utils.is.object(value)) return Object.keys(value).length === 0;
        if (utils.is.string(value)) return value.trim().length === 0;
        return false;
      },
    };

    utils.generateId = () => `htos-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    utils.pickRandom = (array) => array[Math.floor(Math.random() * array.length)];
  })();

  // Message Bus Implementation
  (() => {
    const { $bus: bus, $utils: utils } = app;

    bus.controller = {
      _messageId: 0,
      _pendingMessages: new Map(),
      _listeners: new Map(),

      async init() {
        this._setupMessageListener();
        console.log('HTOS Bus initialized');
      },

      _setupMessageListener() {
        window.addEventListener('message', (event) => {
          const { data } = event;
          if (!data || !data.type) return;

          // Handle responses to pending messages
          if (data.messageId && this._pendingMessages.has(data.messageId)) {
            const { resolve } = this._pendingMessages.get(data.messageId);
            this._pendingMessages.delete(data.messageId);
            resolve(data.payload);
            return;
          }

          // Handle incoming messages
          const listeners = this._listeners.get(data.type) || [];
          listeners.forEach(listener => {
            try {
              listener(data.payload, event);
            } catch (error) {
              console.error(`Error in message listener for ${data.type}:`, error);
            }
          });
        });
      },

      on(type, listener) {
        if (!this._listeners.has(type)) {
          this._listeners.set(type, []);
        }
        this._listeners.get(type).push(listener);
      },

      off(type, listener) {
        const listeners = this._listeners.get(type);
        if (listeners) {
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      },

      async send(type, payload = null, target = window.parent) {
        const messageId = ++this._messageId;
        const message = {
          type,
          payload,
          messageId,
          frameName: this._getFrameName(),
          timestamp: Date.now(),
        };

        return new Promise((resolve, reject) => {
          this._pendingMessages.set(messageId, { resolve, reject });
          
          // Set timeout for message response
          setTimeout(() => {
            if (this._pendingMessages.has(messageId)) {
              this._pendingMessages.delete(messageId);
              reject(new Error(`Message timeout: ${type}`));
            }
          }, 30000);

          target.postMessage(message, '*');
        });
      },

      emit(type, payload = null, target = window.parent) {
        const message = {
          type,
          payload,
          frameName: this._getFrameName(),
          timestamp: Date.now(),
        };
        target.postMessage(message, '*');
      },

      _getFrameName() {
        return window.name || 'htos-frame';
      },
    };
  })();

  // DOM Utilities
  (() => {
    const { $dom: dom, $utils: utils } = app;

    dom.controller = {
      async waitForElement(selector, timeout = 10000) {
        return utils.waitFor(
          () => document.querySelector(selector),
          { timeout }
        );
      },

      async waitForElements(selector, timeout = 10000) {
        return utils.waitFor(
          () => {
            const elements = document.querySelectorAll(selector);
            return elements.length > 0 ? Array.from(elements) : null;
          },
          { timeout }
        );
      },

      async clickElement(selector) {
        const element = await this.waitForElement(selector);
        if (element) {
          element.click();
          return true;
        }
        return false;
      },

      async typeText(selector, text, delay = 50) {
        const element = await this.waitForElement(selector);
        if (element) {
          element.focus();
          element.value = '';
          
          for (const char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await utils.sleep(delay);
          }
          
          element.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      },

      async extractText(selector) {
        const element = await this.waitForElement(selector);
        return element ? element.textContent.trim() : null;
      },

      async extractAttribute(selector, attribute) {
        const element = await this.waitForElement(selector);
        return element ? element.getAttribute(attribute) : null;
      },

      async extractCookie(name) {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [cookieName, cookieValue] = cookie.trim().split('=');
          if (cookieName === name) {
            return decodeURIComponent(cookieValue);
          }
        }
        return null;
      },

      async extractLocalStorage(key) {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },

      async extractSessionStorage(key) {
        try {
          return sessionStorage.getItem(key);
        } catch {
          return null;
        }
      },
    };
  })();

  // Session Management
  (() => {
    const { $session: session, $bus: bus, $dom: dom, $utils: utils } = app;

    session.controller = {
      async extractSessionToken() {
        const provider = this._detectProvider();
        
        switch (provider) {
          case 'openai':
            return this._extractOpenAIToken();
          case 'claude':
            return this._extractClaudeToken();
          case 'gemini':
            return this._extractGeminiToken();
          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }
      },

      _detectProvider() {
        const hostname = window.location.hostname;
        
        if (hostname.includes('openai.com')) return 'openai';
        if (hostname.includes('claude.ai')) return 'claude';
        if (hostname.includes('gemini.google.com')) return 'gemini';
        
        return 'unknown';
      },

      async _extractOpenAIToken() {
        // Extract session token from OpenAI
        const sessionToken = await dom.controller.extractCookie('__Secure-next-auth.session-token');
        if (sessionToken) {
          return { type: 'session', token: sessionToken };
        }

        // Fallback: extract from localStorage
        const authData = await dom.controller.extractLocalStorage('auth');
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            return { type: 'auth', token: parsed.accessToken };
          } catch {}
        }

        throw new Error('OpenAI session token not found');
      },

      async _extractClaudeToken() {
        // Extract session token from Claude
        const sessionKey = await dom.controller.extractCookie('sessionKey');
        if (sessionKey) {
          return { type: 'session', token: sessionKey };
        }

        // Fallback: extract from localStorage
        const authData = await dom.controller.extractLocalStorage('claude_auth');
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            return { type: 'auth', token: parsed.token };
          } catch {}
        }

        throw new Error('Claude session token not found');
      },

      async _extractGeminiToken() {
        // Extract session token from Gemini
        const authCookie = await dom.controller.extractCookie('__Secure-1PSID');
        if (authCookie) {
          return { type: 'session', token: authCookie };
        }

        // Fallback: extract from page context
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          const content = script.textContent;
          if (content && content.includes('_reqid')) {
            const match = content.match(/"SNlM0e":"([^"]+)"/);
            if (match) {
              return { type: 'reqid', token: match[1] };
            }
          }
        }

        throw new Error('Gemini session token not found');
      },

      async authenticateSession() {
        try {
          const tokenData = await this.extractSessionToken();
          
          // Send token to parent frame
          await bus.controller.send('htos.session.token', tokenData);
          
          return tokenData;
        } catch (error) {
          console.error('Session authentication failed:', error);
          throw error;
        }
      },
    };
  })();

  // Startup Controller
  (() => {
    const { $startup: startup, $bus: bus, $utils: utils } = app;

    startup.controller = {
      _initPromise: null,

      async init() {
        this._initPromise = utils.createPromise();
        
        try {
          await bus.controller.init();
          
          // Set up message handlers
          this._setupMessageHandlers();
          
          // Signal that injection is ready
          bus.controller.emit('connected');
          
          this._initPromise.resolve();
          console.log('HTOS Injection Engine ready');
        } catch (error) {
          console.error('HTOS Injection Engine initialization failed:', error);
          this._initPromise.reject(error);
        }
      },

      async waitInit() {
        await this._initPromise;
      },

      _setupMessageHandlers() {
        const { $session: session } = app;

        // Handle session token extraction requests
        bus.controller.on('htos.session.extract', async () => {
          try {
            const tokenData = await session.controller.extractSessionToken();
            bus.controller.emit('htos.session.token', tokenData);
          } catch (error) {
            bus.controller.emit('htos.session.error', { error: error.message });
          }
        });

        // Handle authentication requests
        bus.controller.on('htos.session.authenticate', async () => {
          try {
            const tokenData = await session.controller.authenticateSession();
            bus.controller.emit('htos.session.authenticated', tokenData);
          } catch (error) {
            bus.controller.emit('htos.session.error', { error: error.message });
          }
        });

        // Handle ping requests
        bus.controller.on('htos.ping', () => {
          bus.controller.emit('htos.pong');
        });

        // Handle token extraction requests (HARPA Sprint 4 pattern)
        bus.controller.on('htos.extract.token', async (payload) => {
          try {
            const tokenData = await app.$tokenExtractor.extractTokenFromProvider(payload.domain);
            bus.controller.emit('htos.extract.response', { success: true, token: tokenData });
          } catch (error) {
            bus.controller.emit('htos.extract.response', { success: false, error: error.message });
          }
        });
      },
    };

    // Auto-initialize
    startup.controller.init();
  })();

  // Token Extractor Implementation (HARPA Sprint 4)
  (() => {
    const { $tokenExtractor: tokenExtractor, $dom: dom, $utils: utils } = app;

    tokenExtractor.extractTokenFromProvider = async function(domain) {
      // Use current page's provider detection
      const provider = this._detectProvider(domain);
      
      switch (provider) {
        case 'openai':
          return this._extractOpenAIToken();
        case 'claude':
          return this._extractClaudeToken();
        case 'gemini':
          return this._extractGeminiToken();
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    };

    tokenExtractor._detectProvider = function(domain) {
      const hostname = domain || window.location.hostname;
      
      if (hostname.includes('openai.com') || hostname.includes('chat.openai.com')) return 'openai';
      if (hostname.includes('claude.ai')) return 'claude';
      if (hostname.includes('gemini.google.com')) return 'gemini';
      
      return 'unknown';
    };

    tokenExtractor._extractOpenAIToken = async function() {
      // Extract session token from OpenAI
      const sessionToken = await dom.controller.extractCookie('__Secure-next-auth.session-token');
      if (sessionToken) {
        return sessionToken;
      }

      // Fallback: extract from localStorage
      const authData = await dom.controller.extractLocalStorage('auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          return parsed.accessToken;
        } catch {}
      }

      throw new Error('OpenAI session token not found');
    };

    tokenExtractor._extractClaudeToken = async function() {
      // Extract session token from Claude
      const sessionKey = await dom.controller.extractCookie('sessionKey');
      if (sessionKey) {
        return sessionKey;
      }

      // Fallback: extract from localStorage
      const authData = await dom.controller.extractLocalStorage('claude_auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          return parsed.token;
        } catch {}
      }

      throw new Error('Claude session token not found');
    };

    tokenExtractor._extractGeminiToken = async function() {
      // Extract session token from Gemini
      const authCookie = await dom.controller.extractCookie('__Secure-1PSID');
      if (authCookie) {
        return authCookie;
      }

      // Fallback: extract from page context
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes('_reqid')) {
          const match = content.match(/"SNlM0e":"([^"]+)"/);
          if (match) {
            return match[1];
          }
        }
      }

      throw new Error('Gemini session token not found');
    };
  })();

  // Polyfills for older browsers
  (() => {
    if (!Array.prototype.toReversed) {
      Array.prototype.toReversed = function() {
        return [...this].reverse();
      };
    }

    if (!Array.prototype.at) {
      Array.prototype.at = function(index) {
        return this[index >= 0 ? index : this.length + index];
      };
    }

    if (!Array.prototype.findLastIndex) {
      Array.prototype.findLastIndex = function(callback, thisArg) {
        for (let index = this.length - 1; index >= 0; index--) {
          if (callback.call(thisArg, this[index], index, this)) {
            return index;
          }
        }
        return -1;
      };
    }
  })();

})();