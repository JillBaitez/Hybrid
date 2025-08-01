# Module Boundaries & Responsibilities
*Phase 0.2 - Core Module Definition*

Generated: 2025-07-31

## Overview

This document defines the boundaries, responsibilities, and interfaces for each core module in the HTOS architecture. It establishes clear contracts between modules to prevent coupling and ensure maintainable code.

---

## **Core Module (`src/core/`)**
*Service Worker Authority & Central Coordination*

### **Responsibility**
- **Primary**: Service Worker-only authority for tokens, DNR rules, and system coordination
- **Secondary**: Message bus orchestration and system-wide state management

### **Files & Components**
- `sw.ts` - Service Worker main logic and event handling
- `bus.ts` - BroadcastChannel message bus implementation
- `bus-events.ts` - Typed event definitions and validation
- `dnr.ts` - DeclarativeNetRequest rule management
- `idb.ts` - IndexedDB storage wrapper (moved from storage/)
- `dispatch.ts` - **❓ May move to orchestration module**

### **Owns (Exclusive Responsibilities)**
- ✅ **Token Storage**: Secure token persistence in IndexedDB
- ✅ **DNR Rule Management**: Dynamic rule registration/unregistration
- ✅ **Message Bus Authority**: Central message routing and validation
- ✅ **System State**: Extension lifecycle and global state management
- ✅ **Security Enforcement**: Service Worker privilege boundaries

### **Never Does (Forbidden)**
- ❌ **Direct DOM Access**: No direct page manipulation
- ❌ **Provider-Specific Logic**: No hardcoded provider behavior
- ❌ **UI Rendering**: No user interface components
- ❌ **Content Script Injection**: No direct script injection (delegates to content module)

### **Interface Contracts**

#### **Incoming Messages** (via BroadcastChannel)
```typescript
// Token management
{ type: 'token.request', provider: string }
{ type: 'token.store', provider: string, token: string, expires: number }

// DNR rule management  
{ type: 'dnr.activate', provider: string, token: string }
{ type: 'dnr.deactivate', provider: string }

// Prompt orchestration
{ type: 'prompt.dispatch', prompt: string, providers: string[] }
```

#### **Outgoing Messages** (via BroadcastChannel)
```typescript
// Token responses
{ type: 'token.response', provider: string, token: string | null }

// DNR confirmations
{ type: 'dnr.activated', provider: string }
{ type: 'dnr.deactivated', provider: string }

// Prompt results
{ type: 'prompt.result', jobId: string, results: IPromptResult[] }
```

### **Dependencies**
- **Internal**: All core module files can import each other
- **External**: Only type definitions from `src/types/`
- **Forbidden**: No imports from content, offscreen, utils, or orchestration modules

---

## **Content Module (`src/content/`)**
*Content Script Injection & Page Interaction*

### **Responsibility**
- **Primary**: Content script injection, anti-bot patches, and page bridge creation
- **Secondary**: Token extraction coordination and DOM manipulation

### **Files & Components** (After restructuring)
- `cs.ts` - Content script main logic and anti-bot patches
- `nj-engine.js` - Page injection engine and DOM automation (from session-layer/)
- `nj-engine.css` - Injection styles and stealth CSS (from session-layer/)
- `nj-engine.html` - HTML templates for injection (from session-layer/)

### **Owns (Exclusive Responsibilities)**
- ✅ **Content Script Logic**: Manifest-declared and programmatic injection
- ✅ **Anti-Bot Patches**: Stealth measures and detection evasion
- ✅ **Page Bridge**: Communication bridge between page and extension contexts
- ✅ **DOM Manipulation**: Direct page element interaction
- ✅ **Token Extraction Coordination**: Triggering token extraction in provider pages

### **Never Does (Forbidden)**
- ❌ **Token Storage**: No persistent token storage (delegates to core)
- ❌ **DNR Rule Creation**: No network rule management
- ❌ **Offscreen Operations**: No iframe creation or management
- ❌ **Provider Configuration**: No hardcoded provider logic

### **Interface Contracts**

#### **Incoming Messages** (via BroadcastChannel)
```typescript
// Injection commands
{ type: 'inject.script', provider: string, script: string }
{ type: 'inject.patches', patches: string[] }

// Token extraction requests
{ type: 'extract.token', provider: string, method: TokenExtractionMethod }
```

#### **Outgoing Messages** (via BroadcastChannel)
```typescript
// Token extraction results
{ type: 'token.extracted', provider: string, token: string }
{ type: 'token.extraction.failed', provider: string, error: string }

// Page state updates
{ type: 'page.ready', provider: string, url: string }
{ type: 'page.error', provider: string, error: string }
```

### **Dependencies**
- **Internal**: Content module files can import each other
- **External**: Type definitions, provider configurations (read-only)
- **Communication**: Message bus to core module only
- **Forbidden**: No direct imports from core, offscreen, utils, or orchestration

---

## **Offscreen Module (`src/offscreen/`)**
*Isolated Execution Environment*

### **Responsibility**
- **Primary**: Offscreen document management and iframe-based operations
- **Secondary**: CSP bypass, Arkose challenge solving, and isolated provider interaction

### **Files & Components** (After restructuring)
- `0h.ts` - Offscreen host logic and iframe coordination
- `0h.html` - Offscreen document template
- `iframe-factory.ts` - Iframe lifecycle management
- `0f.ts` - PoW iframe engine for Arkose solving (from pow/)
- `0f.html` - PoW iframe document (from pow/)
- `iframes/` - Provider-specific iframe templates

### **Owns (Exclusive Responsibilities)**
- ✅ **Offscreen Document**: Creation and lifecycle management
- ✅ **Iframe Management**: Sandboxed iframe creation, messaging, and cleanup
- ✅ **CSP Bypass**: Content Security Policy circumvention
- ✅ **Arkose Solving**: Challenge resolution and proof-of-work computation
- ✅ **Isolated Execution**: Provider interaction in controlled environment

### **Never Does (Forbidden)**
- ❌ **Direct Provider Communication**: No direct API calls (uses iframes)
- ❌ **Token Persistence**: No long-term token storage
- ❌ **DNR Rule Management**: No network rule modification
- ❌ **Content Script Logic**: No page injection or DOM manipulation

### **Interface Contracts**

#### **Incoming Messages** (via BroadcastChannel)
```typescript
// Iframe operations
{ type: 'iframe.create', provider: string, config: IframeConfig }
{ type: 'iframe.destroy', iframeId: string }

// Arkose challenges
{ type: 'arkose.solve', challenge: ArkoseChallenge }
{ type: 'pow.compute', seed: string, difficulty: number }
```

#### **Outgoing Messages** (via BroadcastChannel)
```typescript
// Iframe lifecycle
{ type: 'iframe.created', iframeId: string, provider: string }
{ type: 'iframe.ready', iframeId: string }
{ type: 'iframe.destroyed', iframeId: string }

// Challenge results
{ type: 'arkose.solved', token: string }
{ type: 'pow.result', proof: string }
```

### **Dependencies**
- **Internal**: Offscreen module files can import each other
- **External**: Type definitions, provider configurations (read-only)
- **Utilities**: Can import from utils module for algorithms
- **Communication**: Message bus to core module
- **Forbidden**: No imports from content or orchestration modules

---

## **Providers Module (`src/providers/`)**
*Provider Configuration Data*

### **Responsibility**
- **Primary**: Static configuration data for AI providers
- **Secondary**: Schema validation and provider metadata

### **Files & Components** (After restructuring)
- `chatgpt.json` - ChatGPT configuration (from adapters/)
- `claude.json` - Claude configuration (from adapters/)
- `gemini.json` - Gemini configuration (from adapters/)

### **Configuration Schema**
```typescript
interface IProviderConfig {
  name: string;
  baseUrl: string;
  authType: 'session' | 'api-key';
  endpoints: {
    chat: string;
    models: string;
    auth: string;
  };
  headers: Record<string, string>;
  rateLimit: {
    requests: number;
    window: number;
  };
  selectors: {
    chatInput: string;
    sendButton: string;
    messageContainer: string;
  };
  tokenExtraction: {
    type: 'cookie' | 'localStorage' | 'script';
    name: string;
    fallback?: {
      type: 'localStorage' | 'script';
      key?: string;
      pattern?: string;
    };
  };
}
```

### **Owns (Exclusive Responsibilities)**
- ✅ **Provider Metadata**: Static configuration for each AI provider
- ✅ **Endpoint Definitions**: API URLs and paths
- ✅ **DOM Selectors**: Page element identifiers for automation
- ✅ **Token Extraction Rules**: Methods for session token capture
- ✅ **Rate Limit Specifications**: Request throttling parameters

### **Never Does (Forbidden)**
- ❌ **Executable Logic**: No functions or runtime behavior
- ❌ **State Management**: No dynamic data or caching
- ❌ **Network Requests**: No API calls or HTTP operations
- ❌ **Token Storage**: No actual token values (only extraction rules)

### **Interface Contracts**
- **Read-Only**: All other modules can import configurations
- **No Runtime Interface**: Pure data, no message bus communication
- **Schema Validation**: Configurations must conform to IProviderConfig

### **Dependencies**
- **None**: Pure JSON data files with no imports
- **Consumed By**: All other modules can read these configurations

---

## **Rules Module (`src/rules/`)**
*DNR Rule Definitions*

### **Responsibility**
- **Primary**: DeclarativeNetRequest rule specifications
- **Secondary**: Network request modification templates

### **Files & Components** (After restructuring)
- `chatgpt.json` - DNR rules for ChatGPT (from root rules/)
- `claude.json` - DNR rules for Claude (from root rules/)
- `gemini.json` - DNR rules for Gemini (from root rules/)

### **Rule Schema**
```typescript
interface IDNRRule {
  id: number;
  priority: number;
  action: {
    type: 'modifyHeaders' | 'allow' | 'block';
    requestHeaders?: Array<{
      header: string;
      operation: 'set' | 'append' | 'remove';
      value?: string;
    }>;
  };
  condition: {
    urlFilter: string;
    resourceTypes: string[];
  };
}
```

### **Owns (Exclusive Responsibilities)**
- ✅ **DNR Rule Specifications**: Network request modification rules
- ✅ **Header Modification**: Request/response header templates
- ✅ **URL Filtering**: Request matching patterns
- ✅ **Token Placeholders**: Template variables for dynamic token injection

### **Never Does (Forbidden)**
- ❌ **Rule Activation**: No runtime rule registration (handled by core)
- ❌ **Token Values**: No actual tokens (only placeholders like {{HTOS_CHATGPT_TOKEN}})
- ❌ **Dynamic Logic**: No conditional or runtime behavior
- ❌ **State Management**: No rule state tracking

### **Interface Contracts**
- **Template System**: Rules contain placeholders for dynamic token injection
- **Consumed By**: Core module (dnr.ts) loads and processes these rules
- **No Runtime Interface**: Pure data, no message bus communication

### **Dependencies**
- **None**: Pure JSON data files with no imports
- **Consumed By**: Core module for DNR rule management

---

## **Utils Module (`src/utils/`)**
*Shared Utilities & Algorithms*

### **Responsibility**
- **Primary**: Reusable utility functions and algorithms
- **Secondary**: Provider-agnostic helper functions

### **Files & Components** (After restructuring)
- `token-extractor.ts` - Token extraction utilities (from session-layer/)
- `arkose-solver.ts` - Arkose challenge algorithms (from pow/)

### **Owns (Exclusive Responsibilities)**
- ✅ **Pure Functions**: Stateless utility functions
- ✅ **Algorithms**: Reusable computational logic
- ✅ **Helper Functions**: Common operations used across modules
- ✅ **Data Transformation**: Format conversion and validation utilities

### **Never Does (Forbidden)**
- ❌ **State Management**: No persistent state or caching
- ❌ **Context-Specific Logic**: No module-specific behavior
- ❌ **Side Effects**: No network requests, storage, or DOM manipulation
- ❌ **Message Bus Communication**: No direct bus messaging

### **Interface Contracts**
- **Pure Functions**: All exports should be stateless functions
- **Provider Agnostic**: No hardcoded provider-specific logic
- **Minimal Dependencies**: Should have minimal external dependencies

### **Dependencies**
- **Internal**: Utils can import from each other
- **External**: Type definitions only
- **Forbidden**: No imports from core, content, offscreen, or orchestration modules

---

## **Orchestration Module (`src/orchestration/`)**
*High-Level Workflow Coordination*

### **Responsibility**
- **Primary**: Multi-provider coordination and workflow orchestration
- **Secondary**: Response merging and result synthesis

### **Files & Components** (After restructuring)
- `dispatch.ts` - Prompt dispatching coordination (may move from core/)

### **Owns (Exclusive Responsibilities)**
- ✅ **Multi-Provider Coordination**: Parallel and sequential provider orchestration
- ✅ **Workflow Management**: Complex multi-step operations
- ✅ **Response Merging**: Combining results from multiple providers
- ✅ **Result Synthesis**: Intelligent response combination and deduplication

### **Never Does (Forbidden)**
- ❌ **Direct Provider Communication**: No direct API calls (delegates to offscreen)
- ❌ **Token Management**: No token storage or extraction
- ❌ **DNR Rule Management**: No network rule modification
- ❌ **Content Script Logic**: No page injection or DOM manipulation

### **Interface Contracts**

#### **Incoming Messages** (via BroadcastChannel)
```typescript
// Orchestration requests
{ type: 'orchestrate.prompt', prompt: string, providers: string[], strategy: 'parallel' | 'sequential' }
{ type: 'orchestrate.cancel', jobId: string }
```

#### **Outgoing Messages** (via BroadcastChannel)
```typescript
// Orchestration results
{ type: 'orchestration.result', jobId: string, results: IPromptResult[], merged: string }
{ type: 'orchestration.progress', jobId: string, completed: number, total: number }
```

### **Dependencies**
- **Internal**: Orchestration module files can import each other
- **External**: Type definitions, provider configurations (read-only)
- **Communication**: Message bus to core module for coordination
- **Utilities**: Can import from utils module for algorithms
- **Forbidden**: No direct imports from content or offscreen modules

---

## Module Interaction Rules

### **Communication Patterns**
1. **Core ↔ All Modules**: Core can coordinate with any module via message bus
2. **Content ↔ Core**: Content scripts communicate only with core
3. **Offscreen ↔ Core**: Offscreen operations coordinate through core
4. **Orchestration ↔ Core**: High-level workflows coordinate through core
5. **Utils ← All Modules**: All modules can import utilities (one-way)
6. **Providers ← All Modules**: All modules can read configurations (one-way)
7. **Rules ← Core Only**: Only core module processes DNR rules

### **Forbidden Interactions**
- ❌ **Content ↔ Offscreen**: No direct communication between these contexts
- ❌ **Content ↔ Orchestration**: No direct workflow coordination
- ❌ **Offscreen ↔ Orchestration**: No direct coordination
- ❌ **Utils → Any Module**: Utils cannot import from other modules
- ❌ **Providers/Rules → Any Module**: Data modules cannot import executable code

### **Message Bus Authority**
- **Core Module**: Owns the message bus and routes all inter-module communication
- **Other Modules**: Can only send/receive messages through core's bus
- **No Direct Communication**: Modules cannot directly import and call each other's functions

---

*This module boundary definition ensures clean separation of concerns and maintainable architecture.*
