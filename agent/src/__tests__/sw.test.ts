/**
 * DAY 6 - BUS IMPLEMENTATION TESTS
 * Unit test with fake offscreen document
 */

import { ServiceWorkerBus, MockOffscreenDocument } from './sw';
import { createBusMessage } from './events';
import { ProviderRegistry } from './ProviderRegistry';
import { stateManager } from './StateManager';
import { netRules } from './NetRules';

// Mock dependencies
jest.mock('./ProviderRegistry');
jest.mock('./StateManager');
jest.mock('./NetRules');

// Mock chrome APIs
global.chrome = {
  runtime: {
    getURL: jest.fn((path: string) => `chrome-extension://test-id/${path}`)
  }
} as any;

// Mock BroadcastChannel
class MockBroadcastChannel {
  private listeners: ((event: MessageEvent) => void)[] = [];
  private static channels: Map<string, MockBroadcastChannel[]> = new Map();

  constructor(public name: string) {
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, []);
    }
    MockBroadcastChannel.channels.get(name)!.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.listeners.push(listener);
    }
  }

  postMessage(data: any) {
    // Simulate broadcasting to other channels with the same name
    const channels = MockBroadcastChannel.channels.get(this.name) || [];
    setTimeout(() => {
      channels.forEach(channel => {
        if (channel !== this) {
          channel.listeners.forEach(listener => {
            listener({ data } as MessageEvent);
          });
        }
      });
    }, 0);
  }

  close() {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      const index = channels.indexOf(this);
      if (index > -1) {
        channels.splice(index, 1);
      }
    }
  }

  static reset() {
    this.channels.clear();
  }
}

global.BroadcastChannel = MockBroadcastChannel as any;

describe('ServiceWorkerBus', () => {
  let swBus: ServiceWorkerBus;
  let mockOffscreen: MockOffscreenDocument;
  let mockProviderRegistry: jest.Mocked<typeof ProviderRegistry>;
  let mockStateManager: jest.Mocked<typeof stateManager>;
  let mockNetRules: jest.Mocked<typeof netRules>;

  beforeEach(async () => {
    // Reset broadcast channels
    MockBroadcastChannel.reset();

    // Setup mocks
    mockProviderRegistry = ProviderRegistry as jest.Mocked<typeof ProviderRegistry>;
    mockStateManager = stateManager as jest.Mocked<typeof stateManager>;
    mockNetRules = netRules as jest.Mocked<typeof netRules>;

    mockNetRules.init.mockResolvedValue();
    mockStateManager.hydrate.mockResolvedValue();
    mockProviderRegistry.isProviderAvailable.mockReturnValue(true);

    // Create instances
    swBus = new ServiceWorkerBus();
    mockOffscreen = new MockOffscreenDocument();

    // Initialize
    await swBus.init();
  });

  afterEach(() => {
    swBus.destroy();
    mockOffscreen.destroy();
    MockBroadcastChannel.reset();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('initializes successfully', async () => {
      expect(mockNetRules.init).toHaveBeenCalled();
      expect(mockStateManager.hydrate).toHaveBeenCalled();
      expect(swBus.isHealthy).toBe(true);
    });

    test('prevents double initialization', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await swBus.init(); // Second initialization
      
      expect(consoleSpy).toHaveBeenCalledWith('ServiceWorkerBus: Already initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('Ask Event Handling', () => {
    test('handles ask event and streams response', async () => {
      // Mock streaming response
      async function* mockStream() {
        yield 'Hello';
        yield ' ';
        yield 'world';
      }
      mockProviderRegistry.ask.mockReturnValue(mockStream());

      // Send ask request
      const requestId = mockOffscreen.sendAsk('openai', 'Test prompt');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      const responses = mockOffscreen.getResponses();
      
      // Should receive chunk messages and done message
      const chunks = responses.filter(r => r.type === 'chunk');
      const done = responses.find(r => r.type === 'done');

      expect(chunks.length).toBe(3); // 'Hello', ' ', 'world'
      expect(chunks[0].payload.data).toBe('Hello');
      expect(chunks[1].payload.data).toBe(' ');
      expect(chunks[2].payload.data).toBe('world');
      
      expect(done).toBeDefined();
      expect(done?.payload.id).toBe(requestId);
      expect(done?.payload.error).toBeUndefined();
      expect(done?.payload.usage).toBeDefined();
    });

    test('handles provider unavailable error', async () => {
      mockProviderRegistry.isProviderAvailable.mockReturnValue(false);

      const requestId = mockOffscreen.sendAsk('openai', 'Test prompt');
      
      await new Promise(resolve => setTimeout(resolve, 50));

      const responses = mockOffscreen.getResponses();
      const done = responses.find(r => r.type === 'done');

      expect(done).toBeDefined();
      expect(done?.payload.error).toContain('not available');
    });

    test('handles provider error during streaming', async () => {
      async function* mockErrorStream() {
        yield 'Hello';
        throw new Error('Provider error');
      }
      mockProviderRegistry.ask.mockReturnValue(mockErrorStream());

      const requestId = mockOffscreen.sendAsk('openai', 'Test prompt');
      
      await new Promise(resolve => setTimeout(resolve, 50));

      const responses = mockOffscreen.getResponses();
      const chunks = responses.filter(r => r.type === 'chunk');
      const done = responses.find(r => r.type === 'done');

      expect(chunks.length).toBe(1); // Only 'Hello' before error
      expect(done?.payload.error).toBe('Provider error');
    });

    test('cancels active request', async () => {
      // Mock long-running stream
      async function* mockLongStream() {
        for (let i = 0; i < 100; i++) {
          yield `chunk ${i}`;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      mockProviderRegistry.ask.mockReturnValue(mockLongStream());

      const requestId = mockOffscreen.sendAsk('openai', 'Test prompt');
      
      // Wait a bit then cancel
      await new Promise(resolve => setTimeout(resolve, 20));
      const cancelled = swBus.cancelRequest(requestId);

      expect(cancelled).toBe(true);
      expect(swBus.activeRequestCount).toBe(0);
    });
  });

  describe('BlobIdToObjectUrl Event Handling', () => {
    test('handles blob URL generation', async () => {
      const requestId = mockOffscreen.sendBlobRequest('test-blob-123');
      
      await new Promise(resolve => setTimeout(resolve, 50));

      const responses = mockOffscreen.getResponses();
      const chunk = responses.find(r => r.type === 'chunk');
      const done = responses.find(r => r.type === 'done');

      expect(chunk).toBeDefined();
      expect(chunk?.payload.data).toBe('chrome-extension://test-id/_blob/test-blob-123');
      
      expect(done).toBeDefined();
      expect(done?.payload.error).toBeUndefined();
    });
  });

  describe('Message Broadcasting', () => {
    test('broadcasts messages to offscreen document', async () => {
      swBus.broadcast('chunk', { id: 'test-123', data: 'test data' });
      
      await new Promise(resolve => setTimeout(resolve, 10));

      const responses = mockOffscreen.getResponses();
      expect(responses.length).toBe(1);
      expect(responses[0].type).toBe('chunk');
      expect(responses[0].payload.data).toBe('test data');
    });
  });

  describe('Request Management', () => {
    test('tracks active requests', async () => {
      // Mock slow stream
      async function* mockSlowStream() {
        await new Promise(resolve => setTimeout(resolve, 100));
        yield 'slow response';
      }
      mockProviderRegistry.ask.mockReturnValue(mockSlowStream());

      expect(swBus.activeRequestCount).toBe(0);
      
      mockOffscreen.sendAsk('openai', 'Test prompt');
      
      // Check immediately after sending
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(swBus.activeRequestCount).toBe(1);
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(swBus.activeRequestCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('handles invalid messages gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Send invalid message through BroadcastChannel
      const channel = new (BroadcastChannel as any)('bus.channel');
      channel.postMessage(null);
      channel.postMessage('invalid');
      channel.postMessage({ type: 'unknown', payload: {} });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleSpy).toHaveBeenCalledWith('ServiceWorkerBus: Invalid message received', null);
      expect(consoleSpy).toHaveBeenCalledWith('ServiceWorkerBus: Invalid message received', 'invalid');
      expect(consoleSpy).toHaveBeenCalledWith('ServiceWorkerBus: No handler for message type: unknown');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    test('destroys cleanly', () => {
      const initialRequestCount = swBus.activeRequestCount;
      
      swBus.destroy();
      
      expect(swBus.isHealthy).toBe(false);
      expect(swBus.activeRequestCount).toBe(0);
    });
  });
});

describe('MockOffscreenDocument', () => {
  let mockOffscreen: MockOffscreenDocument;

  beforeEach(() => {
    MockBroadcastChannel.reset();
    mockOffscreen = new MockOffscreenDocument();
  });

  afterEach(() => {
    mockOffscreen.destroy();
    MockBroadcastChannel.reset();
  });

  test('sends ask messages correctly', () => {
    const requestId = mockOffscreen.sendAsk('openai', 'test prompt');
    
    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);
  });

  test('sends blob requests correctly', () => {
    const requestId = mockOffscreen.sendBlobRequest('blob-123');
    
    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);
  });

  test('collects responses', async () => {
    // Simulate receiving responses
    const channel = new (BroadcastChannel as any)('bus.channel');
    channel.postMessage({ type: 'chunk', payload: { id: 'test', data: 'data' } });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const responses = mockOffscreen.getResponses();
    expect(responses.length).toBe(1);
    expect(responses[0].type).toBe('chunk');
  });

  test('clears responses', async () => {
    // Add some responses
    const channel = new (BroadcastChannel as any)('bus.channel');
    channel.postMessage({ type: 'chunk', payload: { id: 'test', data: 'data' } });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockOffscreen.getResponses().length).toBe(1);
    
    mockOffscreen.clearResponses();
    expect(mockOffscreen.getResponses().length).toBe(0);
  });
});