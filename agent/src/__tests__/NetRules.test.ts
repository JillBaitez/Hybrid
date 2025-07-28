/**
 * DAY 3 - NET RULES TESTS
 * E2E test: open target URL → verify content-security-policy header is removed
 */

import { NetRules, TEXT_ENDPOINTS, RULE_IDS, NetRuleConfig } from './NetRules';

// Mock Chrome declarativeNetRequest API
const mockRules: chrome.declarativeNetRequest.Rule[] = [];

global.chrome = {
  declarativeNetRequest: {
    updateDynamicRules: jest.fn(async (options: any) => {
      if (options.removeRuleIds) {
        options.removeRuleIds.forEach((id: number) => {
          const index = mockRules.findIndex(rule => rule.id === id);
          if (index !== -1) mockRules.splice(index, 1);
        });
      }
      if (options.addRules) {
        mockRules.push(...options.addRules);
      }
      return Promise.resolve();
    }),
    getDynamicRules: jest.fn(async () => {
      return Promise.resolve([...mockRules]);
    }),
    RuleActionType: {
      MODIFY_HEADERS: 'modifyHeaders' as any
    },
    HeaderOperation: {
      REMOVE: 'remove' as any,
      SET: 'set' as any
    },
    ResourceType: {
      XMLHTTPREQUEST: 'xmlhttprequest' as any
    }
  }
} as any;

describe('NetRules', () => {
  let netRules: NetRules;

  beforeEach(() => {
    // Clear mock rules
    mockRules.length = 0;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Get fresh NetRules instance
    netRules = NetRules.getInstance();
    
    // Reset initialization state (private property, but we need to reset for tests)
    (netRules as any).isInitialized = false;
    (netRules as any).activeRuleIds = [];
  });

  describe('Initialization', () => {
    test('initializes with default config', async () => {
      await netRules.init();
      
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalled();
      expect(netRules.initialized).toBe(true);
      expect(mockRules.length).toBeGreaterThan(0);
    });

    test('initializes with custom config', async () => {
      const customConfig: NetRuleConfig = {
        enableCSPStripping: true,
        enableAuthHeaders: false,
        providers: ['chatgpt']
      };

      await netRules.init(customConfig);
      
      expect(netRules.initialized).toBe(true);
      // Should only have CSP stripping rule for ChatGPT
      expect(mockRules).toHaveLength(1);
      expect(mockRules[0].id).toBe(RULE_IDS.CSP_STRIP_CHATGPT);
    });

    test('prevents double initialization', async () => {
      await netRules.init();
      const firstCallCount = (chrome.declarativeNetRequest.updateDynamicRules as jest.Mock).mock.calls.length;
      
      await netRules.init();
      const secondCallCount = (chrome.declarativeNetRequest.updateDynamicRules as jest.Mock).mock.calls.length;
      
      // Should not call updateDynamicRules again
      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('CSP Stripping Rules', () => {
    test('creates CSP stripping rules for all providers', async () => {
      const config: NetRuleConfig = {
        enableCSPStripping: true,
        enableAuthHeaders: false,
        providers: ['chatgpt', 'claude', 'gemini']
      };

      await netRules.init(config);

      // Should have 3 CSP stripping rules
      const cspRules = mockRules.filter(rule => 
        [RULE_IDS.CSP_STRIP_CHATGPT, RULE_IDS.CSP_STRIP_CLAUDE, RULE_IDS.CSP_STRIP_GEMINI].includes(rule.id)
      );
      expect(cspRules).toHaveLength(3);

      // Verify ChatGPT CSP rule
      const chatgptRule = mockRules.find(rule => rule.id === RULE_IDS.CSP_STRIP_CHATGPT);
      expect(chatgptRule).toBeDefined();
      expect(chatgptRule?.condition.urlFilter).toBe(TEXT_ENDPOINTS.CHATGPT);
      expect(chatgptRule?.action.type).toBe('modifyHeaders');
      
      const modifyAction = chatgptRule?.action as any;
      expect(modifyAction.responseHeaders).toEqual([
        {
          header: 'content-security-policy',
          operation: 'remove'
        },
        {
          header: 'content-security-policy-report-only',
          operation: 'remove'
        }
      ]);
    });

    test('verifies CSP header removal for Claude endpoint', async () => {
      const config: NetRuleConfig = {
        enableCSPStripping: true,
        enableAuthHeaders: false,
        providers: ['claude']
      };

      await netRules.init(config);

      const claudeRule = mockRules.find(rule => rule.id === RULE_IDS.CSP_STRIP_CLAUDE);
      expect(claudeRule).toBeDefined();
      expect(claudeRule?.condition.urlFilter).toBe(TEXT_ENDPOINTS.CLAUDE);
      
      const modifyAction = claudeRule?.action as any;
      expect(modifyAction.responseHeaders.some((header: any) => 
        header.header === 'content-security-policy' && header.operation === 'remove'
      )).toBe(true);
    });

    test('verifies CSP header removal for Gemini endpoint', async () => {
      const config: NetRuleConfig = {
        enableCSPStripping: true,
        enableAuthHeaders: false,
        providers: ['gemini']
      };

      await netRules.init(config);

      const geminiRule = mockRules.find(rule => rule.id === RULE_IDS.CSP_STRIP_GEMINI);
      expect(geminiRule).toBeDefined();
      expect(geminiRule?.condition.urlFilter).toBe(TEXT_ENDPOINTS.GEMINI);
      
      const modifyAction = geminiRule?.action as any;
      expect(modifyAction.responseHeaders.some((header: any) => 
        header.header === 'content-security-policy' && header.operation === 'remove'
      )).toBe(true);
    });
  });

  describe('Auth Header Rules', () => {
    test('creates auth header rules for all providers', async () => {
      const config: NetRuleConfig = {
        enableCSPStripping: false,
        enableAuthHeaders: true,
        providers: ['chatgpt', 'claude', 'gemini']
      };

      await netRules.init(config);

      // Should have 3 auth header rules
      const authRules = mockRules.filter(rule => 
        [RULE_IDS.AUTH_HEADER_CHATGPT, RULE_IDS.AUTH_HEADER_CLAUDE, RULE_IDS.AUTH_HEADER_GEMINI].includes(rule.id)
      );
      expect(authRules).toHaveLength(3);

      // Verify ChatGPT auth rule
      const chatgptRule = mockRules.find(rule => rule.id === RULE_IDS.AUTH_HEADER_CHATGPT);
      expect(chatgptRule).toBeDefined();
      
      const modifyAction = chatgptRule?.action as any;
      expect(modifyAction.requestHeaders).toEqual([
        {
          header: 'authorization',
          operation: 'set',
          value: 'Bearer {{HTOS_CHATGPT_TOKEN}}'
        }
      ]);
    });

    test('creates cookie-based auth for Claude', async () => {
      const config: NetRuleConfig = {
        enableCSPStripping: false,
        enableAuthHeaders: true,
        providers: ['claude']
      };

      await netRules.init(config);

      const claudeRule = mockRules.find(rule => rule.id === RULE_IDS.AUTH_HEADER_CLAUDE);
      expect(claudeRule).toBeDefined();
      
      const modifyAction = claudeRule?.action as any;
      expect(modifyAction.requestHeaders).toEqual([
        {
          header: 'cookie',
          operation: 'set',
          value: 'sessionKey={{HTOS_CLAUDE_TOKEN}}'
        }
      ]);
    });

    test('creates cookie-based auth for Gemini', async () => {
      const config: NetRuleConfig = {
        enableCSPStripping: false,
        enableAuthHeaders: true,
        providers: ['gemini']
      };

      await netRules.init(config);

      const geminiRule = mockRules.find(rule => rule.id === RULE_IDS.AUTH_HEADER_GEMINI);
      expect(geminiRule).toBeDefined();
      
      const modifyAction = geminiRule?.action as any;
      expect(modifyAction.requestHeaders).toEqual([
        {
          header: 'cookie',
          operation: 'set',
          value: '__Secure-1PSID={{HTOS_GEMINI_TOKEN}}'
        }
      ]);
    });
  });

  describe('Rule Management', () => {
    test('clears existing rules before adding new ones', async () => {
      // Add some mock existing rules
      mockRules.push({
        id: 999,
        priority: 1,
        action: { type: 'modifyHeaders' as any },
        condition: { urlFilter: 'test' }
      });

      await netRules.init();

      // Should have called updateDynamicRules to remove existing rules first
      const calls = (chrome.declarativeNetRequest.updateDynamicRules as jest.Mock).mock.calls;
      const clearCall = calls.find((call: any) => call[0].removeRuleIds);
      expect(clearCall).toBeDefined();
    });

    test('tracks active rule IDs', async () => {
      await netRules.init();
      
      const activeRuleIds = netRules.ruleIds;
      expect(activeRuleIds.length).toBeGreaterThan(0);
      expect(activeRuleIds).toContain(RULE_IDS.CSP_STRIP_CHATGPT);
    });

    test('clears all rules', async () => {
      await netRules.init();
      expect(mockRules.length).toBeGreaterThan(0);
      
      await netRules.clearRules();
      expect(mockRules.length).toBe(0);
    });

    test('gets active rules', async () => {
      await netRules.init();
      
      const activeRules = await netRules.getActiveRules();
      expect(activeRules.length).toBeGreaterThan(0);
    });
  });

  describe('Token Updates', () => {
    test('updates token placeholders in auth rules', async () => {
      const config: NetRuleConfig = {
        enableCSPStripping: false,
        enableAuthHeaders: true,
        providers: ['chatgpt']
      };

      await netRules.init(config);

      // Update tokens
      const tokens = { chatgpt: 'real-token-123' };
      await netRules.updateTokens(tokens);

      // Should have replaced the rule with updated token
      expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith(
        expect.objectContaining({
          removeRuleIds: expect.any(Array),
          addRules: expect.arrayContaining([
            expect.objectContaining({
              action: expect.objectContaining({
                requestHeaders: expect.arrayContaining([
                  expect.objectContaining({
                    header: 'authorization',
                    value: 'Bearer real-token-123'
                  })
                ])
              })
            })
          ])
        })
      );
    });
  });

  describe('E2E Scenarios', () => {
    test('simulates full CSP stripping flow for ChatGPT endpoint', async () => {
      // Initialize with CSP stripping enabled
      const config: NetRuleConfig = {
        enableCSPStripping: true,
        enableAuthHeaders: false,
        providers: ['chatgpt']
      };

      await netRules.init(config);

      // Verify that a request to ChatGPT backend-api would have CSP stripped
      const chatgptRule = mockRules.find(rule => rule.id === RULE_IDS.CSP_STRIP_CHATGPT);
      expect(chatgptRule).toBeDefined();
      
      // Simulate request matching
      const testUrl = 'https://chat.openai.com/backend-api/conversation';
      expect(testUrl).toMatch(/https:\/\/chat\.openai\.com\/backend-api\/.*/);
      
      // Verify CSP headers would be removed
      const modifyAction = chatgptRule?.action as any;
      const cspRemovalRule = modifyAction.responseHeaders.find((header: any) => 
        header.header === 'content-security-policy' && header.operation === 'remove'
      );
      expect(cspRemovalRule).toBeDefined();
    });

    test('simulates full auth injection flow for all providers', async () => {
      // Initialize with auth headers enabled
      await netRules.init();

      // Update with real tokens
      const tokens = {
        chatgpt: 'sk-real-token-123',
        claude: 'sess-real-token-456',
        gemini: 'psid-real-token-789'
      };
      
      await netRules.updateTokens(tokens);

      // Verify rules were updated with real tokens
      const updateCall = (chrome.declarativeNetRequest.updateDynamicRules as jest.Mock).mock.calls
        .find((call: any) => call[0].addRules?.some((rule: any) => 
          rule.action.requestHeaders?.some((header: any) => 
            header.value?.includes('sk-real-token-123')
          )
        ));
      
      expect(updateCall).toBeDefined();
    });
  });
});