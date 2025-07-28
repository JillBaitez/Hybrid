/**
 * DAY 10 - STATE RECOVERY
 * SW restart → re-hydrate StateManager from chrome.storage
 * Ensure no lost messages during restart
 */

import { stateManager, StateSlices, Chat } from './StateManager';
import { swBus } from './sw';
import { netRules } from './NetRules';
import { errorHandler } from './error-handling';
import { BusMessage } from './events';

// Recovery state tracking
interface RecoveryState {
  lastRestartTime: number;
  restartCount: number;
  pendingMessages: BusMessage[];
  activeRequests: string[];
  recoveryInProgress: boolean;
}

// Recovery configuration
export const RECOVERY_CONFIG = {
  MAX_PENDING_MESSAGES: 100,
  RECOVERY_TIMEOUT_MS: 10000,
  HEALTH_CHECK_INTERVAL_MS: 5000,
  MAX_RESTART_COUNT: 10,
  RESTART_WINDOW_MS: 300000 // 5 minutes
} as const;

// State recovery manager
export class StateRecovery {
  private static instance: StateRecovery;
  private recoveryState: RecoveryState;
  private healthCheckInterval?: number;
  private messageQueue: BusMessage[] = [];
  private isRecovering = false;

  private constructor() {
    this.recoveryState = {
      lastRestartTime: 0,
      restartCount: 0,
      pendingMessages: [],
      activeRequests: [],
      recoveryInProgress: false
    };

    this.setupRecoveryHandlers();
  }

  public static getInstance(): StateRecovery {
    if (!StateRecovery.instance) {
      StateRecovery.instance = new StateRecovery();
    }
    return StateRecovery.instance;
  }

  /**
   * Initialize state recovery system
   */
  public async init(): Promise<void> {
    console.log('StateRecovery: Initializing...');

    try {
      // Load previous recovery state
      await this.loadRecoveryState();

      // Check if this is a restart
      const isRestart = await this.detectServiceWorkerRestart();

      if (isRestart) {
        console.log('StateRecovery: Service worker restart detected');
        await this.performRecovery();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      console.log('StateRecovery: Initialized successfully');
    } catch (error) {
      console.error('StateRecovery: Failed to initialize', error);
      throw error;
    }
  }

  /**
   * Detect if service worker has restarted
   */
  private async detectServiceWorkerRestart(): Promise<boolean> {
    try {
      // Check if previous session data exists but current session is empty
      const sessionData = await chrome.storage.session.get(['htos_recovery_state']);
      const localData = await chrome.storage.local.get(['htos_last_shutdown_time']);

      const hasSessionData = Object.keys(sessionData).length > 0;
      const hasLocalData = Object.keys(localData).length > 0;
      const currentTime = Date.now();

      // If we have local data but no session data, it's likely a restart
      if (hasLocalData && !hasSessionData) {
        const lastShutdown = localData.htos_last_shutdown_time || 0;
        const timeSinceShutdown = currentTime - lastShutdown;

        // If shutdown was recent (< 1 minute), consider it a restart
        return timeSinceShutdown < 60000;
      }

      return false;
    } catch (error) {
      console.error('StateRecovery: Error detecting restart', error);
      return false;
    }
  }

  /**
   * Perform complete state recovery
   */
  public async performRecovery(): Promise<void> {
    if (this.isRecovering) {
      console.warn('StateRecovery: Recovery already in progress');
      return;
    }

    this.isRecovering = true;
    this.recoveryState.recoveryInProgress = true;

    const startTime = Date.now();
    console.log('StateRecovery: Starting recovery process...');

    try {
      // Step 1: Recover StateManager data
      await this.recoverStateManager();

      // Step 2: Recover network rules
      await this.recoverNetworkRules();

      // Step 3: Recover active requests
      await this.recoverActiveRequests();

      // Step 4: Replay pending messages
      await this.replayPendingMessages();

      // Step 5: Restore service worker bus
      await this.recoverServiceWorkerBus();

      // Update recovery statistics
      this.updateRecoveryStats();

      const duration = Date.now() - startTime;
      console.log(`StateRecovery: Recovery completed in ${duration}ms`);

    } catch (error) {
      console.error('StateRecovery: Recovery failed', error);
      throw error;
    } finally {
      this.isRecovering = false;
      this.recoveryState.recoveryInProgress = false;
      await this.saveRecoveryState();
    }
  }

  /**
   * Recover StateManager from storage
   */
  private async recoverStateManager(): Promise<void> {
    console.log('StateRecovery: Recovering state manager...');

    try {
      // Force re-hydration from storage
      await stateManager.hydrate();

      // Verify state integrity
      const state = stateManager.getState();
      const chatsCount = state.chats.size;
      const tokensCount = state.tokens.size;
      const cursorsCount = state.cursors.size;

      console.log(`StateRecovery: Recovered ${chatsCount} chats, ${tokensCount} tokens, ${cursorsCount} cursors`);

      // Validate recovered data
      await this.validateRecoveredState(state);

    } catch (error) {
      console.error('StateRecovery: Failed to recover state manager', error);
      throw error;
    }
  }

  /**
   * Validate recovered state data
   */
  private async validateRecoveredState(state: StateSlices): Promise<void> {
    console.log('StateRecovery: Validating recovered state...');

    // Check for corrupted chats
    for (const [chatId, chat] of state.chats) {
      if (!chat.id || !chat.provider || !Array.isArray(chat.messages)) {
        console.warn(`StateRecovery: Corrupted chat found: ${chatId}`);
        stateManager.deleteChat(chatId);
      }
    }

    // Validate tokens format
    for (const [provider, token] of state.tokens) {
      if (!token || typeof token !== 'string') {
        console.warn(`StateRecovery: Invalid token for provider: ${provider}`);
        stateManager.deleteToken(provider);
      }
    }

    console.log('StateRecovery: State validation completed');
  }

  /**
   * Recover network rules
   */
  private async recoverNetworkRules(): Promise<void> {
    console.log('StateRecovery: Recovering network rules...');

    try {
      // Reinitialize network rules
      await netRules.init();

      // Update tokens in rules
      const state = stateManager.getState();
      const tokenMap: Record<string, string> = {};
      
      for (const [provider, token] of state.tokens) {
        tokenMap[provider] = token;
      }

      if (Object.keys(tokenMap).length > 0) {
        await netRules.updateTokens(tokenMap);
      }

      console.log('StateRecovery: Network rules recovered');
    } catch (error) {
      console.error('StateRecovery: Failed to recover network rules', error);
      throw error;
    }
  }

  /**
   * Recover active requests from before restart
   */
  private async recoverActiveRequests(): Promise<void> {
    console.log('StateRecovery: Recovering active requests...');

    try {
      // Load active requests from storage
      const data = await chrome.storage.session.get(['htos_active_requests']);
      const activeRequests = data.htos_active_requests || [];

      this.recoveryState.activeRequests = activeRequests;

      // Mark old requests as failed due to restart
      for (const requestId of activeRequests) {
        console.log(`StateRecovery: Marking request as failed due to restart: ${requestId}`);
        // Could notify clients that request failed due to restart
      }

      console.log(`StateRecovery: Recovered ${activeRequests.length} active requests`);
    } catch (error) {
      console.error('StateRecovery: Failed to recover active requests', error);
    }
  }

  /**
   * Replay pending messages that weren't processed before restart
   */
  private async replayPendingMessages(): Promise<void> {
    console.log('StateRecovery: Replaying pending messages...');

    try {
      // Load pending messages from storage
      const data = await chrome.storage.local.get(['htos_pending_messages']);
      const pendingMessages = data.htos_pending_messages || [];

      this.recoveryState.pendingMessages = pendingMessages;

      if (pendingMessages.length > 0) {
        console.log(`StateRecovery: Found ${pendingMessages.length} pending messages`);

        // Replay messages through the bus
        for (const message of pendingMessages) {
          try {
            await this.replayMessage(message);
          } catch (error) {
            console.error('StateRecovery: Failed to replay message', message, error);
          }
        }

        // Clear pending messages after replay
        await chrome.storage.local.remove(['htos_pending_messages']);
      }

    } catch (error) {
      console.error('StateRecovery: Failed to replay pending messages', error);
    }
  }

  /**
   * Replay a single message
   */
  private async replayMessage(message: BusMessage): Promise<void> {
    console.log(`StateRecovery: Replaying message: ${message.type} (${message.id})`);

    // Add to message queue for processing
    this.messageQueue.push(message);

    // Process queue if service worker bus is ready
    if (swBus.isHealthy) {
      await this.processMessageQueue();
    }
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        // Broadcast message through the bus
        swBus.broadcast(message.type as any, message.payload);
      }
    }
  }

  /**
   * Recover service worker bus
   */
  private async recoverServiceWorkerBus(): Promise<void> {
    console.log('StateRecovery: Recovering service worker bus...');

    try {
      // Initialize service worker bus
      await swBus.init();

      // Process any queued messages
      await this.processMessageQueue();

      console.log('StateRecovery: Service worker bus recovered');
    } catch (error) {
      console.error('StateRecovery: Failed to recover service worker bus', error);
      throw error;
    }
  }

  /**
   * Save pending message before potential restart
   */
  public async savePendingMessage(message: BusMessage): Promise<void> {
    try {
      const data = await chrome.storage.local.get(['htos_pending_messages']);
      const pendingMessages = data.htos_pending_messages || [];

      pendingMessages.push(message);

      // Limit queue size
      if (pendingMessages.length > RECOVERY_CONFIG.MAX_PENDING_MESSAGES) {
        pendingMessages.shift();
      }

      await chrome.storage.local.set({ htos_pending_messages: pendingMessages });
    } catch (error) {
      console.error('StateRecovery: Failed to save pending message', error);
    }
  }

  /**
   * Track active request
   */
  public async trackActiveRequest(requestId: string): Promise<void> {
    try {
      const data = await chrome.storage.session.get(['htos_active_requests']);
      const activeRequests = data.htos_active_requests || [];

      activeRequests.push(requestId);
      await chrome.storage.session.set({ htos_active_requests: activeRequests });
    } catch (error) {
      console.error('StateRecovery: Failed to track active request', error);
    }
  }

  /**
   * Remove completed request
   */
  public async removeActiveRequest(requestId: string): Promise<void> {
    try {
      const data = await chrome.storage.session.get(['htos_active_requests']);
      const activeRequests = data.htos_active_requests || [];

      const filtered = activeRequests.filter((id: string) => id !== requestId);
      await chrome.storage.session.set({ htos_active_requests: filtered });
    } catch (error) {
      console.error('StateRecovery: Failed to remove active request', error);
    }
  }

  /**
   * Setup recovery event handlers
   */
  private setupRecoveryHandlers(): void {
    // Listen for service worker shutdown
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onSuspend.addListener(() => {
        this.onServiceWorkerShutdown();
      });
    }
  }

  /**
   * Handle service worker shutdown
   */
  private async onServiceWorkerShutdown(): Promise<void> {
    console.log('StateRecovery: Service worker shutting down');

    try {
      // Save shutdown timestamp
      await chrome.storage.local.set({
        htos_last_shutdown_time: Date.now()
      });

      // Save current recovery state
      await this.saveRecoveryState();

    } catch (error) {
      console.error('StateRecovery: Error during shutdown', error);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, RECOVERY_CONFIG.HEALTH_CHECK_INTERVAL_MS) as any;
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check if state manager is healthy
      const stateHealthy = stateManager.getState() !== null;
      
      // Check if service worker bus is healthy
      const busHealthy = swBus.isHealthy;
      
      // Check if network rules are active
      const rulesHealthy = netRules.initialized;

      if (!stateHealthy || !busHealthy || !rulesHealthy) {
        console.warn('StateRecovery: Health check failed, initiating recovery');
        await this.performRecovery();
      }
    } catch (error) {
      console.error('StateRecovery: Health check error', error);
    }
  }

  /**
   * Load recovery state from storage
   */
  private async loadRecoveryState(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(['htos_recovery_state']);
      if (data.htos_recovery_state) {
        this.recoveryState = { ...this.recoveryState, ...data.htos_recovery_state };
      }
    } catch (error) {
      console.error('StateRecovery: Failed to load recovery state', error);
    }
  }

  /**
   * Save recovery state to storage
   */
  private async saveRecoveryState(): Promise<void> {
    try {
      await chrome.storage.local.set({
        htos_recovery_state: this.recoveryState
      });
    } catch (error) {
      console.error('StateRecovery: Failed to save recovery state', error);
    }
  }

  /**
   * Update recovery statistics
   */
  private updateRecoveryStats(): void {
    const currentTime = Date.now();
    
    // Reset restart count if outside the window
    if (currentTime - this.recoveryState.lastRestartTime > RECOVERY_CONFIG.RESTART_WINDOW_MS) {
      this.recoveryState.restartCount = 0;
    }

    this.recoveryState.lastRestartTime = currentTime;
    this.recoveryState.restartCount++;

    console.log(`StateRecovery: Restart count: ${this.recoveryState.restartCount}`);
  }

  /**
   * Get recovery statistics
   */
  public getRecoveryStats(): {
    lastRestartTime: number;
    restartCount: number;
    pendingMessages: number;
    activeRequests: number;
    isRecovering: boolean;
  } {
    return {
      lastRestartTime: this.recoveryState.lastRestartTime,
      restartCount: this.recoveryState.restartCount,
      pendingMessages: this.recoveryState.pendingMessages.length,
      activeRequests: this.recoveryState.activeRequests.length,
      isRecovering: this.isRecovering
    };
  }

  /**
   * Stop health monitoring
   */
  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}

// Export singleton instance
export const stateRecovery = StateRecovery.getInstance();