# 🛠️ HTOS Engine — Canonical Implementation Plan  
*(Copy-paste into your README.md or Jira epic; every task is ordered and references the exact HARPA snippets to lift, rename, and transplant.)*

---

## 🎯 Goal Recap (1-sentence)
Build a **Manifest-V3** Chrome extension that can **log-in-as-user** to ChatGPT / Claude / Gemini **without API keys**, dispatch prompts in parallel, and merge answers — while **never breaking the two pillars**:  
1) **DNR-before-JS race win**, 2) **Service-Worker-only authority**.

---

## 🗂️ Asset Map — What We Keep vs. Re-brand

| HARPA File  | New Name         | What to Salvage (copy-paste & rename symbols)                                                                                                                                     |
| ----------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg.js`     | `core/sw.js`     | - `declarativeNetRequest` rule blocks (lines ≈ 20390-20460)  <br>- `$bus.controller` (lines ≈ 41800-42160)  <br>- `$ai.arkoseController` token refresh loop (lines ≈ 20230-20390) |
| `cs.js`     | `core/cs.js`     | - Injection bootstrap (lines ≈ 1-200)  <br>- Anti-bot patches (`visibility`, `IntersectionObserver`)  <br>- `nj.js` loader                                                        |
| `nj.js`     | `bridge/nj.js`   | Entire file; rename global from `harpa` → `htosBridge`                                                                                                                            |
| `oi.js`     | `pow/0f.js`      | WASM SHA3 + challenge solver; rename globals `harpaPow` → `htosPow`                                                                                                               |
| `os.js`     | `host/0h.js`     | - `offscreen.createDocument` call  <br>- iframe keep-alive (`_manageIframeStability`)  <br>- `localStorage` proxy                                                                 |
| `cs-web.js` | `storage/idb.js` | IndexedDB wrapper (`$storage`); rename symbols                                                                                                                                    |

---

## 📅 8-Week Build Plan (MVP)

### Week 0 — Repo & Tooling
- `npm init -y` → `manifest.json` V3 scaffold.  
- Prettier + ESLint + Rollup (`rollup.config.mjs`).  
- **Golden Rule file**: `.rego.yml` that contains the **Immutable Architecture Pillars** (see previous doc).  

---

### Week 1 — Service Worker Skeleton (`core/sw.js`)
1. Create `src/core/sw.ts`.  
2. **Copy** HARPA’s `chrome.declarativeNetRequest.updateSessionRules` block (≈ 20 lines).  
   - Change rule IDs to `htos-*`.  
   - Replace endpoints with `chatgpt.com`, `claude.ai`, `gemini.google.com`.  
3. **Copy** the MobX store pattern (`$settings`, `$tokens`).  
4. Add minimal `chrome.runtime.onStartup` listener → call `ensureOffscreen()` (see next step).

---

### Week 2 — Off-screen Host (`host/0h.ts`) + Iframe Engine
1. `src/host/0h.ts`  
   - Lift `chrome.offscreen.createDocument` from HARPA `os.js`.  
   - Rename iframe src → `chrome.runtime.getURL('pow/0f.html')`.  
2. `src/pow/0f.html` + `0f.ts`  
   - Inject `<script src="0f.js"></script>` (lifted WASM SHA3).  
3. **Bus handshake**: `postMessage({type:'htos.pow.ready'})`.

---

### Week 3 — Bridge Script (`bridge/nj.js`) + Content Script
1. `src/bridge/nj.js`  
   - Copy verbatim; change global namespace.  
2. `src/core/cs.ts`  
   - Copy HARPA’s anti-bot patches.  
   - Inject `nj.js` via `script.src = chrome.runtime.getURL('bridge/nj.js')`.

---

### Week 4 — Provider Adapters (JSON + TS)
| File | Purpose |
|------|---------|
| `adapters/chatgpt.json` | `{loginUrl, selectors, endpoints}` |
| `adapters/chatgpt.ts` | Implements `login()`, `getToken()`, `sendPrompt()` via `fetch` + cookies extracted by iframe. |
Lift cookie extraction logic from HARPA `bg.js` `$ai.api`.  
Create **interface** `IProviderAdapter` → enforce `.json` + `.ts` contract.

---

### Week 5 — Parallel Dispatcher (`core/dispatch.ts`)
- Copy HARPA’s `Promise.allSettled` pattern (`$ai.controller` lines ≈ 20300).  
- Replace `harpa` prefixes with `htos`.  
- Inject tokens from SW memory (never from page).

---

### Week 6 — Result Synthesizer (`core/synthesis.ts`)
- Simple merge: markdown concat + de-duplication.  
- Future: LLM-based merge (pluggable).

---

### Week 7 — Command Palette UI
- `popup.html` + vanilla TS.  
- Send `{type:'htos.dispatch', prompt}` to SW via `chrome.runtime.sendMessage`.

---

### Week 8 — Regression Tests
- **CI step**: Puppeteer test that asserts:  
  1. DNR rule present in `chrome.declarativeNetRequest.getSessionRules()`.  
  2. Offscreen iframe responds to `htos.pow.ping` within 2 s.  
  3. No token strings in content-script logs.

---

## 🔄 Weekly Micro-Checklist (paste into GitHub issues)

| Week | Deliverable | Acceptance Criteria |
|------|-------------|---------------------|
| 0 | Repo & CI | `npm run lint && npm run build` green, `.rego.yml` committed. |
| 1 | SW + DNR | `chrome.declarativeNetRequest.getSessionRules()` returns ≥3 rules with `htos-*` ids. |
| 2 | Offscreen | `chrome://extensions → Service Workers → inspect → console` shows `htos.pow.ready`. |
| 3 | CS + Bridge | Content-script loads `nj.js`; `window.htosBridge` exists in page context. |
| 4 | 1 Adapter | `ChatGPTAdapter.login()` returns non-empty cookie string. |
| 5 | Dispatcher | `/test/dispatch.spec.ts` passes with 3 providers in parallel. |
| 6 | Synthesis | Output markdown contains headings from each provider. |
| 7 | UI | Popup sends prompt → SW → returns merged answer in <5 s. |
| 8 | Tests | All regression tests pass in headless Chrome. |

---

## 📚 Snippet Index (for devs)

| Task | HARPA Line Hint | New File |
|------|-----------------|----------|
| DNR rule for auth header | `bg.js:20403-20410` | `core/sw.ts` |
| Offscreen keep-alive ping | `os.js:1190-1220` | `host/0h.ts` |
| Anti-bot patches | `cs.js:50-90` | `core/cs.ts` |
| SHA3 WASM import | `oi.js:1-30` | `pow/0f.ts` |
| IndexedDB wrapper | `cs-web.js:200-250` | `storage/idb.ts` |

---

## 🚨 Stop-If-Changed Guardrails

Add to `dangerfile.js`:
```js
fail("DNR rules removed", !rules.some(r => r.id.startsWith('htos-')));
fail("Offscreen creation moved out of SW", !swCode.includes('chrome.offscreen.createDocument'));
fail("Token stored in content-script", csCode.includes('localStorage.setItem("token"'));
```

---

Ship the MVP.  
Then iterate on synthesis quality, more providers, and UI polish — **but never compromise the pillars.**