# 🔒 **HARPA-Compatible Architecture Mandate**  
*Non-negotiable specification for any developer, agent, or AI touching the HTOS extension.*

---

## 📌 Purpose
This document is **legally binding** for any contributor.  
It enumerates the *exact* mechanisms that **must remain untouched** to preserve the two non-optional capabilities:  
1. **Authority & Context Bypass** (privileged operations from unprivileged contexts)  
2. **Race-Condition Victory** (header/auth injection before anti-bot JS runs)

Any deviation **voids parity with HARPA** and is considered a regression.

---

## 🚫 **Immutable Architecture Pillars**

| # | Pillar | What You MUST Keep | What You MUST NOT Do |
|---|--------|--------------------|----------------------|
| 1 | **Declarative Net Request (DNR)** | Rules registered **synchronously** in service-worker `init()` **before any other async work**. | Move to `webRequest` API (JS-level, too late), or lazy-register after user interaction. |
| 2 | **Off-screen Document** | Exactly **one** instance per browser session, created via `chrome.offscreen.createDocument` **once** at startup. | Replace with content-script DOM hacks, popup iframes, or multiple offscreen pages. |
| 3 | **Service Worker as Sole Authority** | All cookie/token storage lives in SW memory or `chrome.storage.session`; **never** in content-script or page `localStorage`. | Store tokens in content-script, page `localStorage`, or pass raw tokens through `postMessage`. |
| 4 | **Bus Serialization Protocol** | Blobs/ArrayBuffers converted to `bus.blob.<uuid>` references; **UUID only** crosses contexts. | Send raw binary, tokens, or cookies as plain JSON over the bus. |
| 5 | **CSP Bypass Flow** | Detect CSP error → **full tab reload** → apply DNR rule → resend command. | Inject inline `<script nonce=...>` or use `eval` to “patch” CSP in the page. |
| 6 | **Iframe Stability Guard** | Off-screen iframe pings `startup.oiReady` every 5 min; if unresponsive → recreate. | Use `iframe.onload` only once; assume iframe never crashes. |
| 7 | **Header Injection Targeting** | DNR rules use **exact URL filters** (`urlFilter`, `resourceTypes: ["xmlhttprequest"]`) + header operations. | Wildcard filters or regex that might match unintended domains. |
| 8 | **Token Refresh Timing** | Arkose/JWT refresh triggered **by service-worker timer**, not by content-script or page events. | Rely on page `setInterval` or user action to refresh tokens. |

---

## 🔍 Concrete Implementation Locks

### 1. DNR Rule Registration (service-worker.ts)
```ts
// ❌ DO NOT wrap in async user prompt
chrome.declarativeNetRequest.updateSessionRules({
  addRules: [{
    id: 1,
    priority: 1,
    condition: {
      urlFilter: "https://chatgpt.com/backend-api/*",
      resourceTypes: ["xmlhttprequest"]
    },
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "Authorization",
        operation: "set",
        value: await getTokenFromSwMemory() // <— SW memory only
      }]
    }
  }]
});
```

### 2. Off-screen Document Lifecycle (service-worker.ts)
```ts
let offscreenTabId: number | null = null;

async function ensureOffscreen() {
  if (offscreenTabId) return; // singleton
  const {id} = await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL("offscreen.html"),
    reasons: ["LOCAL_STORAGE", "BLOBS", "IFRAME_SCRIPTING"]
  });
  offscreenTabId = id;
}
```

### 3. Bus Blob Protocol (common.ts)
```ts
// ✅ Always wrap blobs
const blobId = crypto.randomUUID();
globalThis.blobs.set(blobId, blob);
sendBus({type: "bus.blob", id: blobId}); // NOT the blob itself
```

### 4. CSP Error Recovery (content-script.ts)
```ts
if (evalFails) {
  chrome.runtime.sendMessage({type: "csp.blocked", tabId});
  // ❌ DO NOT attempt to rewrite CSP via DOM
}
```
Service-worker then:
```ts
chrome.tabs.reload(tabId);
await reRegisterDNR(); // race re-won
```

---

## 🧪 Regression Test Suite (CI Must Pass)

| Test | Expected Outcome |
|------|------------------|
| `npm run test:race` | Auth header present in first request to `/backend-api/conversation`. |
| `npm run test:csp` | After CSP error dialog → tab reloads → content-script reinjects successfully. |
| `npm run test:offline` | Off-screen iframe recreation within 5 min after crash. |
| `npm run test:token-leak` | Zero occurrences of `Bearer` string in content-script or page logs. |

---

## 🖋️ Sign-off Section

> By committing code to this repository you assert that **no line added or removed** contradicts the above pillars.  
> Violations **will be reverted without review**.

**Maintainer signature**: ___________________  
**Date**: 2025-07-26

---

*“Improvements are welcome; regressions are not.”*