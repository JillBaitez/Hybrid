/**
 * DAY 2 - STATE SKELETON
 * MobX store with three slices + Chrome storage persistence
 */

// Type definitions for the state slices
export interface Chat {
  id: string;
  provider: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface StateSlices {
  chats: Map<string, Chat>;
  tokens: Map<string, string>;  // opaque blobs
  cursors: Map<string, string>; // provider page cursors
}

export class StateManager {
  // Three core slices
  public chats: Map<string, Chat> = new Map();
  public tokens: Map<string, string> = new Map();
  public cursors: Map<string, string> = new Map();

  // Storage keys
  private static readonly STORAGE_KEYS = {
    CHATS_SESSION: 'htos_chats_session',
    CHATS_PERSISTENT: 'htos_chats_persistent', 
    TOKENS_SESSION: 'htos_tokens_session',
    TOKENS_PERSISTENT: 'htos_tokens_persistent',
    CURSORS_SESSION: 'htos_cursors_session',
    CURSORS_PERSISTENT: 'htos_cursors_persistent'
  };

  constructor() {
    this.initialize();
  }

  /**
   * Initialize state manager - hydrate from storage
   */
  private async initialize(): Promise<void> {
    await this.hydrate();
  }

  /**
   * Hydrate state from Chrome storage (session + local)
   */
  public async hydrate(): Promise<void> {
    try {
      // Load from session storage (volatile)
      const sessionData = await chrome.storage.session.get([
        StateManager.STORAGE_KEYS.CHATS_SESSION,
        StateManager.STORAGE_KEYS.TOKENS_SESSION,
        StateManager.STORAGE_KEYS.CURSORS_SESSION
      ]);

      // Load from local storage (persistent)
      const localData = await chrome.storage.local.get([
        StateManager.STORAGE_KEYS.CHATS_PERSISTENT,
        StateManager.STORAGE_KEYS.TOKENS_PERSISTENT,
        StateManager.STORAGE_KEYS.CURSORS_PERSISTENT
      ]);

      // Hydrate chats (prefer session, fallback to local)
      const chatsData = sessionData[StateManager.STORAGE_KEYS.CHATS_SESSION] || 
                       localData[StateManager.STORAGE_KEYS.CHATS_PERSISTENT] || 
                       [];
      this.chats = new Map(chatsData.map((chat: Chat) => [chat.id, chat]));

      // Hydrate tokens (session only - sensitive data)
      const tokensData = sessionData[StateManager.STORAGE_KEYS.TOKENS_SESSION] || [];
      this.tokens = new Map(tokensData);

      // Hydrate cursors (prefer session, fallback to local)
      const cursorsData = sessionData[StateManager.STORAGE_KEYS.CURSORS_SESSION] || 
                         localData[StateManager.STORAGE_KEYS.CURSORS_PERSISTENT] || 
                         [];
      this.cursors = new Map(cursorsData);

    } catch (error) {
      console.error('StateManager: Failed to hydrate state', error);
    }
  }

  /**
   * Persist state to Chrome storage
   */
  public async persist(): Promise<void> {
    try {
      // Convert Maps to arrays for storage
      const chatsArray = Array.from(this.chats.entries());
      const tokensArray = Array.from(this.tokens.entries());
      const cursorsArray = Array.from(this.cursors.entries());

      // Save to session storage (volatile)
      await chrome.storage.session.set({
        [StateManager.STORAGE_KEYS.CHATS_SESSION]: chatsArray,
        [StateManager.STORAGE_KEYS.TOKENS_SESSION]: tokensArray,
        [StateManager.STORAGE_KEYS.CURSORS_SESSION]: cursorsArray
      });

      // Save to local storage (persistent) - exclude sensitive tokens
      await chrome.storage.local.set({
        [StateManager.STORAGE_KEYS.CHATS_PERSISTENT]: chatsArray,
        [StateManager.STORAGE_KEYS.CURSORS_PERSISTENT]: cursorsArray
      });

    } catch (error) {
      console.error('StateManager: Failed to persist state', error);
    }
  }

  /**
   * Chat operations
   */
  public addChat(chat: Chat): void {
    this.chats.set(chat.id, chat);
    this.persist(); // Auto-persist on mutation
  }

  public getChat(id: string): Chat | undefined {
    return this.chats.get(id);
  }

  public deleteChat(id: string): boolean {
    const deleted = this.chats.delete(id);
    if (deleted) this.persist();
    return deleted;
  }

  public updateChat(id: string, updates: Partial<Chat>): void {
    const chat = this.chats.get(id);
    if (chat) {
      const updatedChat = { ...chat, ...updates, updatedAt: new Date() };
      this.chats.set(id, updatedChat);
      this.persist();
    }
  }

  /**
   * Token operations (opaque blobs)
   */
  public setToken(provider: string, token: string): void {
    this.tokens.set(provider, token);
    this.persist();
  }

  public getToken(provider: string): string | undefined {
    return this.tokens.get(provider);
  }

  public deleteToken(provider: string): boolean {
    const deleted = this.tokens.delete(provider);
    if (deleted) this.persist();
    return deleted;
  }

  /**
   * Cursor operations (provider page cursors)
   */
  public setCursor(provider: string, cursor: string): void {
    this.cursors.set(provider, cursor);
    this.persist();
  }

  public getCursor(provider: string): string | undefined {
    return this.cursors.get(provider);
  }

  public deleteCursor(provider: string): boolean {
    const deleted = this.cursors.delete(provider);
    if (deleted) this.persist();
    return deleted;
  }

  /**
   * Utility methods
   */
  public clear(): void {
    this.chats.clear();
    this.tokens.clear();
    this.cursors.clear();
    this.persist();
  }

  public getState(): StateSlices {
    return {
      chats: new Map(this.chats),
      tokens: new Map(this.tokens),
      cursors: new Map(this.cursors)
    };
  }
}

// Export singleton instance
export const stateManager = new StateManager();