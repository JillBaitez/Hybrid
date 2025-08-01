(function () {
    'use strict';

    /**
     * HTOS Proof-of-Work (PoW) Iframe Engine
     *
     * Ported from HARPA oi.js with complete functionality:
     * - Global proxied app system
     * - WASM SHA3 hasher
     * - Arkose puzzle solver
     * - Cross-context bus communication
     * - Proof-of-work token generation
     */
    // Global HTOS App System (ported from HARPA oi.js)
    let htosApp;
    // Initialize global app system
    (() => {
        const appGlobalKey = '__htos_global';
        const environment = 'production';
        const isDebug = false;
        if ((htosApp = globalThis[appGlobalKey]))
            return;
        const appConfig = {
            name: appGlobalKey,
            env: environment,
            get: (key) => (key in appConfig ? appConfig[key] : null),
            version: '11.2.1'
        };
        // Proxied app system for dynamic module creation
        const proxiedApp = (function createProxiedModule(targetObject) {
            const isRootObject = targetObject === appConfig;
            const shouldExposeToGlobal = isRootObject && isDebug;
            const moduleCache = {};
            const assignProperties = (properties) => Object.assign(targetObject, properties);
            const proxiedModule = new Proxy(targetObject, {
                get(target, property) {
                    if (property === 'assign')
                        return assignProperties;
                    if (isRootObject && !String(property).startsWith('$'))
                        return targetObject[property];
                    if (!(property in targetObject)) {
                        targetObject[property] = {};
                        if (isRootObject) {
                            const logFn = logMessage.bind(null, 'log', property, false);
                            const logDevFn = logMessage.bind(null, 'log', property, true);
                            const warnFn = logMessage.bind(null, 'warn', property, false);
                            const warnDevFn = logMessage.bind(null, 'warn', property, true);
                            const errorFn = logMessage.bind(null, 'error', property, false);
                            const errorDevFn = logMessage.bind(null, 'error', property, true);
                            const errorFactoryFn = createError.bind(null, property);
                            Object.defineProperties(targetObject[property], {
                                log: { get: () => logFn },
                                logDev: { get: () => logDevFn },
                                warn: { get: () => warnFn },
                                warnDev: { get: () => warnDevFn },
                                error: { get: () => errorFn },
                                errorDev: { get: () => errorDevFn },
                                Error: { get: () => errorFactoryFn }
                            });
                        }
                        moduleCache[property] = createProxiedModule(targetObject[property]);
                        if (shouldExposeToGlobal)
                            globalThis[property] = targetObject[property];
                    }
                    return property in moduleCache ? moduleCache[property] : targetObject[property];
                },
                set: (target, property, value) => {
                    targetObject[property] = value;
                    moduleCache[property] = value;
                    if (shouldExposeToGlobal)
                        globalThis[property] = targetObject[property];
                    return true;
                }
            });
            return proxiedModule;
        })(appConfig);
        function logMessage(logLevel, moduleName, skipLog, ...messages) {
            if (skipLog)
                return;
            const [red, green, blue] = (function (inputString) {
                let hash = 0;
                inputString.split('').forEach((char, index) => {
                    hash = inputString.charCodeAt(index) + ((hash << 5) - hash);
                });
                return [(hash & 0xff0000) >> 16, (hash & 0x00ff00) >> 8, hash & 0x0000ff];
            })(moduleName);
            console[logLevel](`%c[HTOS:${moduleName}]`, `color: rgb(${red}, ${green}, ${blue}); font-weight: bold;`, ...messages);
        }
        function createError(moduleName, message, ...details) {
            const error = new Error(message);
            logMessage('error', moduleName, false, error, ...details);
            return error;
        }
        globalThis[appGlobalKey] = proxiedApp;
        htosApp = proxiedApp;
    })();
    // Set environment context
    htosApp.$env = { getLocus: () => 'oi' };
    // Type-safe reference to ai module
    const ai = htosApp.$ai;
    // Core Utilities (ported from HARPA oi.js)
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
            array: (value) => Array.isArray(value),
            object: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
            blob: (value) => value instanceof Blob,
            error: (value) => value instanceof Error,
            empty: (value) => {
                if (value == null)
                    return true;
                if (typeof value === 'string' || Array.isArray(value))
                    return value.length === 0;
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
        // Utility functions
        utils.pickRandom = (array) => array[Math.floor(Math.random() * array.length)];
        utils.sleep = (durationMs) => new Promise(resolve => setTimeout(resolve, durationMs));
        utils.waitFor = async (conditionFn, { interval = 100, timeout = 60000 } = {}) => {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                if (await conditionFn())
                    return true;
                await new Promise(resolve => setTimeout(resolve, interval));
            }
            throw new Error('Timeout waiting for condition');
        };
        // Async helper for generator functions
        function asyncHelper(thisArg, _arguments, P, generator) {
            function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
            return new (P || (P = Promise))(function (resolve, reject) {
                function fulfilled(value) { try {
                    step(generator.next(value));
                }
                catch (e) {
                    reject(e);
                } }
                function rejected(value) { try {
                    step(generator["throw"](value));
                }
                catch (e) {
                    reject(e);
                } }
                function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
                step((generator = generator.apply(thisArg, _arguments || [])).next());
            });
        }
        // Mutex for async operations
        class Mutex {
            constructor() {
                this.mutex = Promise.resolve();
            }
            dispatch(task) {
                const self = this;
                return asyncHelper(this, undefined, undefined, function* () {
                    let releaseLock;
                    const lockPromise = new Promise((resolve) => {
                        releaseLock = resolve;
                    });
                    const currentMutex = self.mutex;
                    self.mutex = lockPromise;
                    yield currentMutex;
                    try {
                        return (yield Promise.resolve(task()));
                    }
                    finally {
                        releaseLock();
                    }
                });
            }
            lock() {
                const self = this;
                return asyncHelper(this, undefined, undefined, function* () {
                    let releaseLock;
                    const lockPromise = new Promise((resolve) => {
                        releaseLock = resolve;
                    });
                    const currentMutex = self.mutex;
                    self.mutex = lockPromise;
                    yield currentMutex;
                    return releaseLock;
                });
            }
        }
        // Utility functions
        utils.sleep = (durationMs) => {
            return new Promise((resolve) => {
                setTimeout(resolve, durationMs);
            });
        };
        utils.pickRandom = (array) => {
            return array[Math.floor(Math.random() * array.length)];
        };
        utils.createPromise = () => {
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
        };
        utils.is = {
            string: (value) => typeof value === 'string'
        };
        // Export utilities to global app
        // (utilities are already attached via proxied system)
        htosApp.Mutex = Mutex;
    })();
    // WASM SHA3 Hasher Implementation
    (() => {
        const { asyncHelper, Mutex } = htosApp;
        // Convert base64 to Uint8Array
        function base64ToUint8Array(base64) {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        }
        // Convert data to Uint8Array
        function toUint8Array(data) {
            if (typeof data === 'string') {
                return new TextEncoder().encode(data);
            }
            return data;
        }
        // Convert bytes to hex string
        function bytesToHexString(hexBuffer, bytes, length) {
            const hexChars = '0123456789abcdef';
            for (let i = 0; i < length; i++) {
                const byte = bytes[i];
                hexBuffer[i * 2] = hexChars.charCodeAt(byte >>> 4);
                hexBuffer[i * 2 + 1] = hexChars.charCodeAt(byte & 0x0f);
            }
            return String.fromCharCode(...hexBuffer.slice(0, length * 2));
        }
        const WASM_MEMORY_CHUNK_SIZE = 16384;
        const wasmMutex = new Mutex();
        const wasmModuleCache = new Map();
        function createWasmHasher(wasmConfig, hashLength) {
            return asyncHelper(undefined, undefined, undefined, function* () {
                let wasmInstance = null;
                let wasmMemoryView = null;
                let isInitialized = false;
                if (typeof WebAssembly === 'undefined') {
                    throw new Error('WebAssembly is not supported in this environment!');
                }
                const instantiatePromise = wasmMutex.dispatch(() => asyncHelper(undefined, undefined, undefined, function* () {
                    if (!wasmModuleCache.has(wasmConfig.name)) {
                        const wasmBinary = base64ToUint8Array(wasmConfig.data);
                        const compiledModule = (yield WebAssembly.compile(wasmBinary));
                        wasmModuleCache.set(wasmConfig.name, compiledModule);
                    }
                    const modulePromise = (yield wasmModuleCache.get(wasmConfig.name));
                    wasmInstance = (yield WebAssembly.instantiate(modulePromise, {}));
                }));
                const initHash = (seed = null) => {
                    isInitialized = true;
                    wasmInstance.exports.Hash_Init(seed);
                };
                const updateHash = (data) => {
                    if (!isInitialized) {
                        throw new Error('update() called before init()');
                    }
                    const dataBytes = toUint8Array(data);
                    let offset = 0;
                    while (offset < dataBytes.length) {
                        const chunk = dataBytes.subarray(offset, offset + WASM_MEMORY_CHUNK_SIZE);
                        offset += chunk.length;
                        wasmMemoryView.set(chunk);
                        wasmInstance.exports.Hash_Update(chunk.length);
                    }
                };
                const hexDigestBuffer = new Uint8Array(2 * hashLength);
                const digestHash = (format, finalData = null) => {
                    if (!isInitialized) {
                        throw new Error('digest() called before init()');
                    }
                    isInitialized = false;
                    wasmInstance.exports.Hash_Final(finalData);
                    return format === 'binary'
                        ? wasmMemoryView.slice(0, hashLength)
                        : bytesToHexString(hexDigestBuffer, wasmMemoryView, hashLength);
                };
                const isSmallData = (data) => typeof data === 'string'
                    ? data.length < 4096
                    : data.byteLength < WASM_MEMORY_CHUNK_SIZE;
                let canCalculateInOneShot = isSmallData;
                // Initialize WASM instance
                yield (() => asyncHelper(undefined, undefined, undefined, function* () {
                    if (!wasmInstance) {
                        yield instantiatePromise;
                    }
                    const bufferAddress = wasmInstance.exports.Hash_GetBuffer();
                    const memoryBuffer = wasmInstance.exports.memory.buffer;
                    wasmMemoryView = new Uint8Array(memoryBuffer, bufferAddress, WASM_MEMORY_CHUNK_SIZE);
                }))();
                return {
                    getMemory: () => wasmMemoryView,
                    writeMemory: (data, offset = 0) => {
                        wasmMemoryView.set(data, offset);
                    },
                    getExports: () => wasmInstance.exports,
                    init: initHash,
                    update: updateHash,
                    digest: digestHash,
                    calculate: (data, key = null, salt = null) => {
                        if (!canCalculateInOneShot(data)) {
                            initHash(key);
                            updateHash(data);
                            return digestHash('hex', salt);
                        }
                        const dataBytes = toUint8Array(data);
                        wasmMemoryView.set(dataBytes);
                        wasmInstance.exports.Hash_Calculate(dataBytes.length, key, salt);
                        return bytesToHexString(hexDigestBuffer, wasmMemoryView, hashLength);
                    },
                    hashLength: hashLength,
                };
            });
        }
        // SHA3 Configuration
        const sha3WasmConfig = {
            name: 'sha3',
            data: 'AGFzbQEAAAABFARgAAF/YAF/AGACf38AYAN/f38AAwgHAAEBAgEAAwUEAQECAgYOAn8BQZCNBQt/AEGACAsHcAgGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIAAAlIYXNoX0luaXQAAQtIYXNoX1VwZGF0ZQACCkhhc2hfRmluYWwABA1IYXNoX0dldFN0YXRlAAUOSGFzaF9DYWxjdWxhdGUABgpTVEFURV9TSVpFAwEKqBwHBQBBgAoL1wMAQQBCADcDgI0BQQBCADcD+IwBQQBCADcD8IwBQQBCADcD6IwBQQBCADcD4IwBQQBCADcD2IwBQQBCADcD0IwBQQBCADcDyIwBQQBCADcDwIwBQQBCADcDuIwBQQBCADcDsIwBQQBCADcDqIwBQQBCADcDoIwBQQBCADcDmIwBQQBCADcDkIwBQQBCADcDiIwBQQBCADcDgIwBQQBCADcD+IsBQQBCADcD8IsBQQBCADcD6IsBQQBCADcD4IsBQQBCADcD2IsBQQBCADcD0IsBQQBCADcDyIsBQQBCADcDwIsBQQBCADcDuIsBQQBCADcDsIsBQQBCADcDqIsBQQBCADcDoIsBQQBCADcDmIsBQQBCADcDkIsBQQBCADcDiIsBQQBCADcDgIsBQQBCADcD+IoBQQBCADcD8IoBQQBCADcD6IoBQQBCADcD4IoBQQBCADcD2IoBQQBCADcD0IoBQQBCADcDyIoBQQBCADcDwIoBQQBCADcDuIoBQQBCADcDsIoBQQBCADcDqIoBQQBCADcDoIoBQQBCADcDmIoBQQBCADcDkIoBQQBCADcDiIoBQQBCADcDgIoBQQBBwAwgAEEBdGtBA3Y2AoyNAUEAQQA2AoiNAQuMAwEIfwJAQQAoAoiNASIBQQBIDQBBACABIABqQQAoAoyNASICcDYCiI0BAkACQCABDQBBgAohAwwBCwJAIAIgAWsiBCAAIAQgAEkbIgNFDQAgA0EDcSEFQQAhBgJAIANBBEkNACABQYCKAWohByADQXxxIQhBACEGA0AgByAGaiIDQcgBaiAGQYAKai0AADoAACADQckBaiAGQYEKai0AADoAACADQcoBaiAGQYIKai0AADoAACADQcsBaiAGQYMKai0AADoAACAIIAZBBGoiBkcNAAsLIAVFDQAgAUHIiwFqIQMDQCADIAZqIAZBgApqLQAAOgAAIAZBAWohBiAFQX9qIgUNAAsLIAQgAEsNAUHIiwEgAhADIAAgBGshACAEQYAKaiEDCwJAIAAgAkkNAANAIAMgAhADIAMgAmohAyAAIAJrIgAgAk8NAAsLIABFDQBBACECQcgBIQYDQCAGQYCKAWogAyAGakG4fmotAAA6AAAgBkEBaiEGIAAgAkEBaiICQf8BcUsNAAsLC+QLAS1+IAApA0AhAkEAKQPAigEhAyAAKQM4IQRBACkDuIoBIQUgACkDMCEGQQApA7CKASEHIAApAyghCEEAKQOoigEhCSAAKQMgIQpBACkDoIoBIQsgACkDGCEMQQApA5iKASENIAApAxAhDkEAKQOQigEhDyAAKQMIIRBBACkDiIoBIREgACkDACESQQApA4CKASETQQApA8iKASEUAkACQCABQcgASw0AQQApA9CKASEVQQApA+CKASEWQQApA9iKASEXDAELQQApA+CKASAAKQNghSEWQQApA9iKASAAKQNYhSEXQQApA9CKASAAKQNQhSEVIBQgACkDSIUhFCABQekASQ0AQQBBACkD6IoBIAApA2iFNwPoigFBAEEAKQPwigEgACkDcIU3A/CKAUEAQQApA/iKASAAKQN4hTcD+IoBQQBBACkDgIsBIAApA4ABhTcDgIsBIAFBiQFJDQBBAEEAKQOIiwEgACkDiAGFNwOIiwELIAMgAoUhGCAFIASFIRkgByAGhSEHIAkgCIUhCCALIAqFIRogDSAMhSEJIA8gDoUhCiARIBCFIQsgEyAShSEMQQApA7iLASESQQApA5CLASETQQApA+iKASEbQQApA6CLASEcQQApA/iKASENQQApA7CLASEdQQApA4iLASEOQQApA8CLASEPQQApA5iLASEeQQApA/CKASEQQQApA6iLASERQQApA4CLASEfQcB+IQADQCAaIAcgC4UgF4UgH4UgEYVCAYmFIBSFIBCFIB6FIA+FIQIgDCAZIAqFIBaFIA6FIB2FQgGJhSAIhSAVhSANhSAchSIDIAeFISAgCSAIIAyFIBWFIA2FIByFQgGJhSAYhSAbhSAThSAShSIEIA+FISEgGCAKIBQgGoUgEIUgHoUgD4VCAYmFIBmFIBaFIA6FIB2FIgWFQjeJIiIgCyAYIAmFIBuFIBOFIBKFQgGJhSAHhSAXhSAfhSARhSIGIAqFQj6JIiNCf4WDIAMgEYVCAokiJIUhDyANIAKFQimJIiUgBCAQhUIniSImQn+FgyAihSERIBIgBYVCOIkiEiAGIA6FQg+JIidCf4WDIAMgF4VCCokiKIUhDiAEIBqFQhuJIikgKCAIIAKFQiSJIipCf4WDhSENIAYgGYVCBokiKyADIAuFQgGJIixCf4WDIBwgAoVCEokiLYUhECArIAQgHoVCCIkiLiAbIAWFQhmJIhtCf4WDhSEXIAYgHYVCPYkiGSAEIBSFQhSJIgQgCSAFhUIciSIIQn+Fg4UhFCAIIBlCf4WDIAMgH4VCLYkiA4UhGCAZIANCf4WDIBSgAoVCA4kiCYUhGSAEIAMgCUJ/hYOFIQcgCSAEQn+FgyAIhSEIIAwgAoUiAiAhQg6JIgNCf4WDIBMgBYVCFYkiBIUhCSAGIBaFQiuJIgUgAyAEQn+Fg4UhCiAEIAVCf4WDICBCLIkiBIUhCyAAQdAJaikDACAFIARCf4WDhSAChSEMICcgKEJ/hYMgKoUiBSEfIAMgBCACQn+Fg4UiAiEaICogKUJ/hYMgEoUiAyEeIC0gLkJ/hYMgG4UiBCEWICYgJCAlQn+Fg4UiBiEdIBsgK0J/hYMgLIUiKCEVICMgJiAiQn+Fg4UiIiEcIC4gLCAtQn+Fg4UiJiEbICcgKSASQn+Fg4UiJyETICMgJEJ/hYMgJYUiIyESIABBCGoiAA0AC0EAIBE3A6iLAUEAIAU3A4CLAUEAIBc3A9iKAUEAIAc3A7CKAUEAIAs3A4iKAUEAIA83A8CLAUEAIAM3A5iLAUEAIBA3A/CKAUEAIBQ3A8iKAUEAIAI3A6CKAUEAIAY3A7CLAUEAIA43A4iLAUEAIAQ3A+CKAUEAIBk3A7iKAUEAIAo3A5CKAUEAICI3A6CLAUEAIA03A/iKAUEAICg3A9CKAUEAIAg3A6iKAUEAIAw3A4CKAUEAICM3A7iLAUEAICc3A5CLAUEAICY3A+iKAUEAIBg3A8CKAUEAIAk3A5iKAQv4AgEFf0HkAEEAKAKMjQEiAUEBdmshAgJAQQAoAoiNASIDQQBIDQAgASEEAkAgASADRg0AIANByIsBaiEFQQAhAwNAIAUgA2pBADoAACADQQFqIgMgAUEAKAKIjQEiBGtJDQALCyAEQciLAWoiAyADLQAAIAByOgAAIAFBx4sBaiIDIAMtAABBgAFyOgAAQciLASABEANBAEGAgICAeDYCiI0BCwJAIAJBBEkNACACQQJ2IgNBA3EhBUEAIQQCQCADQX9qQQNJDQAgA0H8////A3EhAUEAIQNBACEEA0AgA0GACmogA0GAigFqKAIANgIAIANBhApqIANBhIoBaigCADYCACADQYgKaiADQYiKAWooAgA2AgAgA0GMCmogA0GMigFqKAIANgIAIANBEGohAyABIARBBGoiBEcNAAsLIAVFDQAgBUECdCEBIARBAnQhAwNAIANBgApqIANBgIoBaigCADYCACADQQRqIQMgAUF8aiIBDQALCwsGAEGAigEL0QYBA39BAEIANwOAjQFBAEIANwP4jAFBAEIANwPwjAFBAEIANwPojAFBAEIANwPgjAFBAEIANwPYjAFBAEIANwPQjAFBAEIANwPIjAFBAEIANwPAjAFBAEIANwO4jAFBAEIANwOwjAFBAEIANwOojAFBAEIANwOgjAFBAEIANwOYjAFBAEIANwOQjAFBAEIANwOIjAFBAEIANwOAjAFBAEIANwPiwFBAEIANwPwiwFBAEIANwPoiwFBAEIANwPgiwFBAEIANwPYiwFBAEIANwPQiwFBAEIANwPIiwFBAEIANwPAiwFBAEIANwO4iwFBAEIANwOwiwFBAEIANwOoiwFBAEIANwOgiwFBAEIANwOYiwFBAEIANwOQiwFBAEIANwOIiwFBAEIANwOAiwFBAEIANwP4igFBAEIANwPwigFBAEIANwPoigFBAEIANwPgigFBAEIANwPYigFBAEIANwPQigFBAEIANwPIigFBAEIANwPAigFBAEIANwO4igFBAEIANwOwigFBAEIANwOoigFBAEIANwOgigFBAEIANwOYigFBAEIANwOQigFBAEIANwOIigFBAEIANwOAigFBAEHADCABQQF0a0EDdjYCjI0BQQBBADYCiI0BIAAQAkHkAEEAKAKMjQEiAEEBdmshAwJAQQAoAoiNASIBQQBIDQAgACEEAkAgACABRg0AIAFByIsBaiEFQQAhAQNAIAUgAWpBADoAACABQQFqIgEgAEEAKAKIjQEiBGtJDQALCyAEQciLAWoiASABLQAAIAJyOgAAIABBx4sBaiIBIAEtAABBgAFyOgAAQciLASAAEANBAEGAgICAeDYCiI0BCwJAIANBBEkNACADQQJ2IgFBA3EhBUEAIQQCQCABQX9qQQNJDQAgAUH8////A3EhAEEAIQFBACEEA0AgAUGACmogAUGAigFqKAIANgIAIAFBhApqIAFBhIoBaigCADYCACABQYgKaiABQYiKAWooAgA2AgAgAUGMCmogAUGMigFqKAIANgIAIAFBEGohASAAIARBBGoiBEcNAAsLIAVFDQAgBUECdCEAIARBAnQhAQNAIAFBgApqIAFBgIoBaigCADYCACABQQRqIQEgAEF8aiIADQALCwsL2AEBAEGACAvQAZABAAAAAAAAAAAAAAAAAAABAAAAAAAAAIKAAAAAAAAAioAAAAAAAIAAgACAAAAAgIuAAAAAAAAAAQAAgAAAAACBgACAAAAAgAmAAAAAAACAigAAAAAAAACIAAAAAAAAAAmAAIAAAAAACgAAgAAAAACLgACAAAAAAIsAAAAAAACAiYAAAAAAAIADgAAAAAAAgAKAAAAAAACAgAAAAAAAAIAKgAAAAAAAAAoAAIAAAACAgYAAgAAAAICAgAAAAAAAgAEAAIAAAAAACIAAgAAAAIA=',
            hash: 'f2f6f5b2',
        };
        const sha3Mutex = new Mutex();
        let sha3Hasher = null;
        function validateSha3Variant(variant) {
            return [224, 256, 384, 512].includes(variant)
                ? null
                : new Error('Invalid variant! Valid values: 224, 256, 384, 512');
        }
        // SHA3 WASM Hasher with streaming support
        htosApp.$hashWasm = {
            sha3: async (data, variant = 512) => {
                const error = validateSha3Variant(variant);
                if (error)
                    throw error;
                return sha3Mutex.dispatch(async () => {
                    if (!sha3Hasher) {
                        sha3Hasher = await createWasmHasher(sha3WasmConfig, variant / 8);
                    }
                    const inputData = toUint8Array(data);
                    const hashBytes = await sha3Hasher.hash(inputData);
                    // Convert to hex string
                    const hexBuffer = new Uint8Array(hashBytes.length * 2);
                    return bytesToHexString(hexBuffer, hashBytes, hashBytes.length);
                });
            },
            // Streaming hasher API for resume-after-crash logic
            createStreamingHasher: createWasmHasher,
            // Memory management
            setMemorySize: (size) => {
                // Implementation would interface with WASM Hash_SetMemorySize
                console.log('[HTOS] Setting WASM memory size:', size);
            },
            // State save/load for crash recovery (HARPA parity)
            saveState: () => {
                // Implementation would interface with WASM Hash_Save
                console.log('[HTOS] Saving hasher state');
                return null; // Placeholder
            },
            loadState: (state) => {
                // Implementation would interface with WASM Hash_Load
                console.log('[HTOS] Loading hasher state:', state);
            }
        };
    })();
    // Challenge Solver Implementation
    (() => {
        const { $utils: utils, $hashWasm: hashWasm } = htosApp;
        htosApp.$ai = {
            challengeSolver: {
                async generateProofToken({ seed, difficulty, scripts = [], dpl = null, }) {
                    const dataToBase64 = (data) => {
                        const jsonString = JSON.stringify(data);
                        return btoa(String.fromCharCode(...new TextEncoder().encode(jsonString)));
                    };
                    const startTime = performance.now();
                    const navigatorKeys = Object.keys(Object.getPrototypeOf(navigator));
                    const randomNavProperty = utils.pickRandom(navigatorKeys);
                    const proofData = [
                        navigator.hardwareConcurrency + screen.width + screen.height,
                        new Date().toString(),
                        performance.memory?.jsHeapSizeLimit || 0,
                        Math.random(),
                        navigator.userAgent,
                        utils.pickRandom(scripts.length > 0 ? scripts : ['default']),
                        dpl,
                        navigator.language,
                        navigator.languages.join(','),
                        Math.random(),
                        `${randomNavProperty}-${navigator[randomNavProperty]}`,
                        utils.pickRandom(Object.keys(document)),
                        utils.pickRandom(Object.keys(window)),
                        performance.now(),
                        crypto.randomUUID(),
                    ];
                    for (let nonce = 1; nonce < 100000; nonce++) {
                        // Yield control periodically
                        if (nonce % 1000 === 0) {
                            await utils.sleep(150);
                        }
                        proofData[3] = nonce;
                        proofData[9] = Math.round(performance.now() - startTime);
                        const proofTokenAttempt = dataToBase64(proofData);
                        const hash = await hashWasm.sha3(`${seed}${proofTokenAttempt}`);
                        if (hash.substring(0, difficulty.length) <= difficulty) {
                            return proofTokenAttempt;
                        }
                    }
                    return null;
                },
            },
            // Load Arkose SDK script (HARPA parity)
            _loadArkoseScript: async (config) => {
                try {
                    const script = document.createElement('script');
                    // Set script attributes from config
                    if (config.script) {
                        Object.entries(config.script).forEach(([key, value]) => {
                            script.setAttribute(key, value);
                        });
                    }
                    // Set common Arkose attributes
                    if (config.siteKey)
                        script.setAttribute('data-site-key', config.siteKey);
                    if (config.src)
                        script.src = config.src;
                    document.head.appendChild(script);
                    // Wait for script to load
                    await new Promise((resolve, reject) => {
                        script.onload = resolve;
                        script.onerror = reject;
                        setTimeout(() => reject(new Error('Timeout')), 10000); // 10s timeout
                    });
                    console.log('[HTOS] Arkose SDK loaded successfully');
                }
                catch (error) {
                    throw { code: 'ARKOSE_SDK_LOAD_FAILED', message: `Failed to load Arkose SDK: ${error}` };
                }
            },
            // Patch Arkose iframe with monkey-patch (HARPA parity)
            _patchArkoseIframe: (config) => {
                console.log('[HTOS] Patching Arkose iframe...', { config });
                // Monkey-patch HTMLElement.appendChild to set iframe name
                const originalAppend = HTMLElement.prototype.appendChild;
                HTMLElement.prototype.appendChild = function (node) {
                    if (node instanceof HTMLIFrameElement && node.src.includes('arkose')) {
                        node.setAttribute('name', `ae:${JSON.stringify(config)}`);
                    }
                    return originalAppend.call(this, node);
                };
                console.log('[HTOS] Arkose iframe monkey-patch applied');
            },
            // Structured error factory (HARPA parity)
            _createError: (code, message) => {
                return { code, message };
            },
            // Token retry logic with first-time flag (HARPA parity)
            _firstTimeFetchToken: true,
            // Ensure Arkose setup with retry logic
            _ensureSetup: async (config, accessToken) => {
                try {
                    console.log('[HTOS] Ensuring Arkose setup...', { config });
                    // Load SDK if not already loaded
                    if (!window.arkose) {
                        await ai.arkose._loadArkoseScript(config);
                    }
                    // Apply iframe patches
                    ai.arkose._patchArkoseIframe(config);
                    return true;
                }
                catch (error) {
                    throw ai.arkose._createError('ARKOSE_SETUP_FAILED', `Setup failed: ${error}`);
                }
            },
            // Retrieve Arkose token with timeout
            _retrieveArkoseToken: async ({ dx, config, accessToken }) => {
                try {
                    console.log('[HTOS] Retrieving Arkose token...', { dx, config });
                    // Ensure setup first
                    await ai.arkose._ensureSetup(config, accessToken);
                    // Use first-time flag for run() vs reset()
                    const method = ai.arkose._firstTimeFetchToken ? 'run' : 'reset';
                    ai.arkose._firstTimeFetchToken = false;
                    // Timeout from config
                    const timeout = config.tokenFetchTimeout || 30000;
                    return await Promise.race([
                        new Promise((resolve) => {
                            // Arkose token retrieval logic would go here
                            setTimeout(() => resolve(null), 1000); // Placeholder
                        }),
                        new Promise((_, reject) => {
                            setTimeout(() => reject(ai.arkose._createError('POW_TIMEOUT', 'Token fetching timed out')), timeout);
                        })
                    ]);
                }
                catch (error) {
                    throw ai.arkose._createError('ARKOSE_TOKEN_FAILED', `Token retrieval failed: ${error}`);
                }
            }
        };
    })();
    // Message Bus Implementation
    (() => {
        htosApp.$bus = {
            handlers: new Map(),
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
            async call(event, data) {
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error(`Bus call timeout for event: ${event}`));
                    }, 30000);
                    this.emit(event, {
                        ...data,
                        _resolve: (result) => {
                            clearTimeout(timeout);
                            resolve(result);
                        },
                        _reject: (error) => {
                            clearTimeout(timeout);
                            reject(error);
                        },
                    });
                });
            },
        };
    })();
    // Initialize iframe communication
    (() => {
        const { $bus: bus, $ai: ai, $hashWasm: hashWasm } = htosApp;
        // Handle messages from parent (offscreen host)
        window.addEventListener('message', async (event) => {
            if (event.source !== window.parent)
                return;
            const { type, id, payload } = event.data;
            try {
                let result;
                switch (type) {
                    case 'htos.pow.sha3':
                        result = await hashWasm.sha3(payload.data, payload.variant);
                        break;
                    case 'htos.pow.challenge':
                        result = await ai.challengeSolver.generateProofToken(payload);
                        break;
                    case 'htos.arkose.solve':
                        // HTOS-PILLAR-CHECK: Arkose solver using HARPA pattern
                        result = await ai.challengeSolver.generateProofToken({
                            seed: payload.seed,
                            difficulty: payload.difficulty,
                            scripts: payload.scripts || ['window.navigator.userAgent', 'window.screen.width']
                        });
                        result = `arkose-${result}`;
                        break;
                    case 'htos.pow.ping':
                        result = { status: 'ok', timestamp: Date.now() };
                        break;
                    default:
                        throw new Error(`Unknown message type: ${type}`);
                }
                // Send response back to parent
                window.parent.postMessage({
                    type: 'htos.pow.response',
                    id,
                    ok: true,
                    data: result,
                }, '*');
            }
            catch (error) {
                // Send error response back to parent
                window.parent.postMessage({
                    type: 'htos.pow.response',
                    id,
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                }, '*');
            }
        });
        // Signal that iframe is ready
        window.parent.postMessage({
            type: 'htos.pow.ready',
            timestamp: Date.now(),
        }, '*');
        console.log('HTOS PoW iframe initialized');
    })();

})();
