# HTOS Implementation Plan
## Phased Architecture-First Approach

---

## **Phase 0: Restructuring & Architecture Foundation**
*Duration: 1-2 weeks | Priority: Critical*

### **Objectives**
- Establish clear architectural boundaries and module definitions based on plan.md structure
- Audit current codebase against proposed architecture
- Document current state and migration path
- Prepare codebase structure for systematic implementation

### **Deliverables**

#### **0.1 Codebase Audit & Analysis**
- [ ] **File Inventory**: Map all current files and folders in the project
- [ ] **Architecture Comparison**: Compare current structure to proposed structure in plan.md
- [ ] **Dependency Analysis**: Map current dependencies and circular references
- [ ] **Legacy Code Identification**: Identify deprecated patterns, dead code, and HARPA remnants
- [ ] **Gap Analysis**: Document what needs to be moved, created, or deleted

#### **0.2 Module Boundary Definition** 
*Based on plan.md proposed structure:*

**Core Modules:**
- [ ] **`src/core/`**: Service Worker authority (sw.ts, bus.ts, idb.ts, dnr.ts, bus-events.ts)
- [ ] **`src/content/`**: Content script injection (cs.ts, nj-engine.js)
- [ ] **`src/offscreen/`**: Isolated execution (0h.ts, 0f.ts, iframe-factory.ts)
- [ ] **`src/providers/`**: Provider configurations (chatgpt.json, gemini.json, claude.json)
- [ ] **`src/rules/`**: DNR rule definitions (chatgpt.json, gemini.json, claude.json)
- [ ] **`src/utils/`**: Shared utilities (token-extractor.ts, arkose-solver.ts)
- [ ] **`src/orchestration/`**: High-level coordination (dispatch.ts)

#### **0.3 Interface Contracts & Communication**
- [ ] **Message Bus Events**: Define typed events for BroadcastChannel communication
- [ ] **Provider Interface**: Standardize provider configuration schema
- [ ] **DNR Rule Interface**: Standardize rule definition format
- [ ] **Token Management**: Define secure token storage and retrieval contracts
- [ ] **Data Flow Documentation**: Map message flows between contexts

#### **0.4 Security & Architecture Model**
- [ ] **Service Worker Authority**: Document SW-only token management
- [ ] **DNR-before-JS**: Document conditional rule activation timing
- [ ] **Context Isolation**: Define boundaries between SW, Offscreen, CS, and UI
- [ ] **Token Security**: Document secure extraction and storage patterns

#### **0.3 Build System & Tooling**
- [ ] **Build Pipeline**: Ensure `npm run build` produces correct manifest and bundles
- [ ] **Development Workflow**: Hot reload, source maps, and debugging setup
- [ ] **Testing Framework**: Jest/Vitest setup with extension testing utilities
- [ ] **Linting & Formatting**: ESLint, Prettier, and commit hooks

### **Success Criteria**
- Clear module boundaries documented
- Build system produces working extension
- All TypeScript errors resolved
- Development workflow established

---

## **Phase 1: DNR Rule System & Token Management**
*Duration: 1-2 weeks | Priority: Critical (fixes Claude blank page)*

### **Objectives**
- Implement conditional DNR rule activation to prevent premature header stripping
- Establish robust token capture and management system
- Ensure proper timing between authentication and rule activation

### **Deliverables**

#### **1.1 DNR Rule Engine**
- [ ] **Rule Registry**: Centralized management of all DNR rules with lifecycle control
- [ ] **Conditional Activation**: Rules activate only after successful token capture
- [ ] **Tab-Specific Rules**: Support for per-tab rule management and cleanup
- [ ] **Rule Validation**: Type-safe rule definitions with runtime validation

#### **1.2 Token Management System**
- [ ] **Token Capture**: Content script integration for auth token extraction
- [ ] **Secure Storage**: Service Worker-only token storage with encryption
- [ ] **Token Lifecycle**: Automatic refresh, expiration handling, and cleanup
- [ ] **Provider Abstraction**: Generic token interface for all providers

#### **1.3 Authentication Flow**
- [ ] **Bootstrap Sequence**: Allow initial page load before rule activation
- [ ] **Token Detection**: Monitor for successful authentication events
- [ ] **Rule Activation**: Enable header stripping only after token capture
- [ ] **Fallback Handling**: Graceful degradation when token capture fails

### **Success Criteria**
- Claude.ai loads without blank page issue
- All provider tokens captured and stored securely
- DNR rules activate conditionally based on authentication state
- No 401/403 errors during initial page bootstrap

---

## **Phase 2: Message Bus & Communication Layer**
*Duration: 1-2 weeks | Priority: High*

### **Objectives**
- Complete migration to BroadcastChannel-based communication
- Remove all legacy chrome.runtime.sendMessage dependencies
- Establish typed, streaming-capable message contracts

### **Deliverables**

#### **2.1 Bus Architecture**
- [ ] **Message Contracts**: TypeScript interfaces for all bus message types
- [ ] **Context Adapters**: Bus wrappers for SW, Offscreen, CS, and Popup contexts
- [ ] **Streaming Support**: Handle chunked responses for long-running operations
- [ ] **Error Propagation**: Consistent error handling across all contexts

#### **2.2 Legacy Migration**
- [ ] **Runtime Message Removal**: Replace all chrome.runtime.sendMessage calls
- [ ] **Bus Integration**: Update popup.js, SW, and offscreen to use bus exclusively
- [ ] **Message Routing**: Implement proper message routing and delivery guarantees
- [ ] **Backward Compatibility**: Temporary bridges during migration period

#### **2.3 Communication Patterns**
- [ ] **Request/Response**: Standard ask/reply pattern for synchronous operations
- [ ] **Streaming**: Chunk/done pattern for long-running tasks
- [ ] **Events**: Pub/sub pattern for state changes and notifications
- [ ] **Health Checks**: Ping/pong for context availability monitoring

### **Success Criteria**
- All messaging uses BroadcastChannel exclusively
- No chrome.runtime.sendMessage calls remain
- End-to-end test passes: popup → SW → offscreen → iframe
- Message types are fully typed with no `any` usage

---

## **Phase 3: Offscreen Document & Execution Environment**
*Duration: 1-2 weeks | Priority: High*

### **Objectives**
- Establish reliable, CSP-free execution environment
- Implement iframe lifecycle management and health monitoring
- Ensure robust provider interaction capabilities

### **Deliverables**

#### **3.1 Offscreen Host**
- [ ] **Document Lifecycle**: Proper creation, management, and cleanup
- [ ] **Health Monitoring**: Periodic health checks and automatic recovery
- [ ] **Resource Management**: Memory and CPU usage optimization
- [ ] **Error Handling**: Graceful failure recovery and reporting

#### **3.2 Iframe Factory**
- [ ] **Dynamic Creation**: On-demand iframe creation for provider interactions
- [ ] **Isolation**: Proper sandboxing and CSP bypass implementation
- [ ] **Lifecycle Management**: Creation, communication, and cleanup
- [ ] **Provider Routing**: Route requests to appropriate provider iframes

#### **3.3 Execution Context**
- [ ] **Script Injection**: Reliable injection of provider-specific scripts
- [ ] **DOM Manipulation**: Safe DOM interaction within provider contexts
- [ ] **Network Interception**: Capture and modify network requests as needed
- [ ] **State Persistence**: Maintain provider state across iframe lifecycles

### **Success Criteria**
- Offscreen document creates and manages iframes reliably
- Provider scripts execute without CSP violations
- Health checks detect and recover from failures
- No memory leaks or resource accumulation

---

## **Phase 4: Content Scripts & Page Bridge**
*Duration: 1-2 weeks | Priority: Medium*

### **Objectives**
- Implement robust content script injection strategy
- Establish secure bridge for page ↔ extension communication
- Support both manifest-based and programmatic injection

### **Deliverables**

#### **4.1 Injection Strategy**
- [ ] **Manifest Integration**: Proper content_scripts configuration
- [ ] **Programmatic Injection**: Dynamic injection for specific scenarios
- [ ] **Timing Control**: Ensure proper injection timing relative to page load
- [ ] **Multi-Frame Support**: Handle iframes and nested contexts

#### **4.2 Page Bridge**
- [ ] **Secure Communication**: PostMessage-based bridge with origin validation
- [ ] **API Surface**: Clean API for page scripts to interact with extension
- [ ] **Event Forwarding**: Relay page events to extension contexts
- [ ] **State Synchronization**: Keep page and extension state in sync

#### **4.3 Provider Integration**
- [ ] **Token Extraction**: Extract authentication tokens from page context
- [ ] **DOM Monitoring**: Watch for provider-specific UI changes
- [ ] **Request Interception**: Capture and analyze provider API calls
- [ ] **Response Processing**: Process and forward provider responses

### **Success Criteria**
- Content scripts inject reliably across all target sites
- Page bridge enables secure bidirectional communication
- Provider tokens are extracted successfully
- No conflicts with existing page scripts

---

## **Phase 5: Provider Adapters & Session Management**
*Duration: 2-3 weeks | Priority: Medium*

### **Objectives**
- Implement modular, extensible provider system
- Establish session-based authentication flows
- Support parallel provider interactions

### **Deliverables**

#### **5.1 Provider Registry**
- [ ] **Adapter Pattern**: Standardized interface for all providers
- [ ] **Dynamic Loading**: Load provider adapters on demand
- [ ] **Configuration Management**: JSON-based provider configurations
- [ ] **Capability Detection**: Detect and adapt to provider capabilities

#### **5.2 Session Management**
- [ ] **Session Lifecycle**: Create, maintain, and cleanup provider sessions
- [ ] **Authentication Flows**: Handle various auth patterns (cookie, token, OAuth)
- [ ] **Session Persistence**: Maintain sessions across extension restarts
- [ ] **Concurrent Sessions**: Support multiple active provider sessions

#### **5.3 Provider Implementations**
- [ ] **ChatGPT Adapter**: Complete implementation with session management
- [ ] **Claude Adapter**: Full integration with token-based auth
- [ ] **Gemini Adapter**: OAuth flow and API integration
- [ ] **Generic Adapter**: Template for adding new providers

### **Success Criteria**
- All providers implement standardized adapter interface
- Sessions are maintained reliably across interactions
- Parallel provider requests work without conflicts
- New providers can be added with minimal code changes

---

## **Phase 6: UI Integration & User Experience**
*Duration: 1-2 weeks | Priority: Medium*

### **Objectives**
- Complete popup UI integration with new architecture
- Implement responsive, real-time feedback
- Ensure smooth user interaction flows

### **Deliverables**

#### **6.1 Popup Interface**
- [ ] **Bus Integration**: Complete migration to BroadcastChannel communication
- [ ] **Real-time Updates**: Live status updates during provider interactions
- [ ] **Error Handling**: User-friendly error messages and recovery options
- [ ] **State Management**: Consistent UI state across popup sessions

#### **6.2 User Flows**
- [ ] **Provider Selection**: Intuitive provider selection and configuration
- [ ] **Prompt Submission**: Smooth prompt submission with progress feedback
- [ ] **Response Display**: Clean, formatted response presentation
- [ ] **History Management**: Access to previous interactions and results

#### **6.3 Synthesis Layer**
- [ ] **Multi-Provider Responses**: Combine responses from multiple providers
- [ ] **Format Standardization**: Consistent markdown formatting across providers
- [ ] **Response Streaming**: Real-time response updates as they arrive
- [ ] **Export Options**: Save and export conversation history

### **Success Criteria**
- Popup communicates exclusively via bus
- User interactions are smooth and responsive
- Multi-provider synthesis works reliably
- UI provides clear feedback for all operations

---

## **Phase 7: Testing & Quality Assurance**
*Duration: 1-2 weeks | Priority: High*

### **Objectives**
- Establish comprehensive test coverage
- Implement CI/CD pipeline
- Ensure extension stability and reliability

### **Deliverables**

#### **7.1 Test Suite**
- [ ] **Unit Tests**: Test individual modules and functions
- [ ] **Integration Tests**: Test inter-module communication
- [ ] **End-to-End Tests**: Test complete user workflows
- [ ] **Provider Tests**: Test each provider adapter independently

#### **7.2 CI/CD Pipeline**
- [ ] **Automated Testing**: Run tests on every commit
- [ ] **Build Validation**: Ensure builds produce working extensions
- [ ] **Code Quality**: Lint, format, and type checking
- [ ] **Performance Testing**: Monitor memory usage and response times

#### **7.3 Quality Assurance**
- [ ] **Manual Testing**: Comprehensive manual testing across browsers
- [ ] **Edge Case Handling**: Test error conditions and edge cases
- [ ] **Performance Optimization**: Identify and fix performance bottlenecks
- [ ] **Security Review**: Audit for security vulnerabilities

### **Success Criteria**
- All tests pass in CI environment
- Code coverage exceeds 80%
- Extension performs reliably across different browsers
- No critical security vulnerabilities identified

---

## **Implementation Timeline**

| Phase | Duration | Dependencies | Critical Path |
|-------|----------|--------------|---------------|
| Phase 0 | 1-2 weeks | None | ✅ Critical |
| Phase 1 | 1-2 weeks | Phase 0 | ✅ Critical |
| Phase 2 | 1-2 weeks | Phase 0 | ✅ Critical |
| Phase 3 | 1-2 weeks | Phase 2 | ⚠️ High |
| Phase 4 | 1-2 weeks | Phase 1, 2 | ⚠️ Medium |
| Phase 5 | 2-3 weeks | Phase 3, 4 | ⚠️ Medium |
| Phase 6 | 1-2 weeks | Phase 2, 5 | ⚠️ Medium |
| Phase 7 | 1-2 weeks | All phases | ✅ High |

**Total Estimated Duration: 10-16 weeks**

---

## **Risk Mitigation**

### **High-Risk Items**
1. **DNR Rule Timing**: Premature activation breaks provider sites
   - *Mitigation*: Implement comprehensive token detection before rule activation
2. **Bus Message Schema**: Type mismatches cause runtime errors
   - *Mitigation*: Strict TypeScript types and runtime validation
3. **Provider Auth Changes**: External providers change auth mechanisms
   - *Mitigation*: Modular adapter pattern allows quick updates

### **Medium-Risk Items**
1. **CSP Bypass Failures**: Some sites block iframe execution
   - *Mitigation*: Fallback mechanisms and alternative execution strategies
2. **Memory Leaks**: Long-running contexts accumulate resources
   - *Mitigation*: Proper cleanup and health monitoring
3. **Cross-Browser Compatibility**: Different behavior across browsers
   - *Mitigation*: Comprehensive testing across target browsers

---

## **Success Metrics**

### **Technical Metrics**
- Zero TypeScript compilation errors
- All automated tests passing
- Memory usage stable over 24-hour period
- Response times under 5 seconds for typical queries

### **Functional Metrics**
- All target providers working reliably
- No blank page issues on any provider site
- Multi-provider synthesis producing coherent results
- User workflows completing without errors

### **Quality Metrics**
- Code coverage above 80%
- No critical security vulnerabilities
- Documentation coverage for all public APIs
- User-reported issues resolved within 48 hours
