## 🚀 Post-Patch Testing & Deploy Flow (Copy-Paste Playbook)

---

### 1. **Local Dev Loop (every commit)**
```bash
# 1. One-command build & lint
npm run build && npm run lint

# 2. Fast smoke test
npm run test:race          # asserts DNR rules present
npm run test:csp           # asserts CSP bypass flow
npm run test:token-leak    # asserts zero tokens in content-script
```

---

### 2. **Browser-Head Smoke Test (30 s)**
1. **Load unpacked** in `chrome://extensions` → **Developer mode** → **Load unpacked** → pick `dist/` folder.
2. **Open** `chrome://extensions/shortcuts` → bind **Ctrl+Shift+H** to “HTOS – AI Orchestration”.
3. **Visit** `https://chat.openai.com/` → DevTools → **Network tab** → filter `backend-api/conversation`.  
   Expect to see **Authorization: Bearer …** header already present **before any JS runs** → confirms pillar #1.

---

### 3. **Puppeteer Regression Suite (CI gate)**
```ts
// tests/regression.spec.ts
import { chromium } from 'playwright';

test('DNR-before-JS race', async () => {
  const browser = await chromium.launchPersistentContext('', {
    args: [`--disable-extensions-except=${__dirname}/../dist`, '--load-extension=../dist']
  });
  const [page] = browser.pages();
  await page.goto('https://chat.openai.com/');
  const authHeader = await page.waitForRequest(r => r.url().includes('/backend-api/'));
  expect(authHeader.headers()['authorization']).toMatch(/^Bearer/);
});
```
Run: `npm test`

---

### 4. **Package & Sign for Chrome Web Store**
```bash
# 1. Version bump
npm version patch            # bumps 1.0.0 → 1.0.1 in package.json & manifest.json

# 2. Final build
npm run build

# 3. Zip exactly what CWS expects
cd dist && zip -r ../htos-v$(node -p "require('../package.json').version").zip *
```

---

### 5. **Deploy Pipeline (GitHub Actions example)**
```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  build-and-upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - run: npm test
      - name: Upload to CWS
        uses: mobilefirstllc/cws-publish-action@v1
        with:
          extension_id: ${{ secrets.CHROME_EXTENSION_ID }}
          client_id: ${{ secrets.CHROME_CLIENT_ID }}
          client_secret: ${{ secrets.CHROME_CLIENT_SECRET }}
          refresh_token: ${{ secrets.CHROME_REFRESH_TOKEN }}
          zip_file: dist/htos-*.zip
```

---

### 6. **Manual Edge-case Checklist (2 min)**
| Action | Expectation |
|--------|-------------|
| Disable network → reload ChatGPT | 0h iframe recreates itself (console: “iframe engine restarting”) |
| Clear cookies → reload | nj-engine auto-re-authenticates via iframe |
| Click HTOS popup → send prompt | Network tab shows 3 parallel fetches (ChatGPT / Claude / Gemini) |

---

### 7. **Roll-back Plan**
```bash
git tag v1.0.0-stable
git reset --hard v1.0.0-stable
npm run build && npm run test
```
Re-upload previous zip to CWS if regression detected.

---

**TL;DR**:  
`npm run build && npm test` → **Load unpacked** → **Puppeteer CI** → **GitHub Action** → **CWS upload**.  
Every step is **automated**; manual checks only for edge-cases.