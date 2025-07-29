Current Project Phase: Mid-Migration (Phase 2 of 4)
Completion Status: ~70% through core messaging refactor

✅ Foundation Phase (Phase 1): Build system, manifest, basic structure, error diagnosis
🔄 Core Migration Phase (Phase 2): Bus integration, legacy removal (IN PROGRESS)
⏳ Integration Phase (Phase 3): End-to-end testing, provider adapters
⏳ Optimization Phase (Phase 4): Performance, compliance, documentation
Holistic Architectural Plan
Layer 1: Communication Backbone (BroadcastChannel Bus)
Status: Partially implemented, needs completion

Current: Bus contract defined in bus-events.ts, ServiceWorkerBus partially integrated
Next: Complete popup and offscreen migration, remove all chrome.runtime.*Message*
Goal: All contexts communicate via typed, streaming-capable bus messages (ask → chunk → done)
Layer 2: Authority & Security (Service Worker Core)
Status: Functional but needs consolidation

Current: SW manages tokens, DNR rules split between JSON (static) and code (dynamic)
Next: Centralize all sensitive operations in SW, ensure DNR-before-JS timing
Goal: SW is sole authority for tokens, network rules, and provider orchestration
Layer 3: Execution Environment (Offscreen + Iframes)
Status: Basic structure exists, needs bus integration

Current: Single offscreen document with iframe factory
Next: Connect iframe lifecycle to bus, implement health checks
Goal: Reliable, CSP-free execution context for provider interactions
Layer 4: Provider Abstraction (Adapters + Registry)
Status: JSON configs exist, needs unified dispatch

Current: Static JSON configs for ChatGPT, Claude, Gemini
Next: Implement ProviderRegistry pattern, standardize auth flows
Goal: Modular, extensible provider system with session-based auth
Layer 5: State Management (Tokens + Jobs)
Status: Split between IndexedDB and SW memory

Current: IndexedDB for jobs, SW memory for tokens
Next: Implement StateManager for reactive token management
Goal: Secure, centralized state with proper isolation
Layer 6: User Interface (Popup + Content Scripts)
Status: Basic UI exists, needs bus integration

Current: Popup with provider selection, content scripts for injection
Next: Complete bus migration, remove direct SW communication
Goal: Responsive UI that communicates only via bus
Immediate Sprint Plan (Next 2-3 Hours)
Priority 1: Complete Bus Migration
Finish popup.js bus wrapper (replace lines 40-60)
Complete setupBus() in 0h.ts for chunk/done forwarding
Remove legacy chrome.runtime listeners from SW
Priority 2: Validate Core Path
Test popup → bus → SW → offscreen → iframe round-trip
Verify DNR rule typing and CSP bypass functionality
Confirm no "type undefined" errors in bus messages
Priority 3: Clean & Document
Remove dead legacy code paths
Update TypeScript types (replace any with proper generics)
Document bus message flows
Risk Assessment & Mitigation
Risk	Impact	Mitigation
Bus payload schema mismatch	High	Type guards in bus-events.ts
CSP bypass fails on some sites	Medium	Keep fallback until M2 complete
Iframe stability issues	Medium	Health check retry logic exists
Token storage security	High	SW-only authority enforced
Success Criteria
Phase 2 Complete When:

All messaging uses BroadcastChannel exclusively
No chrome.runtime.Message calls remain
End-to-end test passes: popup → SW → offscreen → iframe
Build succeeds with zero TypeScript errors
Extension loads and functions in Chrome