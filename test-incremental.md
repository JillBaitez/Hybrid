# HTOS Incremental Testing Plan

## Phase 2.5: Test What We Have Now

### Test 1: Load Extension & Verify Core Systems
```bash
# 1. Build and load extension
.\build.ps1
# 2. Load unpacked extension in Chrome
# 3. Open browser console and run:
```

```javascript
// Test Universal Bus health
chrome.runtime.sendMessage({
  $bus: true, appName: 'htos', name: 'htos.system.health_check'
}, console.log);

// Test Provider Detection
chrome.runtime.sendMessage({
  $bus: true, appName: 'htos', name: 'htos.provider.detect',
  args: [window.location.hostname]
}, console.log);
```

### Test 2: Mock Token Flow
```javascript
// Inject mock token for testing
chrome.runtime.sendMessage({
  $bus: true, appName: 'htos', name: 'htos.token.set',
  args: ['chatgpt', 'mock-token-for-testing-12345']
}, console.log);

// Test DNR activation with mock token
chrome.runtime.sendMessage({
  $bus: true, appName: 'htos', name: 'htos.dnr.activate',
  args: ['chatgpt', chrome.tabs.query({active: true}, tabs => tabs[0]?.id)]
}, console.log);
```

### Test 3: Manual Token Extraction (Bypass Arkose)
For real testing without Arkose challenges:

1. **Manual Token Extraction**:
   - Open ChatGPT in incognito
   - Login manually (solve Arkose if needed)
   - Extract token from dev tools: `localStorage.getItem('auth-token')` or cookies
   - Inject via extension for testing

2. **Development Endpoints**:
   - Use staging/dev endpoints that don't have Arkose
   - Test with API keys instead of session tokens where possible

## What This Tests vs. What We Need

### ✅ What We Can Test Now:
- Universal Bus communication across all contexts
- Service Worker initialization and health
- Provider registry and detection
- DNR rule activation/deactivation
- Token storage and retrieval
- Cross-context message routing

### 🚧 What We Need to Complete:
- Provider-specific token extraction implementations
- Arkose challenge solving capability
- Offscreen document execution environment (Phase 3)

## Next Steps After Testing

1. **If core systems work**: Complete provider token extraction implementations
2. **If issues found**: Debug Universal Bus, DNR, or storage systems
3. **For Arkose challenges**: Either build challenge solver OR use bypass strategy

## Testing Without Full Pipeline

The beauty of this architecture is that we can test each layer independently:
- **Communication Layer**: Universal Bus (ready)
- **Storage Layer**: Token management (ready)  
- **Network Layer**: DNR rules (ready)
- **Extraction Layer**: Provider implementations (needs completion)
- **Challenge Layer**: Arkose solving (future enhancement)

We can verify the first 3 layers work perfectly before tackling the extraction challenges.
