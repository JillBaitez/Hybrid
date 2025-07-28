/**
 * HTOS Proof-of-Work (PoW) Iframe Engine
 * 
 * This iframe hosts the WASM SHA3 engine and implements challenge solving
 * for provider authentication. Ported from HARPA's oi.js with HTOS adaptations.
 * 
 * Architecture:
 * - Self-contained WASM SHA3 hasher (Tier 3 module)
 * - Generic proof-of-work challenge solver
 * - Message bus integration for offscreen communication
 */

// Initialize HTOS iframe application
window.htosApp = {
  $utils: {},
  $hashWasm: {},
  $ai: {},
  $bus: {},
  $env: { getLocus: () => 'oi' }
};

const htosApp = window.htosApp;

// Utility functions
(() => {
  const utils = htosApp.$utils;

  // Async helper for generator functions
  function asyncHelper(thisArg: any, _arguments: any, P: any, generator: any) {
    function adopt(value: any) { return value instanceof P ? value : new P(function (resolve: any) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve: any, reject: any) {
      function fulfilled(value: any) { try { step(generator.next(value)); } catch (e) { reject(e); } }
      function rejected(value: any) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
      function step(result: any) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  }

  // Mutex for async operations
  class Mutex {
    private mutex = Promise.resolve();

    dispatch<T>(task: () => Promise<T>): Promise<T> {
      const self = this;
      return asyncHelper(this, undefined, undefined, function* (): Generator<Promise<void> | Promise<T>, T, unknown> {
        let releaseLock: () => void;
        const lockPromise = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        
        const currentMutex = self.mutex;
        self.mutex = lockPromise;
        
        yield currentMutex;
        try {
          return (yield Promise.resolve(task())) as T;
        } finally {
          releaseLock!();
        }
      });
    }

    lock(): Promise<() => void> {
      const self = this;
      return asyncHelper(this, undefined, undefined, function* (): Generator<Promise<void>, () => void, unknown> {
        let releaseLock: () => void;
        const lockPromise = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        
        const currentMutex = self.mutex;
        self.mutex = lockPromise;
        
        yield currentMutex;
        return releaseLock!;
      });
    }
  }

  // Utility functions
  utils.sleep = (durationMs: number): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  };

  utils.pickRandom = (array: any[]): any => {
    return array[Math.floor(Math.random() * array.length)];
  };

  utils.createPromise = () => {
    let resolve: (value?: any) => void;
    let reject: (reason?: any) => void;
    
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
    
    return promise as Promise<any> & { resolve: (value?: any) => void; reject: (reason?: any) => void };
  };

  utils.is = {
    string: (value: any): value is string => typeof value === 'string'
  };

  // Export utilities
  htosApp.$utils = utils;
  htosApp.asyncHelper = asyncHelper;
  htosApp.Mutex = Mutex;
})();

// WASM SHA3 Hasher Implementation
(() => {
  const { asyncHelper, Mutex } = htosApp;

  // Convert base64 to Uint8Array
  function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Convert data to Uint8Array
  function toUint8Array(data: string | Uint8Array): Uint8Array {
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    return data;
  }

  // Convert bytes to hex string
  function bytesToHexString(hexBuffer: Uint8Array, bytes: Uint8Array, length: number): string {
    const hexChars = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
      const byte = bytes[i];
      hexBuffer[i * 2] = hexChars.charCodeAt(byte >>> 4);
      hexBuffer[i * 2 + 1] = hexChars.charCodeAt(byte & 0x0f);
    }
    return String.fromCharCode(...hexBuffer.slice(0, length * 2));
  }

  // Pack bytes utility
  function packBytes(char1: number, char2: number): number {
    return (char1 << 8) | char2;
  }

  const WASM_MEMORY_CHUNK_SIZE = 16384;
  const wasmMutex = new Mutex();
  const wasmModuleCache = new Map<string, WebAssembly.Module>();

  function createWasmHasher(wasmConfig: any, hashLength: number): Promise<any> {
    return asyncHelper(undefined, undefined, undefined, function* (): Generator<Promise<void> | WebAssembly.Module | WebAssembly.Instance, any, unknown> {
      let wasmInstance: WebAssembly.Instance | null = null;
      let wasmMemoryView: Uint8Array | null = null;
      let isInitialized = false;

      if (typeof WebAssembly === 'undefined') {
        throw new Error('WebAssembly is not supported in this environment!');
      }

      const getStateSize = () =>
        new DataView((wasmInstance!.exports.memory as WebAssembly.Memory).buffer).getUint32(
          (wasmInstance!.exports as any).STATE_SIZE,
          true
        );

      const instantiatePromise = wasmMutex.dispatch(() =>
        asyncHelper(undefined, undefined, undefined, function* (): Generator<WebAssembly.Module | WebAssembly.Instance, void, unknown> {
          if (!wasmModuleCache.has(wasmConfig.name)) {
            const wasmBinary = base64ToUint8Array(wasmConfig.data);
            const compiledModule = (yield WebAssembly.compile(wasmBinary)) as WebAssembly.Module;
            wasmModuleCache.set(wasmConfig.name, compiledModule);
          }
          const modulePromise = (yield wasmModuleCache.get(wasmConfig.name)!) as WebAssembly.Module;
          wasmInstance = (yield WebAssembly.instantiate(modulePromise, {})) as WebAssembly.Instance;
        })
      );

      const initHash = (seed: any = null) => {
        isInitialized = true;
        (wasmInstance!.exports as any).Hash_Init(seed);
      };

      const updateHash = (data: string | Uint8Array) => {
        if (!isInitialized) {
          throw new Error('update() called before init()');
        }
        
        const dataBytes = toUint8Array(data);
        let offset = 0;
        
        while (offset < dataBytes.length) {
          const chunk = dataBytes.subarray(offset, offset + WASM_MEMORY_CHUNK_SIZE);
          offset += chunk.length;
          wasmMemoryView!.set(chunk);
          (wasmInstance!.exports as any).Hash_Update(chunk.length);
        }
      };

      const hexDigestBuffer = new Uint8Array(2 * hashLength);
      
      const digestHash = (format: string, finalData: any = null) => {
        if (!isInitialized) {
          throw new Error('digest() called before init()');
        }
        
        isInitialized = false;
        (wasmInstance!.exports as any).Hash_Final(finalData);
        
        return format === 'binary'
          ? wasmMemoryView!.slice(0, hashLength)
          : bytesToHexString(hexDigestBuffer, wasmMemoryView!, hashLength);
      };

      const isSmallData = (data: string | Uint8Array) =>
        typeof data === 'string'
          ? data.length < 4096
          : data.byteLength < WASM_MEMORY_CHUNK_SIZE;

      let canCalculateInOneShot = isSmallData;

      // Initialize WASM instance
      yield (() =>
        asyncHelper(undefined, undefined, undefined, function* (): Generator<Promise<void>, void, unknown> {
          if (!wasmInstance) {
            yield instantiatePromise;
          }
          
          const bufferAddress = (wasmInstance!.exports as any).Hash_GetBuffer();
          const memoryBuffer = (wasmInstance!.exports.memory as WebAssembly.Memory).buffer;
          wasmMemoryView = new Uint8Array(
            memoryBuffer,
            bufferAddress,
            WASM_MEMORY_CHUNK_SIZE
          );
        })
      )();

      return {
        getMemory: () => wasmMemoryView,
        writeMemory: (data: Uint8Array, offset = 0) => {
          wasmMemoryView!.set(data, offset);
        },
        getExports: () => wasmInstance!.exports,
        init: initHash,
        update: updateHash,
        digest: digestHash,
        calculate: (data: string | Uint8Array, key: any = null, salt: any = null) => {
          if (!canCalculateInOneShot(data)) {
            initHash(key);
            updateHash(data);
            return digestHash('hex', salt);
          }
          
          const dataBytes = toUint8Array(data);
          wasmMemoryView!.set(dataBytes);
          (wasmInstance!.exports as any).Hash_Calculate(dataBytes.length, key, salt);
          return bytesToHexString(hexDigestBuffer, wasmMemoryView!, hashLength);
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
  let sha3Hasher: any = null;

  function validateSha3Variant(variant: number): Error | null {
    return [224, 256, 384, 512].includes(variant)
      ? null
      : new Error('Invalid variant! Valid values: 224, 256, 384, 512');
  }

  // SHA3 WASM Hasher
  htosApp.$hashWasm = {
    sha3: function (data: string | Uint8Array, variant = 512): Promise<string> {
      const validationError = validateSha3Variant(variant);
      if (validationError) {
        return Promise.reject(validationError);
      }

      const hashLengthBytes = variant / 8;

      if (sha3Hasher === null || sha3Hasher.hashLength !== hashLengthBytes) {
        return (function (mutex: any, wasmConfig: any, hashLength: number) {
          return asyncHelper(undefined, undefined, undefined, function* (): Generator<Promise<() => void> | any, any, unknown> {
            const releaseLock: any = yield mutex.lock();
            try {
              const hasherInstance: any = yield createWasmHasher(wasmConfig, hashLength);
              return hasherInstance;
            } finally {
              releaseLock();
            }
          });
        })(sha3Mutex, sha3WasmConfig, hashLengthBytes).then((hasher: any) => {
          sha3Hasher = hasher;
          return hasher.calculate(data, variant, 6);
        });
      }

      try {
        const result = sha3Hasher.calculate(data, variant, 6);
        return Promise.resolve(result);
      } catch (error) {
        return Promise.reject(error);
      }
    },
  };
})();

// Challenge Solver Implementation
(() => {
  const { $utils: utils, $hashWasm: hashWasm } = htosApp;

  htosApp.$ai = {
    challengeSolver: {
      async generateProofToken({
        seed,
        difficulty,
        scripts = [],
        dpl = null,
      }: {
        seed: string;
        difficulty: string;
        scripts?: string[];
        dpl?: any;
      }): Promise<string | null> {
        const dataToBase64 = (data: any[]): string => {
          const jsonString = JSON.stringify(data);
          return btoa(String.fromCharCode(...new TextEncoder().encode(jsonString)));
        };

        const startTime = performance.now();
        const navigatorKeys = Object.keys(Object.getPrototypeOf(navigator));
        const randomNavProperty = utils.pickRandom(navigatorKeys);

        const proofData = [
          navigator.hardwareConcurrency + screen.width + screen.height,
          new Date().toString(),
          (performance as any).memory?.jsHeapSizeLimit || 0,
          Math.random(),
          navigator.userAgent,
          utils.pickRandom(scripts.length > 0 ? scripts : ['default']),
          dpl,
          navigator.language,
          navigator.languages.join(','),
          Math.random(),
          `${randomNavProperty}-${(navigator as any)[randomNavProperty]}`,
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
  };
})();

// Message Bus Implementation
(() => {
  const { $utils: utils } = htosApp;

  htosApp.$bus = {
    handlers: new Map<string, Function[]>(),

    on(event: string, handler: Function) {
      if (!this.handlers.has(event)) {
        this.handlers.set(event, []);
      }
      this.handlers.get(event)!.push(handler);
    },

    off(event: string, handler: Function) {
      const handlers = this.handlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    },

    emit(event: string, data: any) {
      const handlers = this.handlers.get(event);
      if (handlers) {
        handlers.forEach((handler: Function) => {
          try {
            handler(data);
          } catch (error) {
            console.error(`Error in event handler for ${event}:`, error);
          }
        });
      }
    },

    async call(event: string, data: any): Promise<any> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Bus call timeout for event: ${event}`));
        }, 30000);

        this.emit(event, {
          ...data,
          _resolve: (result: any) => {
            clearTimeout(timeout);
            resolve(result);
          },
          _reject: (error: any) => {
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
    if (event.source !== window.parent) return;

    const { type, id, payload } = event.data;

    try {
      let result: any;

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

    } catch (error) {
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