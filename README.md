# HTOS - AI Provider Orchestration Engine

> **Multi-provider AI orchestration without API keys**  
> Chrome extension that authenticates as user to ChatGPT, Claude, and Gemini, dispatches prompts in parallel, and synthesizes responses.

---

## 🎯 Project Overview

HTOS is a Manifest V3 Chrome extension that enables seamless interaction with multiple AI providers through browser-based authentication. The system captures user sessions, manages provider tokens securely, and orchestrates parallel prompt dispatch with intelligent response synthesis.

### **Core Capabilities**
- **Session-based Authentication**: No API keys required - uses existing browser sessions
- **Parallel Provider Dispatch**: Send prompts to multiple providers simultaneously
- **Intelligent Synthesis**: Merge and deduplicate responses from different providers
- **Secure Token Management**: Service Worker-only authority with proper isolation
- **Anti-Bot Integration**: WASM-based proof-of-work for challenge solving

### **Architecture Pillars**
1. **DNR-before-JS**: DeclarativeNetRequest rules activate only after token capture
2. **Service Worker Authority**: All sensitive operations centralized in SW context
3. **Modular Provider System**: Extensible adapter pattern for new providers
4. **Robust Communication**: BroadcastChannel-based message bus across contexts

---

## 🏗️ Implementation Status

**Current Phase**: Phase 0 - Architecture Foundation  
**Overall Progress**: ~30% (Foundation and planning complete)

### **Phase Progress**
- ✅ **Phase 0**: Restructuring & Architecture (Complete)
- 🔄 **Phase 1**: DNR Rule System & Token Management (In Progress)
- ⏳ **Phase 2**: Message Bus & Communication Layer
- ⏳ **Phase 3**: Offscreen Document & Execution Environment
- ⏳ **Phase 4**: Content Scripts & Page Bridge
- ⏳ **Phase 5**: Provider Adapters & Session Management
- ⏳ **Phase 6**: UI Integration & User Experience
- ⏳ **Phase 7**: Testing & Quality Assurance

---

## 🚨 Known Issues

### **Critical: Claude.ai Blank Page**
**Status**: Diagnosed, solution identified  
**Impact**: Claude.ai shows blank page when extension is active

**Root Cause**: DNR rule strips Authorization headers before token capture, breaking bootstrap API calls

**Solution**: Implement conditional DNR activation - allow initial auth flow, then activate header stripping

---

## 🛠️ Development Setup

### **Prerequisites**
- Node.js 18+
- Chrome/Chromium browser
- TypeScript 5.0+

### **Quick Start**
```bash
# Clone and setup
git clone <repository>
cd htos-extension
npm install

# Development build
npm run build:dev

# Load extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked" → select dist/ folder
```

### **Development Commands**
```bash
npm run build          # Production build
npm run build:dev      # Development build with source maps
npm run watch          # Watch mode for development
npm run lint           # ESLint + Prettier
npm run test           # Run test suite
npm run test:e2e       # End-to-end tests
```

---

## 📋 Implementation Roadmap

> **Detailed implementation plan**: See [`docs/implementation.plan.md`](docs/implementation.plan.md)

### **Phase 1: DNR & Token Management** (Current)
- [ ] Conditional DNR rule activation
- [ ] Token capture and secure storage
- [ ] Provider authentication flows
- [ ] Rule lifecycle management

### **Phase 2: Communication Layer**
- [ ] BroadcastChannel message bus
- [ ] Legacy chrome.runtime migration
- [ ] Typed message contracts
- [ ] Streaming response support

### **Phase 3: Execution Environment**
- [ ] Offscreen document management
- [ ] Iframe factory and lifecycle
- [ ] CSP bypass implementation
- [ ] Health monitoring and recovery

### **Phase 4: Content Scripts**
- [ ] Dual injection strategy (manifest + programmatic)
- [ ] Page bridge implementation
- [ ] Token extraction logic
- [ ] Provider-specific integrations

### **Phase 5: Provider System**
- [ ] Adapter pattern implementation
- [ ] Session management
- [ ] Parallel dispatch system
- [ ] Provider registry

### **Phase 6: User Interface**
- [ ] Popup UI integration
- [ ] Real-time response streaming
- [ ] Multi-provider synthesis
- [ ] History and export features

### **Phase 7: Testing & QA**
- [ ] Comprehensive test suite
- [ ] CI/CD pipeline
- [ ] Cross-browser compatibility
- [ ] Performance optimization

---

## 🏛️ Architecture Overview

### **Context Hierarchy**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Popup UI      │    │  Content Script │    │  Service Worker │
│   (popup.js)    │    │   (cs.js)       │    │    (sw.js)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Offscreen Host  │
                    │   (0h.js)       │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │ Provider Iframe │
                    │   (0f.js)       │
                    └─────────────────┘
```

### **Message Flow**
1. **User Input**: Popup → BroadcastChannel → Service Worker
2. **Provider Dispatch**: SW → Offscreen → Provider Iframe
3. **Response Collection**: Iframe → Offscreen → SW → Popup
4. **Token Management**: Content Script → SW (secure storage)

### **Security Model**
- **Service Worker**: Sole authority for tokens and network rules
- **Content Scripts**: Token extraction only, no storage
- **Offscreen Context**: Isolated execution for provider interactions
- **DNR Rules**: Conditional activation based on authentication state

---

## 📚 Documentation

- **[Implementation Plan](docs/implementation.plan.md)**: Detailed phase-by-phase roadmap
- **[Architecture Decisions](docs/architecture/)**: Technical design decisions
- **[API Documentation](docs/api/)**: Internal API reference
- **[Provider Integration](docs/providers/)**: Adding new providers
- **[Testing Guide](docs/testing/)**: Testing strategies and tools

---

## 🤝 Contributing

### **Development Workflow**
1. Create feature branch from `main`
2. Implement changes following architecture guidelines
3. Add/update tests for new functionality
4. Ensure all linting and tests pass
5. Submit PR with detailed description

### **Code Standards**
- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Comprehensive JSDoc for public APIs
- Test coverage minimum 80%

### **Architecture Guidelines**
- Maintain Service Worker authority model
- Use BroadcastChannel for all inter-context communication
- Implement proper error handling and recovery
- Follow security best practices for token handling

---

## 📄 License

[License Type] - See [LICENSE](LICENSE) file for details

---

## 🔗 Links

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)
- **Releases**: [GitHub Releases](../../releases)
- **Documentation**: [Project Wiki](../../wiki)#