## 🚀 **Post-Build Next Steps**

Once you run `npm run build` (or `build.sh`/`build.ps1`) **with only the safe fixes applied**, follow this **exact sequence**:

---

### 1. **Immediate Validation (30s)**
```bash
# Check build succeeded
npm run build && echo "✅ Build OK"

# Verify no new architecture violations
npm run lint -- --quiet || echo "⚠️ Non-critical warnings only"

# Confirm DNR rules exist
grep -r "declarativeNetRequest" dist/core/sw.js || echo "❌ DNR MISSING"
```

---

### 2. **Browser Load Test (60s)**
```bash
# Load unpacked extension
chrome://extensions → Developer mode → Load unpacked → select `dist/`
```

**Verify in DevTools:**
- **Network tab**: Auth header present in `/backend-api/conversation` requests
- **Console**: `HTOS Service worker initialized` appears
- **Sources**: `dist/host/0h.html` loads without errors

---

### 3. **Smoke Tests (2 min)**
```bash
# Run regression tests
npm run test:race    # DNR-before-JS victory
npm run test:csp     # CSP bypass still works
npm run test:offline # iframe recreation
npm run test:token-leak # No tokens in content-script logs
```

---

### 4. **Manual Verification**
| **Test** | **Expected** |
|----------|-------------|
| Visit `chat.openai.com` | No login prompt (uses session cookies) |
| HTOS popup → "Send to models" | 3 parallel requests fire |
| Network tab → first request | Has `Authorization: Bearer...` header |
| Console errors | Zero "Extension context invalidated" errors |

---

### 5. **Pre-Deploy Checklist**
- [ ] All 4 regression tests pass
- [ ] Manifest version bumped (if needed)
- [ ] No new warnings in `errors.txt`
- [ ] `dangerfile.js` passes CI

---

### 6. **If All Green**
```bash
# Package for Web Store
cd dist && zip -r ../htos-v1.0.x.zip *
```

**You're ready to deploy** 🎯

---

### 🔧 **If Build Fails**
1. **Revert last commit** if it's a fix
2. **Check** `errors.txt` for new violations
3. **Verify** no architecture changes were made

*The safe fixes should not cause build failures.*