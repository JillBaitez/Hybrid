# HTOS Codebase File Inventory
*Phase 0.1 - Current State Analysis*

Generated: 2025-07-31

## Project Structure Overview

```
refactored 1/
├── src/                    # Source code
├── docs/                   # Documentation
├── dist/                   # Build output
├── rules/                  # DNR rules (root level)
├── icons/                  # Extension icons
├── node_modules/           # Dependencies
├── _metadata/              # Project metadata
└── [config files]          # Build/config files
```

## Detailed File Inventory

### **Root Level Files**
| File | Size | Purpose | Status |
|------|------|---------|--------|
| `manifest.json` | 1,716 bytes | Extension manifest | ✅ Active |
| `popup.html` | 4,048 bytes | Extension popup UI | ✅ Active |
| `popup.js` | 3,272 bytes | Popup logic | ✅ Active |
| `package.json` | 1,200 bytes | Node.js dependencies | ✅ Active |
| `tsconfig.json` | 421 bytes | TypeScript config | ✅ Active |
| `rollup.config.mjs` | 1,098 bytes | Build configuration | ✅ Active |
| `dangerfile.js` | 3,083 bytes | CI checks | ✅ Active |
| `build.ps1` | 3,226 bytes | Windows build script | ✅ Active |
| `build.sh` | 752 bytes | Unix build script | ✅ Active |
| `.rego.yml` | 1,082 bytes | Architecture rules | ✅ Active |
| `timer-worker.min.js` | 660 bytes | Timer utility | ⚠️ Unknown usage |
| `host.min.js` | 669 bytes | Host utility | ⚠️ Unknown usage |

### **Source Code Structure (`src/`)**

#### **Core Module (`src/core/`)** - 6 files
*Current location aligns with proposed architecture*
- Purpose: Service worker and central coordination
- Status: ✅ Correctly placed

#### **Host Module (`src/host/`)** - 4 files  
*Should be renamed to `src/offscreen/` per plan.md*
- `0h.ts` - Offscreen host logic
- `0h.html` - Offscreen document
- `iframe-factory.ts` - Iframe management
- `iframes/claude-test.html` - Test iframe
- Status: 🔄 Needs renaming to `offscreen/`

#### **Session Layer (`src/session-layer/`)** - 4 files
*Should be split between `content/` and `utils/` per plan.md*
- Contains content script and token extraction logic
- Status: 🔄 Needs restructuring

#### **Adapters (`src/adapters/`)** - 3 files
*Should be renamed to `src/providers/` per plan.md*
- `chatgpt.json`, `claude.json`, `gemini.json`
- Status: 🔄 Needs renaming to `providers/`

#### **Storage (`src/storage/`)** - 1 file
*Should move to `src/core/` per plan.md*
- `idb.ts` - IndexedDB wrapper
- Status: 🔄 Should move to core module

#### **Types (`src/types/`)** - 8 files
*Global type definitions*
- Status: ✅ Can remain as shared types

#### **PoW (`src/pow/`)** - 3 files
*Proof-of-work / Arkose solving*
- Should integrate with offscreen module
- Status: 🔄 Needs integration planning

#### **Providers (`src/providers/`)** - Empty
*Placeholder directory*
- Status: 🔄 Will receive content from `adapters/`

### **Rules Directory (`rules/`)** - 3 files
*DNR rule definitions at root level*
- `chatgpt.json`, `claude.json`, `gemini.json`
- Status: 🔄 Should move to `src/rules/` per plan.md

### **Documentation (`docs/`)** - 16 items
- Implementation plans ✅
- Architecture docs ✅  
- HARPA analysis ✅
- Archived documents ✅
- New `dev/` subdirectory ✅

### **Build Output (`dist/`)** - 30 files
*Generated build artifacts*
- Contains compiled versions of source files
- Status: ✅ Generated, no action needed

## Architecture Alignment Analysis

### ✅ **Correctly Placed Modules**
- `src/core/` - Already matches proposed structure
- `src/types/` - Global types are appropriately placed
- `docs/` - Documentation structure is good

### 🔄 **Modules Requiring Restructuring**

#### **High Priority Moves**
1. **`src/host/` → `src/offscreen/`**
   - Rename directory to match architecture
   - Files: `0h.ts`, `0h.html`, `iframe-factory.ts`, `iframes/`

2. **`src/adapters/` → `src/providers/`**
   - Rename directory to match architecture
   - Files: `chatgpt.json`, `claude.json`, `gemini.json`

3. **`rules/` → `src/rules/`**
   - Move DNR rules into src structure
   - Files: `chatgpt.json`, `claude.json`, `gemini.json`

4. **`src/storage/idb.ts` → `src/core/idb.ts`**
   - Move storage logic to core module

#### **Medium Priority Restructuring**
1. **`src/session-layer/` → Split into:**
   - Content script files → `src/content/`
   - Utility functions → `src/utils/`

2. **`src/pow/` → Integrate with `src/offscreen/`**
   - Arkose solving belongs in offscreen context

#### **Missing Modules to Create**
1. **`src/content/`** - Content script module
2. **`src/utils/`** - Shared utilities  
3. **`src/orchestration/`** - High-level coordination

## Dependency Analysis Preview

### **Potential Circular Dependencies**
- Need to analyze import/export patterns
- Check for cross-module dependencies

### **Legacy Code Patterns**
- HARPA remnants in variable names
- Deprecated messaging patterns
- Old architecture assumptions

## Next Steps

1. **Architecture Comparison** - Compare current vs proposed in detail
2. **Dependency Mapping** - Analyze import/export relationships  
3. **Legacy Code Identification** - Tag deprecated patterns
4. **Migration Planning** - Create step-by-step restructuring plan

---

*This inventory provides the foundation for Phase 0 restructuring decisions.*
