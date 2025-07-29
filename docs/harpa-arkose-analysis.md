# HARPA Arkose & Offscreen Architecture Analysis

## Executive Summary

This report analyzes HARPA's Arkose puzzle solver (`oi.js`) and offscreen controller (`os.js`) files to understand their architecture and plan modularization for integration into the HTOS system. The analysis reveals sophisticated but monolithic files that can be decomposed into discrete, reusable modules following HARPA's architectural principles.

## Files Analyzed

### 1. `oi.js` - Arkose Solver Core (~1,200 lines)
**Primary Purpose**: Arkose puzzle solving, proof-of-work token generation, iframe management
**Context**: Runs in offscreen iframe for sandboxed computations

### 2. `oicontent.js` - Duplicate Content (~1,200 lines)  
**Primary Purpose**: Identical copy of `oi.js`
**Context**: Appears to be a backup or alternative deployment of the same logic

### 3. `os.js` - Offscreen Controller (~1,500 lines)
**Primary Purpose**: Offscreen document management, file processing, WebSocket grid, utilities
**Context**: Runs in extension's offscreen document context

## Architectural Patterns Identified

### 1. Global Proxied App System
Both files implement a sophisticated global object system:
```javascript
const proxiedApp = createProxiedModule(appConfig);
globalThis[appGlobalKey] = proxiedApp;
```

**Key Features**:
- Dynamic module creation via Proxy
- Namespace isolation (`$utils`, `$bus`, `$ai`, etc.)
- Lazy loading with caching
- Development mode exposure to global scope
- Consistent logging per module

**Modularization Priority**: **Tier 1 (Core Infrastructure)**
- Extract to `src/core/global-app.ts`
- Unify between oi.js and os.js implementations
- Add TypeScript interfaces for module contracts

### 2. WASM-Based Cryptographic Hashing
Self-contained SHA3 implementation using WebAssembly:
```javascript
const sha3WasmConfig = {
  name: 'sha3',
  data: 'AGFzbQEAAAABFARgAAF/YAF/AGACf38AYAN/f38AAwgHAAEBAgEAAwUEAQECAgYOAn8BQZCNBQt/AEGACAsHcAgGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIAAAlIYXNoX0luaXQAAQtIYXNoX1VwZGF0ZQACCkhhc2hfRmluYWwABA1IYXNoX0dldFN0YXRlAAUOSGFzaF9DYWxjdWxhdGUABgpTVEFURV9TSVpFAwEKqBwHBQBBgAoL...',
  hash: 'f2f6f5b2'
};
```

**Key Features**:
- Complete WASM module with memory management
- Mutex-protected concurrent access
- Support for multiple hash variants (SHA3-256, SHA3-512)
- Efficient byte array processing

**Modularization Priority**: **Tier 1 (Standalone Utility)**
- Extract to `src/crypto/wasm-hasher.ts`
- Add TypeScript interfaces for hash operations
- Implement as singleton with proper lifecycle management

### 3. Arkose Token Generation Logic
Core puzzle-solving functionality:
```javascript
ai.arkose = {
  init(),
  _retrieveArkoseToken({ dx, config, accessToken }),
  _generateProofToken({ seed, difficulty, scripts, dpl }),
  _ensureSetup(config, accessToken),
  _patchArkoseIframe(config)
};
```

**Key Features**:
- Proof-of-work challenge solving
- Dynamic iframe creation and patching
- Token retrieval and validation
- Integration with WASM hasher for computations

**Modularization Priority**: **Tier 2 (Domain Logic)**
- Extract to `src/arkose/solver.ts`
- Separate iframe management to `src/arkose/iframe-controller.ts`
- Create interfaces for token operations

### 4. Cross-Context Bus Communication
Complex message routing system:
```javascript
bus = {
  init(), send(), call(), poll(),
  _sendToExt(), _sendToCs(), _sendToPage(), _sendToIframe(), _sendToParent(),
  _serialize(), _deserialize(), _callHandlers()
};
```

**Key Features**:
- Multi-context routing (popup, background, content script, offscreen, iframe)
- Blob serialization/deserialization
- Error handling and retry logic
- Proxy pattern for event delegation

**Modularization Priority**: **Tier 1 (Core Infrastructure)**
- Extract to `src/bus/cross-context-router.ts`
- Unify with existing HTOS BroadcastChannel bus
- Add TypeScript interfaces for message contracts

### 5. Utility Functions (Shared Between Files)
Extensive utility collections with significant overlap:

**Type Checking** (`utils.is`):
```javascript
utils.is = { null, defined, undefined, boolean, number, string, array, object, ... }
```

**Object URL Management** (`utils.objectUrl`):
```javascript
utils.objectUrl = { create(object, autoRevokeTimeout), revoke(objectUrl) }
```

**Promise Utilities** (`utils.promise`):
```javascript
utils.promise = { createPromise(), waitFor(conditionFn, options) }
```

**Modularization Priority**: **Tier 1 (Shared Utilities)**
- Extract to `src/utils/` directory with individual files
- Eliminate duplication between oi.js and os.js
- Add comprehensive TypeScript types

### 6. File Processing Controllers (os.js specific)
Domain-specific file handling:
```javascript
engine.docController = { _docxToText(file), _readDocx(file) };
engine.pdfController = { _pdfToText(file), _readPdf(file) };
engine.xlsController = { _xlsxToText(file), _readXls(file) };
```

**Modularization Priority**: **Tier 3 (Optional Features)**
- Extract to `src/file-processors/` if needed
- Consider as separate optional modules
- Heavy dependencies (PDF.js, Mammoth, SheetJS)

### 7. WebSocket Grid System (os.js specific)
Real-time communication infrastructure:
```javascript
grid.controller = {
  connect({ channels, jwt, uuid }),
  send(message),
  reconnect(params, delay),
  createWebSocket(params, reconnectDelay)
};
```

**Modularization Priority**: **Tier 2 (Feature Module)**
- Extract to `src/grid/websocket-controller.ts`
- Evaluate necessity for HTOS core functionality

## Proposed Module Structure

### Tier 1: Core Infrastructure (Required)
```
src/core/
├── global-app.ts           # Unified proxied app system
├── logging.ts              # Centralized logging utilities
└── lifecycle.ts            # Module initialization coordination

src/bus/
├── cross-context-router.ts # Unified message routing
├── serialization.ts        # Blob and error serialization
└── message-types.ts        # TypeScript message interfaces

src/utils/
├── type-checking.ts        # utils.is functions
├── object-url.ts           # Object URL management
├── promise.ts              # Promise utilities
├── time.ts                 # Time formatting and utilities
├── id-generation.ts        # Nanoid and UUID generation
└── storage.ts              # localStorage wrapper

src/crypto/
└── wasm-hasher.ts          # SHA3 WASM implementation
```

### Tier 2: Domain Logic (Core Features)
```
src/arkose/
├── solver.ts               # Main Arkose puzzle solving logic
├── iframe-controller.ts    # Iframe creation and management
├── token-manager.ts        # Token retrieval and validation
└── proof-generator.ts      # Proof-of-work computation
```

### Tier 3: Optional Features (Evaluate Necessity)
```
src/file-processors/        # Document processing (PDF, DOCX, XLS)
src/grid/                   # WebSocket grid system
src/audio/                  # Speech synthesis utilities
src/image/                  # Image manipulation utilities
```

## Integration Strategy

### Phase 1: Core Infrastructure
1. **Extract Global App System**
   - Unify `oi.js` and `os.js` global app implementations
   - Create TypeScript interfaces for module contracts
   - Implement in `src/core/global-app.ts`

2. **Unify Bus Systems**
   - Merge HARPA's cross-context router with HTOS BroadcastChannel bus
   - Preserve serialization capabilities for blobs and errors
   - Maintain compatibility with existing message patterns

3. **Consolidate Utilities**
   - Extract shared utilities from both files
   - Eliminate code duplication
   - Add comprehensive TypeScript types

### Phase 2: Arkose Integration
1. **Extract WASM Hasher**
   - Create standalone crypto module
   - Implement proper lifecycle management
   - Add TypeScript interfaces

2. **Modularize Arkose Solver**
   - Separate concerns (solving, iframe management, token handling)
   - Integrate with HTOS bus system
   - Maintain compatibility with existing Arkose challenges

### Phase 3: Optional Features
1. **Evaluate Feature Necessity**
   - Assess which os.js features are needed for HTOS
   - Consider file processing, WebSocket grid, audio, image utilities
   - Implement only required features

## Code Quality Improvements

### TypeScript Migration
- Add comprehensive type definitions for all modules
- Create interfaces for cross-module contracts
- Implement strict type checking

### Security Enhancements
- Audit WASM module for security vulnerabilities
- Implement proper CSP compliance for iframe operations
- Add input validation for all external data

### Performance Optimizations
- Implement lazy loading for heavy dependencies
- Add micro-benchmarks for critical paths
- Optimize WASM memory management

### Testing Strategy
- Unit tests for all utility functions
- Integration tests for Arkose solving workflow
- Mock external dependencies (Arkose API, file processing libraries)

## Compatibility Considerations

### HARPA Immutables Compliance
- **SW-only Token Authority**: Maintain token management in service worker
- **DNR-before-JS**: Ensure CSP rules are registered before script execution
- **Singleton Offscreen**: Preserve single offscreen document pattern

### Existing HTOS Integration
- Maintain compatibility with current bus architecture
- Preserve existing provider adapter interfaces
- Ensure smooth migration path from current implementation

## Conclusion

The HARPA Arkose and offscreen files contain sophisticated but monolithic implementations that can be significantly improved through modularization. The proposed structure separates concerns, eliminates duplication, and provides a clear upgrade path for HTOS while maintaining compatibility with HARPA's proven architectural patterns.

**Immediate Next Steps**:
1. Implement Tier 1 core infrastructure modules
2. Create TypeScript interfaces for all module contracts
3. Begin integration testing with existing HTOS bus system
4. Evaluate necessity of Tier 3 optional features

**Success Metrics**:
- Reduced code duplication (target: <5% overlap between modules)
- Improved type safety (100% TypeScript coverage)
- Maintained performance (Arkose solving time within 10% of original)
- Enhanced testability (>90% unit test coverage for core modules)
