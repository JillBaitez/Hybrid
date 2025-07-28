/**
 * DAY 4 - PROVIDER ADAPTERS
 * Factory returning adapters: openai, claude, gemini
 * Each adapter exports one function: ask(prompt: string, stream: boolean): AsyncIterable<string>
 */

import { stateManager } from './StateManager';
import { netRules } from './NetRules';

// Provider adapter interface
export interface ProviderAdapter {
  ask(prompt: string, stream: boolean): AsyncIterable<string>;
  name: string;
  endpoint: string;
}

// Provider configuration
interface ProviderConfig {
  name: string;
  endpoint: string;
  headers: Record<string, string>;
  authTokenKey: string;
}

// Provider configurations for text-only endpoints
const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    name: 'OpenAI ChatGPT',
    endpoint: 'https://chat.openai.com/backend-api/conversation',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    authTokenKey: 'chatgpt'
  },
  claude: {
    name: 'Anthropic Claude', 
    endpoint: 'https://claude.ai/api/organizations/*/chat_conversations/*/completion',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    authTokenKey: 'claude'
  },
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/plain'
    },
    authTokenKey: 'gemini'
  }
};

// Base adapter implementation
abstract class BaseAdapter implements ProviderAdapter {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  get name(): string {
    return this.config.name;
  }

  get endpoint(): string {
    return this.config.endpoint;
  }

  abstract ask(prompt: string, stream: boolean): AsyncIterable<string>;

  protected async makeRequest(url: string, options: RequestInit): Promise<Response> {
    // Get auth token from state manager
    const token = stateManager.getToken(this.config.authTokenKey);
    if (!token) {
      throw new Error(`No auth token found for ${this.config.name}`);
    }

    // Merge headers with auth
    const headers = {
      ...this.config.headers,
      ...options.headers
    };

    // Add provider-specific auth
    if (this.config.authTokenKey === 'chatgpt') {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (this.config.authTokenKey === 'claude') {
      headers['Cookie'] = `sessionKey=${token}`;
    } else if (this.config.authTokenKey === 'gemini') {
      headers['Cookie'] = `__Secure-1PSID=${token}`;
    }

    return fetch(url, {
      ...options,
      headers
    });
  }

  protected async* parseStreamResponse(response: Response): AsyncIterable<string> {
    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('data: [DONE]')) {
            const chunk = this.parseChunk(trimmed);
            if (chunk) {
              yield chunk;
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const chunk = this.parseChunk(buffer.trim());
        if (chunk) {
          yield chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  protected abstract parseChunk(line: string): string | null;
}

// OpenAI ChatGPT Adapter
class OpenAIAdapter extends BaseAdapter {
  async* ask(prompt: string, stream: boolean): AsyncIterable<string> {
    const payload = {
      action: 'next',
      messages: [{
        id: crypto.randomUUID(),
        author: { role: 'user' },
        content: { content_type: 'text', parts: [prompt] }
      }],
      model: 'text-davinci-002-render-sha',
      stream
    };

    const response = await this.makeRequest(this.endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
    }

    if (stream) {
      yield* this.parseStreamResponse(response);
    } else {
      const data = await response.json();
      yield data.message?.content?.parts?.[0] || '';
    }
  }

  protected parseChunk(line: string): string | null {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        return data.message?.content?.parts?.[0] || null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Claude Adapter
class ClaudeAdapter extends BaseAdapter {
  async* ask(prompt: string, stream: boolean): AsyncIterable<string> {
    const payload = {
      prompt,
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      stream
    };

    const response = await this.makeRequest(this.endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Claude request failed: ${response.status} ${response.statusText}`);
    }

    if (stream) {
      yield* this.parseStreamResponse(response);
    } else {
      const data = await response.json();
      yield data.completion || '';
    }
  }

  protected parseChunk(line: string): string | null {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        return data.completion || null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Gemini Adapter
class GeminiAdapter extends BaseAdapter {
  async* ask(prompt: string, stream: boolean): AsyncIterable<string> {
    const payload = new URLSearchParams({
      'f.req': JSON.stringify([[prompt]]),
      'at': stateManager.getToken('gemini') || ''
    });

    const response = await this.makeRequest(this.endpoint, {
      method: 'POST',
      body: payload.toString()
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status} ${response.statusText}`);
    }

    if (stream) {
      yield* this.parseStreamResponse(response);
    } else {
      const text = await response.text();
      const match = text.match(/"([^"]*)/);
      yield match?.[1] || '';
    }
  }

  protected parseChunk(line: string): string | null {
    try {
      // Gemini returns JSON-like responses
      const match = line.match(/"([^"]*)/);
      return match?.[1] || null;
    } catch {
      return null;
    }
  }
}

// Provider Registry
export class ProviderRegistry {
  private static adapters: Map<string, ProviderAdapter> = new Map();

  static {
    // Initialize adapters
    this.adapters.set('openai', new OpenAIAdapter(PROVIDER_CONFIGS.openai));
    this.adapters.set('claude', new ClaudeAdapter(PROVIDER_CONFIGS.claude));
    this.adapters.set('gemini', new GeminiAdapter(PROVIDER_CONFIGS.gemini));
  }

  /**
   * Get provider adapter by name
   */
  static getAdapter(provider: string): ProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  /**
   * Get all available provider names
   */
  static getProviderNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Ask a provider with prompt
   */
  static async* ask(provider: string, prompt: string, stream = true): AsyncIterable<string> {
    const adapter = this.getAdapter(provider);
    if (!adapter) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    yield* adapter.ask(prompt, stream);
  }

  /**
   * Check if provider is available (has auth token)
   */
  static isProviderAvailable(provider: string): boolean {
    const adapter = this.getAdapter(provider);
    if (!adapter) return false;

    const config = PROVIDER_CONFIGS[provider];
    return !!stateManager.getToken(config.authTokenKey);
  }

  /**
   * Get provider configuration
   */
  static getProviderConfig(provider: string): ProviderConfig | undefined {
    return PROVIDER_CONFIGS[provider];
  }
}

// Export singleton instance methods
export const providerRegistry = {
  getAdapter: ProviderRegistry.getAdapter.bind(ProviderRegistry),
  getProviderNames: ProviderRegistry.getProviderNames.bind(ProviderRegistry),
  ask: ProviderRegistry.ask.bind(ProviderRegistry),
  isProviderAvailable: ProviderRegistry.isProviderAvailable.bind(ProviderRegistry),
  getProviderConfig: ProviderRegistry.getProviderConfig.bind(ProviderRegistry)
};