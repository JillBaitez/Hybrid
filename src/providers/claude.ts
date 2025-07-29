/**
 * Claude Provider Configuration
 * Extracted from HARPA's exact implementation for compatibility
 */

export interface ClaudeModel {
  model: string;
  name: string;
  description: string;
  maxTokens: number;
}

export interface ClaudeEndpoint {
  path: string;
  payload?: {
    method: string;
    headers: Record<string, string>;
    body?: Record<string, any>;
  };
  response?: string;
}

export interface ClaudeConfig {
  models: ClaudeModel[];
  endpoints: Record<string, ClaudeEndpoint>;
}

/**
 * HARPA's exact Claude configuration
 * Copied from bg.js and pp.js for full compatibility
 */
export const CLAUDE_CONFIG: ClaudeConfig = {
  models: [
    {
      model: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      description: "Most intelligent model for complex tasks",
      maxTokens: 200000
    },
    {
      model: "claude-3-5-haiku-20241022", 
      name: "Claude 3.5 Haiku",
      description: "Fastest model for daily tasks",
      maxTokens: 200000
    }
  ],
  endpoints: {
    fetchOrgId: {
      path: "/api/organizations",
      response: "0.uuid"
    },
    createChat: {
      path: "/api/organizations/{{orgId}}/chat_conversations",
      payload: {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: {
          uuid: "{{chatId}}",
          name: "{{title}}"
        }
      }
    },
    ask: {
      path: "/api/organizations/{{orgId}}/chat_conversations/{{chatId}}/completion",
      payload: {
        method: "POST",
        headers: {
          "Accept": "text/event-stream, text/event-stream",
          "Content-Type": "application/json",
          "Origin": "https://claude.ai",
          "Referer": "https://claude.ai/{{chatId}}"
        },
        body: {
          attachments: "{{attachments}}",
          files: [],
          prompt: "{{text}}",
          model: "{{model}}",
          timezone: "{{timezone}}"
        }
      }
    },
    setChatTitle: {
      path: "/api/organizations/{{orgId}}/chat_conversations/{{chatId}}",
      payload: {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: {
          name: "{{title}}"
        }
      }
    },
    deleteChat: {
      path: "/api/organizations/{{orgId}}/chat_conversations/{{chatId}}",
      payload: {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: { chatId: "{{chatId}}" }
      }
    }
  }
};

/**
 * Claude Provider Adapter
 * Implements the IProviderAdapter interface using HARPA's configuration
 */
export class ClaudeProvider {
  private orgId: string | null = null;
  private chatId: string | null = null;
  
  constructor() {
    console.log('[Claude] Provider initialized with HARPA config');
  }

  /**
   * Fetch organization ID from Claude API
   * Required for all subsequent API calls
   */
  async fetchOrgId(): Promise<string> {
    if (this.orgId) return this.orgId;
    
    const response = await fetch(`https://claude.ai${CLAUDE_CONFIG.endpoints.fetchOrgId.path}`, {
      credentials: 'include'
    });
    
    if (response.status === 403) {
      throw new Error('Need to login to claude.ai');
    }
    
    const data = await response.json();
    this.orgId = data[0]?.uuid;
    
    if (!this.orgId) {
      throw new Error('Failed to fetch organization ID');
    }
    
    console.log('[Claude] Organization ID fetched:', this.orgId);
    return this.orgId;
  }

  /**
   * Create a new chat conversation
   */
  async createChat(title: string = 'HTOS Chat'): Promise<string> {
    const orgId = await this.fetchOrgId();
    const chatId = crypto.randomUUID();
    
    const endpoint = CLAUDE_CONFIG.endpoints.createChat;
    const url = `https://claude.ai${endpoint.path.replace('{{orgId}}', orgId)}`;
    
    const response = await fetch(url, {
      method: endpoint.payload!.method,
      headers: endpoint.payload!.headers,
      credentials: 'include',
      body: JSON.stringify({
        uuid: chatId,
        name: title
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create chat: ${response.status}`);
    }
    
    this.chatId = chatId;
    console.log('[Claude] Chat created:', chatId);
    return chatId;
  }

  /**
   * Send prompt to Claude using HARPA's exact configuration
   */
  async sendPrompt(text: string, model: string = 'claude-3-5-sonnet-20241022'): Promise<ReadableStream> {
    const orgId = await this.fetchOrgId();
    const chatId = this.chatId || await this.createChat();
    
    const endpoint = CLAUDE_CONFIG.endpoints.ask;
    const url = `https://claude.ai${endpoint.path
      .replace('{{orgId}}', orgId)
      .replace('{{chatId}}', chatId)}`;
    
    const headers = { ...endpoint.payload!.headers };
    headers['Referer'] = headers['Referer'].replace('{{chatId}}', chatId);
    
    const body = {
      attachments: [],
      files: [],
      prompt: text,
      model: model,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    
    console.log('[Claude] Sending prompt:', { url, model, text: text.substring(0, 100) + '...' });
    
    const response = await fetch(url, {
      method: endpoint.payload!.method,
      headers: headers,
      credentials: 'include',
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }
    
    if (!response.body) {
      throw new Error('No response body from Claude API');
    }
    
    return response.body;
  }
}
