/**
 * DAY 2 - STATE SKELETON TESTS
 * Unit tests for StateManager hydrate/mutate/persist round-trip
 */

import { StateManager, Chat, Message } from './StateManager';

// Mock Chrome storage APIs
const mockSessionStorage = new Map();
const mockLocalStorage = new Map();

global.chrome = {
  storage: {
    session: {
      get: jest.fn((keys: string[]) => {
        const result: any = {};
        keys.forEach(key => {
          if (mockSessionStorage.has(key)) {
            result[key] = mockSessionStorage.get(key);
          }
        });
        return Promise.resolve(result);
      }),
      set: jest.fn((items: any) => {
        Object.entries(items).forEach(([key, value]) => {
          mockSessionStorage.set(key, value);
        });
        return Promise.resolve();
      })
    },
    local: {
      get: jest.fn((keys: string[]) => {
        const result: any = {};
        keys.forEach(key => {
          if (mockLocalStorage.has(key)) {
            result[key] = mockLocalStorage.get(key);
          }
        });
        return Promise.resolve(result);
      }),
      set: jest.fn((items: any) => {
        Object.entries(items).forEach(([key, value]) => {
          mockLocalStorage.set(key, value);
        });
        return Promise.resolve();
      })
    }
  }
} as any;

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    // Clear mock storage
    mockSessionStorage.clear();
    mockLocalStorage.clear();
    
    // Create fresh StateManager instance
    stateManager = new StateManager();
  });

  describe('Chat Operations', () => {
    test('addChat and getChat', () => {
      const chat: Chat = {
        id: 'chat-1',
        provider: 'chatgpt',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      stateManager.addChat(chat);
      expect(stateManager.getChat('chat-1')).toEqual(chat);
    });

    test('updateChat', () => {
      const chat: Chat = {
        id: 'chat-1',
        provider: 'chatgpt',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      stateManager.addChat(chat);
      
      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      };

      stateManager.updateChat('chat-1', { messages: [message] });
      
      const updatedChat = stateManager.getChat('chat-1');
      expect(updatedChat?.messages).toEqual([message]);
    });

    test('deleteChat', () => {
      const chat: Chat = {
        id: 'chat-1',
        provider: 'chatgpt',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      stateManager.addChat(chat);
      expect(stateManager.getChat('chat-1')).toEqual(chat);
      
      const deleted = stateManager.deleteChat('chat-1');
      expect(deleted).toBe(true);
      expect(stateManager.getChat('chat-1')).toBeUndefined();
    });
  });

  describe('Token Operations', () => {
    test('setToken and getToken', () => {
      stateManager.setToken('chatgpt', 'token-123');
      expect(stateManager.getToken('chatgpt')).toBe('token-123');
    });

    test('deleteToken', () => {
      stateManager.setToken('chatgpt', 'token-123');
      expect(stateManager.getToken('chatgpt')).toBe('token-123');
      
      const deleted = stateManager.deleteToken('chatgpt');
      expect(deleted).toBe(true);
      expect(stateManager.getToken('chatgpt')).toBeUndefined();
    });
  });

  describe('Cursor Operations', () => {
    test('setCursor and getCursor', () => {
      stateManager.setCursor('claude', 'cursor-abc');
      expect(stateManager.getCursor('claude')).toBe('cursor-abc');
    });

    test('deleteCursor', () => {
      stateManager.setCursor('claude', 'cursor-abc');
      expect(stateManager.getCursor('claude')).toBe('cursor-abc');
      
      const deleted = stateManager.deleteCursor('claude');
      expect(deleted).toBe(true);
      expect(stateManager.getCursor('claude')).toBeUndefined();
    });
  });

  describe('Persistence Round-Trip', () => {
    test('hydrate/mutate/persist round-trip for chats', async () => {
      // Setup initial data
      const chat: Chat = {
        id: 'chat-1',
        provider: 'chatgpt',
        messages: [{
          id: 'msg-1',
          role: 'user',
          content: 'Hello world',
          timestamp: new Date()
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add chat (triggers persist)
      stateManager.addChat(chat);

      // Verify persistence was called
      expect(chrome.storage.session.set).toHaveBeenCalled();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      // Create new StateManager instance to test hydration
      const newStateManager = new StateManager();
      await newStateManager.hydrate();

      // Verify data was restored
      const restoredChat = newStateManager.getChat('chat-1');
      expect(restoredChat?.id).toBe(chat.id);
      expect(restoredChat?.provider).toBe(chat.provider);
      expect(restoredChat?.messages).toHaveLength(1);
    });

    test('hydrate/mutate/persist round-trip for tokens', async () => {
      // Add token (triggers persist)
      stateManager.setToken('chatgpt', 'secret-token-123');

      // Verify persistence was called
      expect(chrome.storage.session.set).toHaveBeenCalled();

      // Create new StateManager instance to test hydration
      const newStateManager = new StateManager();
      await newStateManager.hydrate();

      // Verify token was restored (from session storage only)
      expect(newStateManager.getToken('chatgpt')).toBe('secret-token-123');
    });

    test('hydrate/mutate/persist round-trip for cursors', async () => {
      // Add cursor (triggers persist)
      stateManager.setCursor('claude', 'page-cursor-xyz');

      // Verify persistence was called
      expect(chrome.storage.session.set).toHaveBeenCalled();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      // Create new StateManager instance to test hydration
      const newStateManager = new StateManager();
      await newStateManager.hydrate();

      // Verify cursor was restored
      expect(newStateManager.getCursor('claude')).toBe('page-cursor-xyz');
    });

    test('session storage takes precedence over local storage', async () => {
      // Setup conflicting data in session vs local storage
      mockSessionStorage.set('htos_cursors_session', [['claude', 'session-cursor']]);
      mockLocalStorage.set('htos_cursors_persistent', [['claude', 'local-cursor']]);

      // Create new StateManager and hydrate
      const newStateManager = new StateManager();
      await newStateManager.hydrate();

      // Session storage should take precedence
      expect(newStateManager.getCursor('claude')).toBe('session-cursor');
    });
  });

  describe('Utility Methods', () => {
    test('getState returns copies of all slices', () => {
      // Add some data
      const chat: Chat = {
        id: 'chat-1',
        provider: 'chatgpt',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      stateManager.addChat(chat);
      stateManager.setToken('chatgpt', 'token-123');
      stateManager.setCursor('claude', 'cursor-abc');

      // Get state
      const state = stateManager.getState();

      // Verify all slices are present
      expect(state.chats.has('chat-1')).toBe(true);
      expect(state.tokens.has('chatgpt')).toBe(true);
      expect(state.cursors.has('claude')).toBe(true);

      // Verify they are copies (not references)
      expect(state.chats).not.toBe(stateManager.chats);
      expect(state.tokens).not.toBe(stateManager.tokens);
      expect(state.cursors).not.toBe(stateManager.cursors);
    });

    test('clear removes all data', () => {
      // Add some data
      const chat: Chat = {
        id: 'chat-1',
        provider: 'chatgpt',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      stateManager.addChat(chat);
      stateManager.setToken('chatgpt', 'token-123');
      stateManager.setCursor('claude', 'cursor-abc');

      // Verify data exists
      expect(stateManager.chats.size).toBe(1);
      expect(stateManager.tokens.size).toBe(1);
      expect(stateManager.cursors.size).toBe(1);

      // Clear all data
      stateManager.clear();

      // Verify all data is gone
      expect(stateManager.chats.size).toBe(0);
      expect(stateManager.tokens.size).toBe(0);
      expect(stateManager.cursors.size).toBe(0);
    });
  });
});