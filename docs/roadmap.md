Of course. Here is the final, unified implementation plan, synthesized from our conversation. It is structured from the bottom up, presenting foundational building blocks first and then layering on the more advanced, battle-tested refinements. As requested, any task that involves replacing, deleting, or subtracting from a file is explicitly marked with a `[FLAG: ...]` notation. Additive changes are described without flags.

-----

## Final Synthesized Implementation Plan: HTOS Orchestration Engine

[cite\_start]This plan synthesizes the iterative refinements discussed into a single, comprehensive roadmap[cite: 404]. [cite\_start]It is structured to build the system from its foundational components upwards, incorporating all basic and advanced patterns into a cohesive whole[cite: 405].

-----

### **Phase 1: Foundational Layer - Token & Network Rule Management**

[cite\_start]**Goal**: Establish a robust and precise mechanism for managing provider tokens and dynamically applying network rules to enable API communication without disrupting the user experience[cite: 406].

#### **1.A. Token Lifecycle Management (Additive)**

[cite\_start]First, we enhance the token extraction logic to include an expiration check, ensuring tokens remain fresh[cite: 407].

  * **File**: `src/session-layer/token-extractor.ts` (Enhancement)

  * [cite\_start]**Action**: Update the `extractTokenFromProvider` function to check for an existing, non-expired token before initiating a new extraction process[cite: 408]. [cite\_start]This logic will later be fully implemented using the advanced offscreen infrastructure from Phase 3[cite: 532, 567].

    ```typescript
    [cite_start]// This is the initial, foundational version of the function. [cite: 409]
    [cite_start]// It will be replaced in a later step (1.C) [cite: 410]
    [cite_start]// but is presented here to show the logical build-up. [cite: 410]
    import { HTOSStorage } from '../storage/idb';
    [cite_start]// Note: createProviderExtractionIframe and sendExtractionMessage are placeholders for the logic that will be [cite: 411]
    [cite_start]// fully implemented with the advanced Offscreen Manager in Phase 3. [cite: 411]

    [cite_start]export async function extractTokenFromProvider(domain: string): Promise<string | null> { [cite: 411]
      [cite_start]const storage = new HTOSStorage(); [cite: 412]
      [cite_start]await storage.init(); [cite: 412]
      const provider = domain.includes('openai') ? 'chatgpt' : domain.includes('claude') ? [cite_start]'claude' : 'gemini'; [cite: 412]
      [cite_start]const token = await storage.getToken(provider); [cite: 412]
      
      [cite_start]// Check for a valid, non-expired token first [cite: 413]
      [cite_start]if (token && token.expires && token.expires > Date.now()) { [cite: 413]
        [cite_start]return token.token; [cite: 413]
      }

      [cite_start]// If no valid token, proceed with extraction [cite: 414]
      const iframe = await createProviderExtractionIframe(domain); [cite_start]// Placeholder [cite: 414]
      [cite_start]try { [cite: 415]
        const newToken = await sendExtractionMessage(iframe, { type: 'htos.extract.token', domain }); [cite_start]// Placeholder [cite: 415]
        [cite_start]await storage.setToken(provider, { [cite: 416]
          [cite_start]type: 'session', [cite: 416]
          [cite_start]token: newToken, [cite: 416]
          [cite_start]expires: Date.now() + 24 * 60 * 60 * 1000, // 24h expiration [cite: 416]
        });
        [cite_start]// In the full plan, this would trigger a DNR update. [cite: 416]
        [cite_start]return newToken; [cite: 417]
      [cite_start]} finally { [cite: 417]
        [cite_start]iframe.remove(); [cite: 417]
      }
    }
    ```

#### **1.B. Declarative Net Request (DNR) Management: Basic to Advanced**

[cite\_start]We will evolve the DNR strategy from a simple, static approach to a sophisticated, dynamic one[cite: 418].

  * **Step 1: The Basic (but flawed) Approach**
    [cite\_start]The initial idea is a `DNRManager` that loads predefined JSON rules and injects a token[cite: 419]. [cite\_start]While simple, this approach is too broad and causes the "Claude blank page" issue[cite: 420, 205]. [cite\_start]It works by loading a file like `rules/claude.json`, replacing a token placeholder, and applying the rule globally[cite: 421]. [cite\_start]The problem is that this strips essential headers from all requests to the domain (e.g., `claude.ai`), including the main page load, which breaks the site[cite: 422, 205].

  * **Step 2: The Advanced & Refined HARPA-Inspired DNRManager**
    [cite\_start]To fix the issue, we replace the basic approach with a precise, just-in-time strategy[cite: 423, 206]. [cite\_start]This new manager activates temporary, tab-specific rules only for API calls, leaving normal Browse unaffected[cite: 424, 251]. [cite\_start]It uses non-blocking request observation to trigger these rules, avoiding the need for the invasive `webRequestBlocking` permission[cite: 795, 800].

    **[FLAG: REPLACEMENT]**

      * **File to be Replaced**: `src/core/dnr.ts`
      * [cite\_start]**Reason**: The following advanced implementation completely supersedes the basic approach to fix the Claude issue and align with HARPA's proven patterns[cite: 425, 206].

    <!-- end list -->

    ```typescript
    [cite_start]// src/core/dnr.ts [cite: 426]
    [cite_start]import { HTOSStorage } from '../storage/idb'; [cite: 426]
    [cite_start]import { IProviderConfig } from '../types/provider'; [cite: 426]

    [cite_start]// ... (Interface definitions for Rule and TrackedRule) ... [cite: 426, 429]

    export class DNRManager {
      [cite_start]private storage: HTOSStorage; [cite: 815]
      [cite_start]private lastRuleId: number = 1; [cite: 815]
      [cite_start]private rules: TrackedRule[] = []; [cite: 815]
      [cite_start]private cleanupInterval: NodeJS.Timeout | null = null; [cite: 816]

      constructor() {
        [cite_start]this.storage = new HTOSStorage(); [cite: 816]
      }

      async init(): Promise<void> {
        [cite_start]await this.storage.init(); [cite: 817]
        [cite_start]await this.dropAllSessionRules(); [cite: 817]
        [cite_start]this.cleanupTabRulesPeriodically(); [cite: 817]

        [cite_start]// Listen for API requests to activate rules just-in-time, non-blockingly [cite: 432, 818]
        chrome.webRequest.onBeforeRequest.addListener(
          this.onApiRequest.bind(this),
          {
            urls: [
              [cite_start]"*://chatgpt.com/backend-api/conversation*", [cite: 601]
              [cite_start]"*://claude.ai/api/append_message*", [cite: 601]
              [cite_start]"*://gemini.google.com/_/BardChatUi/data/batchexecute*", [cite: 601]
            ],
          },
          [cite_start][] // Non-blocking observation, no extra permissions needed [cite: 818]
        );
        [cite_start]// Clean up rules when a tab is closed [cite: 433]
        [cite_start]chrome.tabs.onRemoved.addListener(this.onTabRemoved.bind(this)); [cite: 434]
      }

      [cite_start]// This method is called just-in-time when an API call is detected [cite: 435]
      async registerRules(provider: string, tabId: number): Promise<number[]> {
        [cite_start]const token = await this.storage.getToken(provider); [cite: 819]
        [cite_start]if (!token?.token) return []; [cite: 819]

        [cite_start]const providerConfig = await this.storage.getProviderConfig(provider); [cite: 820]
        [cite_start]if (!providerConfig) return []; [cite: 820]

        [cite_start]const ruleKey = `${provider}-api-tab-${tabId}`; [cite: 820]
        if (this.rules.some(r => r.key === ruleKey)) return []; [cite_start]// Rule already active [cite: 820, 437]

        [cite_start]const rules = this.generateProviderRules(provider, providerConfig, token.token, tabId); [cite: 821]
        [cite_start]const newRule = { ...rules[0], id: this.lastRuleId++, key: ruleKey }; [cite: 821]
        [cite_start]this.rules.push({ id: newRule.id, key: newRule.key, tabIds: newRule.condition.tabIds }); [cite: 822]

        [cite_start]await chrome.declarativeNetRequest.updateSessionRules({ [cite: 822]
          [cite_start]addRules: [newRule], [cite: 822]
        });

        [cite_start]// Automatically remove the rule after a short period to prevent interference [cite: 823, 259]
        [cite_start]setTimeout(() => this.unregisterByIds([newRule.id]), 30000); [cite: 823]
        [cite_start]return [newRule.id]; [cite: 823]
      }
      
      [cite_start]// ... (unregisterByIds, dropAllSessionRules, onTabRemoved, cleanupTabRulesPeriodically, getProviderFromUrl methods) ... [cite: 442, 444, 448, 449, 451]

      private generateProviderRules(provider: string, config: IProviderConfig, token: string, tabId: number): Rule[] {
        [cite_start]const apiPatterns: { [key: string]: string } = { [cite: 618]
          [cite_start]chatgpt: '*://chatgpt.com/backend-api/conversation*', [cite: 618]
          [cite_start]claude: '*://claude.ai/api/append_message*', [cite: 618]
          [cite_start]gemini: '*://gemini.google.com/_/BardChatUi/data/batchexecute*', [cite: 618]
        };
        [cite_start]// Minimal header modification: only touch what's necessary [cite: 452, 254]
        [cite_start]return [{ [cite: 838]
          [cite_start]key: `${provider}-api-tab-${tabId}`, [cite: 838]
          [cite_start]priority: 1, [cite: 838]
          [cite_start]action: { [cite: 838]
            [cite_start]type: 'modifyHeaders', [cite: 838]
            [cite_start]requestHeaders: [ [cite: 839]
              [cite_start]{ header: 'Authorization', operation: 'set', value: `Bearer ${token}` }, [cite: 453]
              [cite_start]{ header: 'sec-ch-ua', operation: 'remove' }, [cite: 453]
              [cite_start]{ header: 'sec-ch-ua-mobile', operation: 'remove' }, [cite: 453]
              [cite_start]{ header: 'sec-ch-ua-platform', operation: 'remove' }, [cite: 619]
            ],
          },
          [cite_start]condition: { [cite: 840]
            urlFilter: apiPatterns[provider] || [cite_start]`*://${config.domain}/api/*`, // Use precise API patterns [cite: 620, 569]
            [cite_start]resourceTypes: ['xmlhttprequest', 'fetch'], [cite: 455]
            [cite_start]tabIds: [tabId], // Crucially, scoped to the specific tab [cite: 455, 257]
          },
        }];
      }
    }
    ```

    **[FLAG: DELETION]**

      * [cite\_start]**Files to be Deleted**: All static rule files in `rules/*.json` (e.g., `rules/claude.json`, `rules/chatgpt.json`)[cite: 457, 271].
      * [cite\_start]**Reason**: These are replaced by the dynamic rule generation in the new `DNRManager`[cite: 458, 271].

-----

### **Phase 2: Core Orchestration - Dispatch & Synthesis**

[cite\_start]**Goal**: Create the engine that receives prompts from the UI, dispatches them to providers, and synthesizes the results[cite: 459].

#### **2.A. The Prompt Dispatcher**

[cite\_start]This component orchestrates sending prompts to one or more enabled providers in parallel[cite: 460].

**[FLAG: NEW FILE / REPLACEMENT]**

  * **File**: `src/core/dispatch.ts`
  * **Reason**: This is the core logic for the orchestration engine. [cite\_start]It is either a new file or replaces an incomplete stub[cite: 461].

<!-- end list -->

```typescript
[cite_start]// src/core/dispatch.ts [cite: 462]
[cite_start]import { HTOSStorage } from '../storage/idb'; [cite: 462]
[cite_start]import { IProviderAdapter, IProviderResult, IPromptJob } from '../types/prompt-job'; [cite: 463]
[cite_start]import { IProviderConfig } from '../types/provider'; [cite: 463]
[cite_start]import { extractTokenFromProvider } from '../session-layer/token-extractor'; [cite: 464]

[cite_start]// The adapter handles the specifics of communicating with a single provider. [cite: 465]
[cite_start]class ProviderAdapter implements IProviderAdapter { [cite: 465]
  [cite_start]constructor(public readonly config: IProviderConfig) {} [cite: 465]
  
  [cite_start]// ... (login method) ... [cite: 466]

  [cite_start]async sendPrompt(text: string, token: string): Promise<string> { [cite: 468]
    [cite_start]// ... (fetch logic to send prompt to provider API) ... [cite: 468, 469]
    [cite_start]return response.text(); [cite: 470]
  }
}

[cite_start]export class PromptDispatcher { [cite: 471]
  [cite_start]private storage: HTOSStorage; [cite: 471]
  [cite_start]private adapters: Map<string, IProviderAdapter> = new Map(); [cite: 471]

  constructor() {
    [cite_start]this.storage = new HTOSStorage(); [cite: 472]
  }

  async init(): Promise<void> {
    [cite_start]await this.storage.init(); [cite: 473]
    [cite_start]const providers = await this.storage.getEnabledProviders(); [cite: 473]
    [cite_start]for (const { name, config } of providers) { [cite: 474]
      [cite_start]this.adapters.set(name, new ProviderAdapter(config)); [cite: 474]
    }
  }

  async dispatchPrompt(job: IPromptJob): Promise<IProviderResult[]> {
    [cite_start]await this.storage.createJob(job.id, job.prompt, job.providers); [cite: 475]
    [cite_start]const results: IProviderResult[] = []; [cite: 475]
    
    [cite_start]// ... (logic to map over providers, get token, and call adapter.sendPrompt) ... [cite: 476]

    [cite_start]await Promise.allSettled(promises); [cite: 477]
    [cite_start]const synthesized = this.synthesizeResponses(results); [cite: 478]
    [cite_start]await this.storage.updateJob(job.id, { status: 'completed', results, synthesized }); [cite: 478]
    [cite_start]return results; [cite: 478]
  }
  
  [cite_start]// Basic response synthesis, can be refined later [cite: 479]
  private synthesizeResponses(results: IProviderResult[]): string {
    [cite_start]const validResults = results.filter(r => !r.error && r.raw); [cite: 479]
    [cite_start]if (!validResults.length) return 'No valid responses received.'; [cite: 480]
    
    [cite_start]// Simple deduplication: combine unique sentences [cite: 89, 480]
    [cite_start]const sentences = new Set<string>(); [cite: 480]
    [cite_start]validResults.forEach(r => { [cite: 480]
      [cite_start]r.raw.split('.').forEach(s => { [cite: 89]
        [cite_start]const trimmed = s.trim(); [cite: 89]
        [cite_start]if (trimmed) sentences.add(trimmed); [cite: 89]
      });
    });
    [cite_start]return Array.from(sentences).join('. ') + '.'; [cite: 481]
  }
}
```

#### **2.B. Connecting the Message Bus (Additive)**

[cite\_start]We wire the message bus to use our new `PromptDispatcher`[cite: 483].

  * **File**: `src/core/bus.ts` (Enhancement)
  * [cite\_start]**Action**: Update the `handleAsk` method to instantiate and use the `PromptDispatcher`[cite: 484].

<!-- end list -->

```typescript
[cite_start]// src/core/bus.ts [cite: 485]
// ... existing ServiceWorkerBus class ...
  private async handleAsk(msg: BusMessage<'ask'>, sender: chrome.runtime.MessageSender): Promise<void> {
    [cite_start]const { prompt, provider } = msg.payload; [cite: 485]
    const tabId = sender.tab?.id; [cite_start]// Get the tabId for DNR context [cite: 486]

    [cite_start]try { [cite: 486]
      [cite_start]// The dispatcher now handles the entire job [cite: 486]
      [cite_start]const dispatcher = new PromptDispatcher(); [cite: 486]
      await dispatcher.init(); [cite_start]// Initialize with latest provider configs [cite: 487]
      
      [cite_start]const job: IPromptJob = { id: msg.id, prompt, providers: [provider] }; [cite: 488]
      [cite_start]const results = await dispatcher.dispatchPrompt(job); [cite: 488]
      
      [cite_start]this.sendDone(msg.id, { results, timing: { duration: results.reduce((sum, r) => sum + r.duration, 0) } }); [cite: 490]
    [cite_start]} catch (error: any) { [cite: 491]
      [cite_start]this.sendDone(msg.id, undefined, error?.message || String(error)); [cite: 491]
    }
  }
// ... rest of the class ...
```

-----

### **Phase 3: Advanced Infrastructure - Offscreen & Iframe Management**

[cite\_start]**Goal**: Implement a robust, Chrome Store-compliant offscreen document and iframe management system for isolated, secure provider interactions (like token extraction and CAPTCHA solving)[cite: 493, 282].

**[FLAG: REPLACEMENT]**

  * **File to be Replaced**: `src/host/0h.ts`
  * [cite\_start]**Reason**: Implementing the full HARPA-inspired manager with health monitoring, auto-recovery, and Chrome Store-approved justifications[cite: 495, 288, 313].

<!-- end list -->

```typescript
[cite_start]// src/host/0h.ts [cite: 496]
[cite_start]// This is the OffscreenManager, responsible for the lifecycle of the offscreen document. [cite: 496]
export class OffscreenManager {
  [cite_start]private static instance: OffscreenManager; [cite: 497]
  [cite_start]// ... (private properties for documentExists, pingInterval, etc.) ... [cite: 497]

  [cite_start]static getInstance(): OffscreenManager { [cite: 498]
    [cite_start]if (!OffscreenManager.instance) OffscreenManager.instance = new OffscreenManager(); [cite: 498]
    [cite_start]return OffscreenManager.instance; [cite: 499]
  }

  [cite_start]// ... (constructor, init, createOffscreenDocument methods with justifications) ... [cite: 500, 502, 296]

  private async ping(): Promise<boolean> {
    [cite_start]// ... (ping logic with timeout) ... [cite: 504]
  }

  private async startHealthMonitoring(): Promise<void> {
    [cite_start]// ... (logic to set interval and restart if ping fails) ... [cite: 506, 313]
  }
  
  [cite_start]// ... (restart, closeDocument, sendMessage methods) ... [cite: 508, 509, 510]
}
```

**[FLAG: NEW FILE / REPLACEMENT]**

  * **Files**: `src/host/0h.html`, `src/host/0h.js`, `src/host/iframe-factory.ts`
  * [cite\_start]**Reason**: These files form the core of the offscreen execution environment, replacing any existing stubs[cite: 512, 494].

<!-- end list -->

```html
[cite_start][cite: 513]
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script src="0h.js" type="module"></script></body></html>
```

```javascript
[cite_start]// src/host/0h.js (The script running inside the offscreen document) [cite: 514]
[cite_start]import { ProviderIframeManager } from './iframe-factory.js'; [cite: 514]

[cite_start]class OffscreenService { [cite: 514]
  [cite_start]// ... (constructor, init methods) ... [cite: 515]

  [cite_start]async handleMessage(message) { [cite: 517]
    [cite_start]switch (message.type) { [cite: 517]
      [cite_start]case 'htos.pow.ping': return { status: 'ok' }; [cite: 517]
      [cite_start]case 'htos.createProviderIframe': return await this.providerManager.createProviderIframe(...); [cite: 518]
      [cite_start]case 'htos.sendToProvider': return await this.providerManager.sendToProvider(...); [cite: 519]
      [cite_start]case 'htos.destroyProviderIframe': return this.providerManager.destroyProvider(...); [cite: 520]
      [cite_start]default: throw new Error(`[Offscreen] Unknown message type: ${message.type}`); [cite: 521]
    }
  }
}
[cite_start]new OffscreenService(); [cite: 521]
```

```typescript
[cite_start]// src/host/iframe-factory.ts (The manager for iframes *within* the offscreen doc) [cite: 522]
[cite_start]import { IProviderConfig } from '../types/provider'; [cite: 522]

[cite_start]export class ProviderIframeManager { [cite: 523]
  [cite_start]private iframes = new Map<string, HTMLIFrameElement>(); [cite: 523]

  [cite_start]async createProviderIframe(provider: string, config: IProviderConfig): Promise<string> { [cite: 524]
    [cite_start]// ... (logic to create, configure, and append an iframe) ... [cite: 524, 525]
  }

  [cite_start]async sendToProvider(iframeId: string, message: any): Promise<any> { [cite: 527]
    [cite_start]// ... (logic to post a message to an iframe and await a response with timeout) ... [cite: 527, 528]
  }

  [cite_start]destroyProvider(iframeId: string): void { [cite: 531]
    [cite_start]this.iframes.get(iframeId)?.remove(); [cite: 531]
    [cite_start]this.iframes.delete(iframeId); [cite: 531]
  }
}
```

**[FLAG: REPLACEMENT]**

  * **File to be Replaced**: `src/session-layer/token-extractor.ts`
  * [cite\_start]**Reason**: To use the new offscreen infrastructure instead of placeholder logic for secure and robust token extraction[cite: 532, 584].

<!-- end list -->

```typescript
[cite_start]// src/session-layer/token-extractor.ts [cite: 533]
[cite_start]import { HTOSStorage } from '../storage/idb'; [cite: 533]
[cite_start]import { OffscreenManager } from '../host/0h'; [cite: 533]

[cite_start]export async function extractTokenFromProvider(provider: string): Promise<string | null> { [cite: 533]
  [cite_start]const storage = new HTOSStorage(); [cite: 534]
  [cite_start]await storage.init(); [cite: 534]
  [cite_start]const config = await storage.getProviderConfig(provider); [cite: 534]
  [cite_start]if (!config) return null; [cite: 534]

  [cite_start]const existingToken = await storage.getToken(provider); [cite: 535]
  [cite_start]if (existingToken && existingToken.expires && existingToken.expires > Date.now()) { [cite: 535]
    [cite_start]return existingToken.token; [cite: 535]
  }

  [cite_start]const offscreenManager = OffscreenManager.getInstance(); [cite: 536]
  [cite_start]const iframeId = await offscreenManager.sendMessage('htos.createProviderIframe', { provider, config }); [cite: 536]
  
  [cite_start]try { [cite: 537]
    [cite_start]const response = await offscreenManager.sendMessage('htos.sendToProvider', { [cite: 537]
      [cite_start]iframeId, [cite: 537]
      [cite_start]message: { type: 'htos.extract.token', provider }, [cite: 537]
    });
    [cite_start]if (!response?.token) throw new Error('No token returned from iframe'); [cite: 538]
    
    [cite_start]await storage.setToken(provider, { [cite: 538]
      [cite_start]type: 'session', [cite: 538]
      [cite_start]token: response.token, [cite: 538]
      [cite_start]expires: Date.now() + 24 * 60 * 60 * 1000, [cite: 538]
    });
    [cite_start]return response.token; [cite: 539]
  [cite_start]} finally { [cite: 539]
    [cite_start]// Ensure the iframe is always cleaned up [cite: 539]
    [cite_start]await offscreenManager.sendMessage('htos.destroyProviderIframe', { iframeId }); [cite: 539]
  }
}
```

-----

### **Phase 4: Polish, Testing & Finalization**

[cite\_start]**Goal**: Ensure the system is robust, testable, secure, and ready for deployment[cite: 540].

  * [cite\_start]**Implement Comprehensive Error Handling (Additive)**: In `PromptDispatcher`, add retry logic with exponential backoff for failed provider requests[cite: 541]. [cite\_start]In `token-extractor.ts`, add more specific error catching[cite: 542].

  * [cite\_start]**Streaming Response Support (Additive)**: Enhance `ServiceWorkerBus` to handle and forward `chunk` events[cite: 543]. [cite\_start]The `ProviderAdapter`'s `sendPrompt` method must be updated to handle streaming `fetch` responses and post `chunk` messages[cite: 546].

  * [cite\_start]**Complete CSP Bypass Logic (Additive)**: Finalize logic in `DNRManager` to handle `htos.csp.allowOnce` messages by dynamically modifying response headers for specific requests[cite: 547].

  * [cite\_start]**Establish Testing Suite (New Files)**: Write Jest unit tests for `DNRManager`, `PromptDispatcher`, and `OffscreenManager`[cite: 548]. [cite\_start]Create Playwright/Puppeteer end-to-end tests for the full user flow[cite: 549].

  * **Final Configuration**

    **[FLAG: REPLACEMENT]**

      * **File to be Replaced**: `manifest.json`
      * [cite\_start]**Reason**: To include all necessary permissions and configurations for the full system, aligning with HARPA's proven manifest to ensure Chrome Store compliance[cite: 551, 802].

    <!-- end list -->

    ```json
    {
      [cite_start]"name": "HTOS", [cite: 872]
      [cite_start]"version": "1.0.0", [cite: 872]
      [cite_start]"manifest_version": 3, [cite: 872]
      [cite_start]"background": { [cite: 872]
        [cite_start]"service_worker": "sw.js", [cite: 872]
        [cite_start]"type": "module" [cite: 872]
      },
      [cite_start]"permissions": [ [cite: 872]
        [cite_start]"storage", [cite: 872]
        [cite_start]"tabs", [cite: 872]
        [cite_start]"offscreen", [cite: 872]
        [cite_start]"declarativeNetRequest", [cite: 872]
        [cite_start]"scripting", [cite: 872]
        [cite_start]"contextMenus", [cite: 872]
        [cite_start]"notifications", [cite: 872]
        [cite_start]"cookies", [cite: 872]
        [cite_start]"alarms", [cite: 872]
        [cite_start]"background" [cite: 872]
      ],
      [cite_start]"host_permissions": [ [cite: 873]
        [cite_start]"*://*.chatgpt.com/*", [cite: 873]
        [cite_start]"*://*.claude.ai/*", [cite: 873]
        [cite_start]"*://*.gemini.google.com/*" [cite: 873]
      ],
      [cite_start]"web_accessible_resources": [ [cite: 873]
        {
          [cite_start]"resources": [ [cite: 873]
            [cite_start]"host/0h.html", [cite: 873]
            [cite_start]"host/0h.js", [cite: 873]
            [cite_start]"host/iframe-factory.js" [cite: 873]
          ],
          [cite_start]"matches": ["*://*/*"] [cite: 873]
        }
      ]
    }
    ```

-----

### **Prioritization and Timeline**

  * [cite\_start]**Week 1-2: Phase 1 (DNR & Token)** - Priority is fixing the Claude issue and establishing reliable API access[cite: 554, 121].
  * [cite\_start]**Week 3-4: Phase 2 (Dispatch & Synthesis)** - Build the core engine to make the extension functional[cite: 555, 122].
  * [cite\_start]**Week 5-6: Phase 3 (Offscreen Infrastructure)** - Solidify the advanced, secure interaction patterns[cite: 556, 123].
  * [cite\_start]**Week 7-8: Phase 4 (Polish & Test)** - Ensure robustness, add streaming, and build a comprehensive test suite[cite: 557, 124].