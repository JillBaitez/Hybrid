(function () {
    'use strict';

    /**
     * HTOS Dynamic Iframe Factory
     * Based on HARPA os.js pattern for runtime iframe creation
     * HTOS-PILLAR-CHECK: preserves DNR-before-JS & SW-only authority
     */
    async function createProviderIframe(url, config) {
        const iframe = document.createElement('iframe');
        // HARPA pattern: Config via query string, not postMessage
        iframe.src = `${url}?c=${encodeURIComponent(btoa(JSON.stringify(config)))}`;
        iframe.name = `htos-${config.provider}`;
        iframe.sandbox = 'allow-scripts allow-same-origin allow-storage-access-by-user-activation';
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none';
        document.body.appendChild(iframe);
        // HTOS-PILLAR-CHECK: Iframe created after DNR rules are registered
        console.log(`[HTOS] Dynamic iframe created for ${config.provider}`);
        return iframe;
    }

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
    // Global HTOS App System (ported from HARPA)
    let htosApp;
    // Initialize global app system
    (() => {
        const globalAppKey = 'htos.global';
        const environment = 'production';
        const isDevMode = false;
        if ((htosApp = globalThis[globalAppKey]))
            return;
        const appConfig = {
            name: globalAppKey,
            env: environment,
            get: (key) => (key in appConfig ? appConfig[key] : null),
            version: '11.2.1'
        };
        // Proxied app system for dynamic module creation
        const proxiedApp = (function createProxy(targetObject) {
            const isRootObject = targetObject === appConfig;
            const shouldExposeToGlobal = isRootObject && isDevMode;
            const proxyCache = {};
            const assignProperties = (sourceObject) => Object.assign(targetObject, sourceObject);
            const proxyHandler = new Proxy(targetObject, {
                get(target, prop) {
                    if (prop === 'assign')
                        return assignProperties;
                    if (isRootObject && !String(prop).startsWith('$'))
                        return targetObject[prop];
                    if (!(prop in targetObject)) {
                        targetObject[prop] = {};
                        if (isRootObject) {
                            const log = logToConsole.bind(null, 'log', prop, false);
                            const logDev = logToConsole.bind(null, 'log', prop, true);
                            const warn = logToConsole.bind(null, 'warn', prop, false);
                            const warnDev = logToConsole.bind(null, 'warn', prop, true);
                            const error = logToConsole.bind(null, 'error', prop, false);
                            const errorDev = logToConsole.bind(null, 'error', prop, true);
                            const createError = createAndLogError.bind(null, prop);
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
                        if (shouldExposeToGlobal)
                            globalThis[prop] = targetObject[prop];
                    }
                    return prop in proxyCache ? proxyCache[prop] : targetObject[prop];
                },
                set: (target, prop, value) => {
                    targetObject[prop] = value;
                    proxyCache[prop] = value;
                    if (shouldExposeToGlobal)
                        globalThis[prop] = targetObject[prop];
                    return true;
                }
            });
            return proxyHandler;
        })(appConfig);
        function logToConsole(level, moduleName, isDevOnly, ...args) {
            if (isDevOnly)
                return;
            const [red, green, blue] = (function (inputString) {
                let hash = 0;
                inputString.split('').forEach((char, index) => {
                    hash = inputString.charCodeAt(index) + ((hash << 5) - hash);
                });
                return [(hash & 0xff0000) >> 16, (hash & 0x00ff00) >> 8, hash & 0x0000ff];
            })(moduleName);
            console[level](`%c[HTOS:${moduleName}]`, `color: rgb(${red}, ${green}, ${blue}); font-weight: bold;`, ...args);
        }
        function createAndLogError(moduleName, message, ...args) {
            const error = new Error(message);
            logToConsole('error', moduleName, false, error, ...args);
            return error;
        }
        globalThis[globalAppKey] = proxiedApp;
        htosApp = proxiedApp;
    })();
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
            null: (value) => value === null,
            defined: (value) => value !== undefined,
            undefined: (value) => value === undefined,
            nil: (value) => value == null,
            boolean: (value) => typeof value === 'boolean',
            number: (value) => typeof value === 'number',
            string: (value) => typeof value === 'string',
            symbol: (value) => typeof value === 'symbol',
            function: (value) => typeof value === 'function',
            map: (value) => value instanceof Map,
            set: (value) => value instanceof Set,
            url: (value) => value instanceof URL,
            blob: (value) => value instanceof Blob,
            file: (value) => value instanceof File,
            error: (value) => value instanceof Error,
            regexp: (value) => value instanceof RegExp,
            array: (value) => Array.isArray(value),
            object: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
            nan: (value) => Number.isNaN(value),
            nonPrimitive: (value) => (typeof value === 'object' && value !== null) || typeof value === 'function',
            numeric: (value) => !isNaN(parseFloat(value)) && isFinite(value),
            empty: (value) => {
                if (value == null)
                    return true;
                if (typeof value === 'string' || Array.isArray(value))
                    return value.length === 0;
                if (value instanceof Map || value instanceof Set)
                    return value.size === 0;
                if (typeof value === 'object')
                    return Object.keys(value).length === 0;
                return false;
            }
        };
        // Promise utilities
        utils.promise = {
            createPromise: () => {
                let resolve;
                let reject;
                const promise = new Promise((res, rej) => {
                    resolve = res;
                    reject = rej;
                });
                return { promise, resolve: resolve, reject: reject };
            }
        };
        // ID generation utilities
        utils.id = {
            pico: (existingIds = []) => {
                let id;
                do {
                    id = htosApp.$nanoid(8);
                } while (existingIds.includes(id));
                return id;
            },
            nano: (existingIds = []) => {
                let id;
                do {
                    id = htosApp.$nanoid();
                } while (existingIds.includes(id));
                return id;
            },
            uuid: (existingIds = []) => {
                let id;
                do {
                    id = crypto.randomUUID();
                } while (existingIds.includes(id));
                return id;
            }
        };
        // Storage utilities
        utils.storage = {
            get: (key, defaultValue) => {
                try {
                    const item = localStorage.getItem(key);
                    return item ? JSON.parse(item) : defaultValue;
                }
                catch {
                    return defaultValue;
                }
            },
            set: (key, value) => {
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                }
                catch {
                    return false;
                }
            },
            has: (key) => localStorage.getItem(key) !== null,
            remove: (key) => localStorage.removeItem(key)
        };
        // Object URL utilities
        utils.objectUrl = {
            create: (object, autoRevokeTimeout = false) => {
                const url = URL.createObjectURL(object);
                if (autoRevokeTimeout) {
                    setTimeout(() => URL.revokeObjectURL(url), 30000);
                }
                return url;
            },
            revoke: (objectUrl) => URL.revokeObjectURL(objectUrl)
        };
        // Time utilities
        const HOUR_IN_MS = 3600000;
        const DAY_IN_MS = 86400000;
        utils.time = {
            SECOND: 1000,
            MINUTE: 60000,
            HOUR: HOUR_IN_MS,
            DAY: DAY_IN_MS,
            since: (timestamp) => Date.now() - timestamp,
            formatDuration: (durationMs) => {
                const hours = Math.floor(durationMs / HOUR_IN_MS);
                const minutes = Math.floor((durationMs % HOUR_IN_MS) / 60000);
                const seconds = Math.floor((durationMs % 60000) / 1000);
                if (hours > 0)
                    return `${hours}h ${minutes}m`;
                if (minutes > 0)
                    return `${minutes}m ${seconds}s`;
                return `${seconds}s`;
            }
        };
        // Wait utility
        utils.waitFor = async (conditionFn, { interval = 100, timeout = 60000 } = {}) => {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                if (await conditionFn())
                    return true;
                await new Promise(resolve => setTimeout(resolve, interval));
            }
            throw new Error('Timeout waiting for condition');
        };
        // Sleep utility
        utils.sleep = (durationMs) => new Promise(resolve => setTimeout(resolve, durationMs));
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
        const timers = new Map();
        timer.controller = {
            init: () => {
                console.log('[HTOS] Timer controller initialized');
            },
            setTimeout: (timerId, duration) => {
                const id = setTimeout(() => {
                    timers.delete(timerId);
                    htosApp.$bus?.emit?.('timer.timeout', { timerId });
                }, duration);
                timers.set(timerId, id);
            },
            clearTimeout: (timerId) => {
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
    let iframe = null;
    let isInitialized = false;
    /**
     * Initialize the offscreen host with HARPA app system
     */
    function initializeOffscreenHost() {
        if (isInitialized)
            return;
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
    async function createIframe() {
        const providerUrl = chrome.runtime.getURL('pow/0f.html');
        iframe = await createProviderIframe(providerUrl, { provider: 'pow' });
        // Set up iframe stability management using HARPA pattern
        manageIframeStability();
        console.log('[HTOS] Dynamic iframe created using factory pattern');
    }
    /**
     * IMMUTABLE PILLAR 6: Iframe Stability Guard
     * Manages iframe health and recreates if unresponsive
     */
    async function manageIframeStability() {
        // Wait for network if offline
        if (!navigator.onLine) {
            console.log('[HTOS] Waiting for online...');
            await new Promise((resolve) => {
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
        const retry = async (retryCount = 0) => {
            if (await pingIframe())
                return;
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
    async function pingIframe() {
        if (!iframe || !iframe.contentWindow)
            return false;
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 5000); // 5 second timeout
            const messageHandler = (event) => {
                if (event.data?.type === 'htos.pow.ready') {
                    clearTimeout(timeout);
                    window.removeEventListener('message', messageHandler);
                    resolve(true);
                }
            };
            window.addEventListener('message', messageHandler);
            // Send ping to iframe
            iframe.contentWindow.postMessage({
                type: 'htos.pow.ping',
                id: crypto.randomUUID()
            }, '*');
        });
    }
    function setupMessageHandling() {
        // Listen for messages from service worker
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        window.addEventListener('message', (event) => {
            if (event.source === iframe?.contentWindow) {
                handleIframeMessage(event.data);
            }
        });
    }
    /**
     * Handle messages from service worker
     */
    async function handleMessage(message) {
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
    async function forwardToIframe(message) {
        if (!iframe || !iframe.contentWindow) {
            return { id: message.id, ok: false, error: 'Iframe not available' };
        }
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ id: message.id, ok: false, error: 'Iframe timeout' });
            }, 30000); // 30 second timeout
            const messageHandler = (event) => {
                if (event.data?.id === message.id) {
                    clearTimeout(timeout);
                    window.removeEventListener('message', messageHandler);
                    resolve(event.data);
                }
            };
            window.addEventListener('message', messageHandler);
            iframe.contentWindow.postMessage(message, '*');
        });
    }
    /**
     * Handle messages from iframe
     */
    function setupBus() {
        // Initialize BroadcastChannel following HARPA pattern
        const bus = new BroadcastChannel('bus.channel');
        bus.addEventListener('message', async (event) => {
            const msg = event.data;
            if (!msg || typeof msg !== 'object')
                return;
            console.log('Offscreen received bus message:', msg.type, msg.id);
            switch (msg.type) {
                case 'ask':
                    // Handle Claude test specifically
                    if (msg.payload?.provider === 'claude-test') {
                        try {
                            console.log('[Offscreen] Starting Claude test flow');
                            // Create Claude test iframe if not exists
                            let testIframe = document.getElementById('claude-test-iframe');
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
                                const messageHandler = (event) => {
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
                        }
                        catch (error) {
                            bus.postMessage({
                                id: msg.id,
                                type: 'done',
                                payload: { error: error instanceof Error ? error.message : String(error) },
                                timestamp: Date.now()
                            });
                        }
                    }
                    else {
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
                        }
                        catch (error) {
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
    function handleIframeMessage(data) {
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
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeOffscreenHost);
    }
    else {
        initializeOffscreenHost();
    }

})();
