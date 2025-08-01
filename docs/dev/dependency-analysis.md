# Dependency Analysis Report
*Phase 0.1 - Module Dependencies & Import/Export Mapping*

Generated: 2025-07-31

## Overview

This document analyzes the current import/export relationships across HTOS modules to understand dependencies before restructuring. It identifies circular dependencies, cross-module coupling, and the impact of proposed architectural changes.

## Current Module Dependencies

### **Core Module (`src/core/`)** - 6 files
*Central authority module - should have minimal external dependencies*

#### **`sw.ts` (Service Worker)**
**Imports:**
- `../types/tokens.js` - Token type definitions ✅
- `./bus.js` - Message bus (internal) ✅
- `../types/bus.js` - Bus type definitions ✅
- `../types/prompt-job.js` - Prompt job types ✅
- `./dispatch.js` - Dispatch logic (internal) ✅
- `./dnr.js` - DNR management (internal) ✅
- `../storage/idb.js` - **🔄 Will become `./idb.js` after move**

**Analysis:**
- ✅ Good: Most imports are internal or type definitions
- 🔄 Impact: Storage import path will change when `idb.ts` moves to core

#### **`bus.ts` (Message Bus)**
**Imports:**
- `./bus-events.js` - Event definitions (internal) ✅
- `./dispatch.js` - Dispatch logic (internal) ✅

**Analysis:**
- ✅ Excellent: Only internal dependencies
- ✅ No changes needed during restructuring

#### **`dispatch.ts` (Prompt Dispatch)**
**Imports:**
- `../types/prompt-job` - Type definitions ✅
- `../types/provider` - Provider types ✅

**Analysis:**
- ✅ Good: Only type dependencies
- ⚠️ Question: Should this move to `src/orchestration/`?

### **Session Layer (`src/session-layer/`)** - 4 files
*To be split between `src/content/` and `src/utils/`*

#### **Files Analysis:**
- `nj-engine.js` (18,221 bytes) - Large content script → `src/content/`
- `nj-engine.css` (1,805 bytes) - Styles for injection → `src/content/`
- `nj-engine.html` (478 bytes) - HTML template → `src/content/`
- `token-extractor.ts` (3,449 bytes) - Utility function → `src/utils/`

**Dependency Impact:**
- Need to analyze imports in `token-extractor.ts`
- `nj-engine.js` likely has minimal imports (content script)

### **Host Module (`src/host/`)** - 4 files
*To be renamed to `src/offscreen/`*

#### **Files Analysis:**
- `0h.ts` - Offscreen host logic
- `0h.html` - Offscreen document
- `iframe-factory.ts` - Iframe management
- `iframes/claude-test.html` - Test iframe

**Dependency Impact:**
- All imports of `../host/` need updating to `../offscreen/`
- Internal structure should remain the same

### **PoW Module (`src/pow/`)** - 3 files
*To be integrated with `src/offscreen/`*

#### **Files Analysis:**
- `0f.html` (156 bytes) - PoW iframe document
- `0f.ts` (31,537 bytes) - **Large PoW engine implementation**
- `arkose-solver.ts` (446 bytes) - Arkose solver utility

**Integration Strategy:**
- `0f.ts` and `0f.html` → Move to `src/offscreen/`
- `arkose-solver.ts` → Move to `src/utils/`

### **Storage Module (`src/storage/)` - 1 file
*To be moved to `src/core/`*

#### **`idb.ts` - IndexedDB wrapper**
**Current Import Pattern:** `../storage/idb.js`
**New Import Pattern:** `./idb.js` (from core module)

**Impact Analysis:**
- **High Impact**: Core module (`sw.ts`) imports this
- All references need updating during move

## Cross-Module Dependency Map

### **Current Import Patterns**
```
src/core/sw.ts
├── ../types/* (✅ types only)
├── ./bus.js (✅ internal)
├── ./dispatch.js (✅ internal)
├── ./dnr.js (✅ internal)
└── ../storage/idb.js (🔄 will change)

src/core/bus.ts
├── ./bus-events.js (✅ internal)
└── ./dispatch.js (✅ internal)

src/core/dispatch.ts
├── ../types/prompt-job (✅ types only)
└── ../types/provider (✅ types only)
```

### **Proposed Import Patterns After Restructuring**
```
src/core/sw.ts
├── ../types/* (✅ unchanged)
├── ./bus.js (✅ unchanged)
├── ./dispatch.js (❓ may move to orchestration)
├── ./dnr.js (✅ unchanged)
└── ./idb.js (🔄 NEW - moved from storage)

src/orchestration/dispatch.ts (❓ if moved)
├── ../types/* (✅ unchanged)
└── ../core/* (🔄 NEW - may need core imports)
```

## Circular Dependency Analysis

### **Potential Circular Dependencies**
1. **Core ↔ Orchestration**: If `dispatch.ts` moves to orchestration but needs core services
2. **Content ↔ Utils**: If content scripts need utilities that also need content context
3. **Offscreen ↔ Utils**: If offscreen needs utilities that need offscreen context

### **Current Circular Dependencies**
*Need to analyze actual import statements to identify existing cycles*

## Import Path Changes Required

### **High Priority Changes** (Breaking imports)

#### **1. Storage Module Move**
**Current:** `import { HTOSStorage } from '../storage/idb.js'`
**New:** `import { HTOSStorage } from './idb.js'`
**Affected Files:**
- `src/core/sw.ts`
- Any other files importing storage

#### **2. Host → Offscreen Rename**
**Current:** `import { ... } from '../host/...'`
**New:** `import { ... } from '../offscreen/...'`
**Affected Files:**
- Any files importing from host module
- Need to search codebase for `../host/` imports

#### **3. Adapters → Providers Rename**
**Current:** `import config from '../adapters/chatgpt.json'`
**New:** `import config from '../providers/chatgpt.json'`
**Affected Files:**
- Any files importing provider configurations

#### **4. Rules Location Change**
**Current:** `import rules from '../../rules/chatgpt.json'`
**New:** `import rules from '../rules/chatgpt.json'`
**Affected Files:**
- DNR-related files
- Build system references

### **Medium Priority Changes** (New structure)

#### **1. Session Layer Split**
**Current:** `import { ... } from '../session-layer/...'`
**New:** 
- `import { ... } from '../content/...'` (for content script files)
- `import { ... } from '../utils/...'` (for utility files)

#### **2. PoW Integration**
**Current:** `import { ... } from '../pow/...'`
**New:**
- `import { ... } from '../offscreen/...'` (for 0f.ts)
- `import { ... } from '../utils/...'` (for arkose-solver.ts)

## Build System Impact

### **Manifest.json References**
- May reference `rules/` directory
- Content scripts may reference session-layer files
- Web accessible resources may need updating

### **Build Scripts**
- `rollup.config.mjs` may have path assumptions
- Build output paths may need adjustment

### **TypeScript Configuration**
- Path mappings may need updates
- Module resolution may be affected

## Migration Risk Assessment

### **🔴 High Risk Changes**
1. **Storage module move** - Core dependency, high usage
2. **Session layer split** - Complex decomposition required
3. **Dispatch module location** - Unclear if it should move

### **🟡 Medium Risk Changes**
1. **Host → Offscreen rename** - Simple rename but may have many references
2. **PoW integration** - Need to understand 0f.ts dependencies
3. **Rules location** - May affect build system

### **🟢 Low Risk Changes**
1. **Adapters → Providers rename** - Likely minimal references
2. **Type definitions** - Should be unaffected

## Recommended Analysis Steps

### **Before Making Changes:**
1. **Search for all import statements** referencing modules to be moved
2. **Identify all files** that will be affected by each change
3. **Create migration scripts** to update import paths automatically
4. **Test build system** after each major change

### **Priority Order:**
1. **Analyze actual imports** in each file (not just grep results)
2. **Map complete dependency graph** 
3. **Identify minimal viable changes** for first migration phase
4. **Create automated migration tools** for path updates

## Next Steps

1. **Complete import analysis** - Get actual import statements from all files
2. **Create dependency graph** - Visual representation of current dependencies  
3. **Plan migration phases** - Break changes into safe, testable chunks
4. **Prepare migration scripts** - Automate import path updates

---

*This analysis provides the foundation for safe architectural restructuring with minimal breaking changes.*
