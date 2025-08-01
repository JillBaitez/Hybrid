# Architecture Comparison: Current vs Proposed
*Phase 0.1 - Architecture Analysis*

Generated: 2025-07-31

## Overview

This document compares the current HTOS codebase structure against the proposed architecture defined in `plan.md`. It identifies alignment gaps and required restructuring actions.

## Current vs Proposed Structure

### **Current Structure**
```
refactored 1/
├── src/
│   ├── core/              ✅ MATCHES
│   ├── host/              🔄 RENAME → offscreen/
│   ├── session-layer/     🔄 SPLIT → content/ + utils/
│   ├── adapters/          🔄 RENAME → providers/
│   ├── storage/           🔄 MOVE → core/
│   ├── pow/               🔄 INTEGRATE → offscreen/
│   ├── providers/         📁 EMPTY (placeholder)
│   └── types/             ✅ KEEP
├── rules/                 🔄 MOVE → src/rules/
└── [other files]
```

### **Proposed Structure (from plan.md)**
```
HTOS/
├── src/
│   ├── core/              # Service Worker authority
│   ├── content/           # Content script injection
│   ├── offscreen/         # Isolated execution
│   ├── providers/         # Provider configurations  
│   ├── rules/             # DNR rule definitions
│   ├── utils/             # Shared utilities
│   └── orchestration/     # High-level coordination
└── refactoring/           # HARPA reference files
```

## Detailed Module Comparison

### ✅ **Perfect Alignment**

#### **`src/core/` Module**
- **Current**: 6 files in correct location
- **Proposed**: Service Worker authority (sw.ts, bus.ts, idb.ts, dnr.ts, bus-events.ts)
- **Status**: ✅ Already correctly structured
- **Action**: None required

#### **`src/types/` Module**  
- **Current**: 8 TypeScript definition files
- **Proposed**: Not explicitly mentioned but implied as shared types
- **Status**: ✅ Appropriate as global types
- **Action**: Keep as-is

---

### 🔄 **Requires Restructuring**

#### **1. `src/host/` → `src/offscreen/`**
**Current Content:**
- `0h.ts` - Offscreen host logic
- `0h.html` - Offscreen document  
- `iframe-factory.ts` - Iframe management
- `iframes/claude-test.html` - Test iframe

**Proposed Content:**
- `0h.ts` - Offscreen host for iframe management
- `0f.ts` - PoW iframe engine for Arkose challenge solving
- `iframe-factory.ts` - Factory for creating and managing sandboxed iframes

**Gap Analysis:**
- ✅ `0h.ts` and `iframe-factory.ts` already exist
- ❌ Missing `0f.ts` (PoW engine)
- ❌ Need to integrate `src/pow/` content

**Action Required:**
1. Rename `src/host/` → `src/offscreen/`
2. Move relevant files from `src/pow/` into `src/offscreen/`
3. move `0f.ts` from `src/pow/` to `src/offscreen/`

#### **2. `src/session-layer/` → Split into `src/content/` + `src/utils/`**
**Current Content:** (4 files)
- Content script related files
- Token extraction utilities
- Session management logic

**Proposed Split:**
- **`src/content/`**: `cs.ts`, `nj-engine.js` (content script injection)
- **`src/utils/`**: `token-extractor.ts`, `arkose-solver.ts` (shared utilities)

**Action Required:**
1. Create `src/content/` directory
2. Create `src/utils/` directory  
3. Move appropriate files to each location
4. Remove `src/session-layer/` directory

#### **3. `src/adapters/` → `src/providers/`**
**Current Content:**
- `chatgpt.json` - ChatGPT configuration
- `claude.json` - Claude configuration  
- `gemini.json` - Gemini configuration

**Proposed Content:** (Same files, different location)
- Provider configurations (endpoints, selectors, token extraction)

**Action Required:**
1. Move all files from `src/adapters/` to `src/providers/`
2. Remove `src/adapters/` directory

#### **4. `src/storage/` → `src/core/`**
**Current Content:**
- `idb.ts` - IndexedDB wrapper

**Proposed Location:**
- Should be part of core module (Service Worker authority)

**Action Required:**
1. Move `src/storage/idb.ts` → `src/core/idb.ts`
2. Remove `src/storage/` directory

#### **5. `rules/` → `src/rules/`**
**Current Content:** (Root level)
- `chatgpt.json` - DNR rules for ChatGPT
- `claude.json` - DNR rules for Claude
- `gemini.json` - DNR rules for Gemini

**Proposed Location:**
- Inside src structure for consistency

**Action Required:**
1. Create `src/rules/` directory
2. Move all files from `rules/` to `src/rules/`
3. Remove root-level `rules/` directory

---

### 📁 **Missing Modules to Create**

#### **1. `src/orchestration/`**
**Proposed Content:**
- `dispatch.ts` - Prompt dispatching to multiple providers

**Current Status:** file exists in src/core/ directory nissing
**Action Required:**
1. Create `src/orchestration/` directory
2. move existing dispatch logic here

#### **2. Content in `src/content/`**
**Proposed Content:**
- `cs.ts` - Content script for anti-bot patches and iframe injection
- `nj-engine.js` - Injection engine for provider page automation

**Current Status:** Files exist in `src/session-layer/` but need to be moved
**Action Required:**
1. Create `src/content/` directory
2. Move appropriate files from `src/session-layer/`

#### **3. Content in `src/utils/`**
**Proposed Content:**
- `token-extractor.ts` - Token extraction via provider iframes
- `arkose-solver.ts` - Arkose challenge solver for proof tokens

**Current Status:**  exist in `src/session-layer/` and `src/pow/`
**Action Required:**
1. Create `src/utils/` directory
2. Move utility files

---

## Integration Challenges

### **1. PoW Module Integration**
**Challenge**: `src/pow/` contains Arkose-related code that should integrate with offscreen module
**Files to Analyze:**
- What's currently in `src/pow/`?
- How does it relate to `0f.ts` (PoW iframe engine)?

### **2. Session Layer Decomposition**  
**Challenge**: Need to analyze `src/session-layer/` files to determine proper split
**Questions:**
- Which files are content script related?
- Which are utility functions?
- Are there any circular dependencies?

### **3. Missing Orchestration Logic**
**Challenge**: No clear dispatch/orchestration logic found
**Questions:**
- Dispatch logic exists in src/core/ directory nissing

## Dependency Impact Analysis

### **Import/Export Changes Required**

#### **High Impact Changes**
1. **Storage Module Move**: `src/storage/idb.ts` → `src/core/idb.ts`
   - All imports of `../storage/idb` need updating to `./idb`

2. **Host → Offscreen Rename**: `src/host/` → `src/offscreen/`
   - All imports of `../host/` need updating to `../offscreen/`

3. **Adapters → Providers Rename**: `src/adapters/` → `src/providers/`
   - All imports of `../adapters/` need updating to `../providers/`

#### **Medium Impact Changes**
1. **Rules Location**: `rules/` → `src/rules/`
   - Build system may need updates
   - Manifest.json may reference rules

2. **Session Layer Split**: Complex dependency analysis required

## Migration Complexity Assessment

### **Low Risk Moves** (Simple renames/moves)
- ✅ `src/host/` → `src/offscreen/`
- ✅ `src/adapters/` → `src/providers/`  
- ✅ `rules/` → `src/rules/`
- ✅ `src/storage/idb.ts` → `src/core/idb.ts`

### **Medium Risk Moves** (Require analysis)
- ⚠️ `src/session-layer/` decomposition
- ⚠️ `src/pow/` integration
- ⚠️ `src/core/` dispatch logic moved to `src/orchestration/`
- ⚠️ `src/offscreen/` integration with `src/pow/`

## Recommended Migration Order

### **Phase 1: Simple Renames** (Low risk)
1. `src/host/` → `src/offscreen/`
2. `src/adapters/` → `src/providers/`
3. `rules/` → `src/rules/`
4. `src/storage/idb.ts` → `src/core/idb.ts`

### **Phase 2: Content Analysis** (Medium risk)
1. Analyze `src/session-layer/` files
2. Analyze `src/pow/` files  
3. Plan decomposition strategy

### **Phase 3: Decomposition** (Medium risk)
1. Create `src/content/` and `src/utils/`
2. Move files from `src/session-layer/`
3. Integrate `src/pow/` with `src/offscreen/`

### **Phase 4: New Development** (High risk)
1. Create `src/orchestration/`
2. move dispatch.ts logic and file there
3. Update all import statements

---

*Next: Dependency analysis to understand import/export relationships before making moves.*
