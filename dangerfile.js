js
// dangerfile.js
// Runs in CI via `npx danger ci`
// Fails the build if any of the HTOS pillars are violated.

import { readFileSync, existsSync } from 'node:fs';
import { fail, warn, markdown } from 'danger';

const SW_PATH = 'dist/core/sw.js';
const CS_PATH = 'dist/core/cs.js';
const MANIFEST_PATH = 'dist/manifest.json';

// ------------------------------------------------------------
// 1. Service Worker must contain DNR rules with htos-* IDs
// ------------------------------------------------------------
if (!existsSync(SW_PATH)) {
  fail(`Service Worker not built: ${SW_PATH}`);
} else {
  const sw = readFileSync(SW_PATH, 'utf8');
  const dnrRegex = /chrome\.declarativeNetRequest\.updateSessionRules[\s\S]*?htos-/m;
  if (!dnrRegex.test(sw)) {
    fail('DNR rules missing or renamed — htos-* rule IDs are required.');
  }
}

// ------------------------------------------------------------
// 2. Service Worker must create exactly one offscreen document
// ------------------------------------------------------------
const offscreenRegex = /chrome\.offscreen\.createDocument/;
if (!offscreenRegex.test(sw)) {
  fail('Offscreen document creation removed from Service Worker.');
}

// ------------------------------------------------------------
// 3. Tokens / secrets must never appear in content-script
// ------------------------------------------------------------
if (existsSync(CS_PATH)) {
  const cs = readFileSync(CS_PATH, 'utf8');
  const tokenLeak = /\b(Bearer|jwt|token|cookie)\s*[:=]\s*['"`]/i;
  if (tokenLeak.test(cs)) {
    fail('Content script contains hard-coded token or cookie string.');
  }
}

// ------------------------------------------------------------
// 4. Manifest V3 must list required permissions
// ------------------------------------------------------------
if (!existsSync(MANIFEST_PATH)) {
  fail('Manifest not found.');
} else {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const requiredPerms = ['storage', 'offscreen', 'declarativeNetRequest'];
  const missing = requiredPerms.filter(p => !manifest.permissions?.includes(p));
  if (missing.length) {
    fail(`Manifest missing permissions: ${missing.join(', ')}`);
  }
}

// ------------------------------------------------------------
// 5. Warn on bundle size (optional guardrail)
// ------------------------------------------------------------
const swSize = existsSync(SW_PATH) ? readFileSync(SW_PATH).length : 0;
if (swSize > 2 * 1024 * 1024) {
  warn(`Service Worker > 2 MB (${(swSize / 1024 / 1024).toFixed(2)} MB) — may be throttled.`);
}

// ------------------------------------------------------------
// 6. Summary for PR
// ------------------------------------------------------------
markdown(`
## 🛡️ HTOS Danger Report
- DNR rules: ${dnrRegex.test(sw) ? '✅' : '❌'}
- Offscreen creation: ${offscreenRegex.test(sw) ? '✅' : '❌'}
- Token leak check: ${!tokenLeak.test(cs) ? '✅' : '❌'}
- Manifest permissions: ${missing?.length ? '❌' : '✅'}
`);
