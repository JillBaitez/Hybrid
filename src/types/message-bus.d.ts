/**
 * HTOS Message Bus Type Definitions
 * 
 * Comprehensive TypeScript interfaces for all inter-component communication
 * Enables type-safe messaging between service worker, content scripts, offscreen, and popup
 * HTOS-PILLAR-CHECK: Type-safe communication with clear message contracts
 */

// Base message interface - all messages extend this
export interface BaseMessage {
  id: string;                    // Unique message identifier
  type: string;                  // Message type for routing
  timestamp: number;             // When message was created
  source: MessageSource;         // Where message originated
  target?: MessageTarget;        // Intended recipient (optional for broadcasts)
  correlationId?: string;        // For request/response correlation
  priority?: MessagePriority;    // Message priority level
}

// Message sources and targets
export type MessageSource = 'service_worker' | 'content_script' | 'offscreen' | 'popup' | 'background';
export type MessageTarget = MessageSource | 'broadcast' | 'any';

// Message priority levels
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

// Response wrapper for request/response patterns
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId: string;
}

// =============================================================================
// TOKEN MANAGEMENT MESSAGES
// =============================================================================

export interface TokenExtractedMessage extends BaseMessage {
  type: 'htos.token.extracted';
  data: {
    provider: string;
    domain: string;
    tokenType: 'session' | 'api_key' | 'bearer';
    expires?: number;
  };
}

export interface TokenRefreshMessage extends BaseMessage {
  type: 'htos.token.refresh';
  data: {
    provider: string;
    force?: boolean;
  };
}

export interface TokenDeletedMessage extends BaseMessage {
  type: 'htos.token.deleted';
  data: {
    provider: string;
    reason: 'expired' | 'user_action' | 'error';
  };
}

export interface TokenStatusMessage extends BaseMessage {
  type: 'htos.token.status';
  data: {
    provider: string;
    status: 'valid' | 'expired' | 'missing' | 'refreshing';
    expires?: number;
    lastUsed?: number;
  };
}

export interface TokenExtractMessage extends BaseMessage {
  type: 'htos.token.extract';
  data: {
    provider: string;
    domain: string;
  };
}

// =============================================================================
// DNR COORDINATION MESSAGES
// =============================================================================

export interface DNRRulesActivatedMessage extends BaseMessage {
  type: 'htos.dnr.rules_activated';
  data: {
    provider: string;
    tabId: number;
    ruleIds: number[];
    ruleCount: number;
  };
}

export interface DNRRulesDeactivatedMessage extends BaseMessage {
  type: 'htos.dnr.rules_deactivated';
  data: {
    provider: string;
    tabId: number;
    ruleIds: number[];
    reason: 'expired' | 'tab_closed' | 'manual';
  };
}

export interface DNRActivationRequestMessage extends BaseMessage {
  type: 'htos.dnr.activation_request';
  data: {
    provider: string;
    tabId: number;
    url: string;
  };
}

// =============================================================================
// PROMPT DISPATCH MESSAGES
// =============================================================================

export interface PromptDispatchMessage extends BaseMessage {
  type: 'htos.prompt.dispatch';
  data: {
    promptId: string;
    text: string;
    providers: string[];
    options?: {
      streaming?: boolean;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    };
  };
}

export interface PromptResponseMessage extends BaseMessage {
  type: 'htos.prompt.response';
  data: {
    promptId: string;
    provider: string;
    response: string;
    isComplete: boolean;
    isStreaming?: boolean;
    metadata?: {
      tokensUsed?: number;
      responseTime?: number;
      model?: string;
    };
  };
}

export interface PromptErrorMessage extends BaseMessage {
  type: 'htos.prompt.error';
  data: {
    promptId: string;
    provider: string;
    error: string;
    errorType: 'network' | 'authentication' | 'rate_limit' | 'provider_error' | 'unknown';
    retryable: boolean;
  };
}

export interface PromptProgressMessage extends BaseMessage {
  type: 'htos.prompt.progress';
  data: {
    promptId: string;
    provider: string;
    progress: number; // 0-100
    stage: 'queued' | 'authenticating' | 'sending' | 'receiving' | 'processing' | 'complete' | 'error';
  };
}

// =============================================================================
// UI STATE MESSAGES
// =============================================================================

export interface UIStateUpdateMessage extends BaseMessage {
  type: 'htos.ui.state_update';
  data: {
    component: string;
    state: Record<string, any>;
    partial?: boolean; // If true, merge with existing state
  };
}

export interface UINotificationMessage extends BaseMessage {
  type: 'htos.ui.notification';
  data: {
    level: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    duration?: number; // Auto-dismiss after N milliseconds
    actions?: Array<{
      label: string;
      action: string;
    }>;
  };
}

export interface UIProviderStatusMessage extends BaseMessage {
  type: 'htos.ui.provider_status';
  data: {
    provider: string;
    status: 'connected' | 'disconnected' | 'authenticating' | 'error';
    lastActivity?: number;
    errorMessage?: string;
  };
}

// =============================================================================
// SYSTEM MESSAGES
// =============================================================================

export interface SystemReadyMessage extends BaseMessage {
  type: 'htos.system.ready';
  data: {
    component: MessageSource;
    version: string;
    capabilities: string[];
  };
}

export interface SystemErrorMessage extends BaseMessage {
  type: 'htos.system.error';
  data: {
    component: MessageSource;
    error: string;
    errorType: 'initialization' | 'runtime' | 'communication' | 'storage';
    fatal: boolean;
    context?: Record<string, any>;
  };
}

export interface SystemHealthCheckMessage extends BaseMessage {
  type: 'htos.system.health_check';
  data: {
    requestId: string;
  };
}

export interface SystemHealthResponseMessage extends BaseMessage {
  type: 'htos.system.health_response';
  data: {
    requestId: string;
    component: MessageSource;
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastActivity: number;
    metrics?: Record<string, number>;
  };
}

export interface SystemResponseMessage extends BaseMessage {
  type: 'htos.system.response';
  data: {
    requestId: string;
    component: MessageSource;
    response: any;
  };
}

// =============================================================================
// OFFSCREEN DOCUMENT MESSAGES
// =============================================================================

export interface OffscreenCreateMessage extends BaseMessage {
  type: 'htos.offscreen.create';
  data: {
    url: string;
    reasons: string[];
    justification: string;
  };
}

export interface OffscreenReadyMessage extends BaseMessage {
  type: 'htos.offscreen.ready';
  data: {
    documentId: string;
    capabilities: string[];
  };
}

export interface OffscreenIframeMessage extends BaseMessage {
  type: 'htos.offscreen.iframe';
  data: {
    action: 'create' | 'destroy' | 'message';
    iframeId?: string;
    url?: string;
    message?: any;
  };
}

// =============================================================================
// STREAMING MESSAGES
// =============================================================================

export interface StreamStartMessage extends BaseMessage {
  type: 'htos.stream.start';
  data: {
    streamId: string;
    contentType: string;
    totalSize?: number;
  };
}

export interface StreamChunkMessage extends BaseMessage {
  type: 'htos.stream.chunk';
  data: {
    streamId: string;
    chunk: string;
    sequence: number;
    isLast: boolean;
  };
}

export interface StreamEndMessage extends BaseMessage {
  type: 'htos.stream.end';
  data: {
    streamId: string;
    success: boolean;
    error?: string;
    totalChunks: number;
  };
}

// =============================================================================
// MESSAGE UNIONS AND UTILITIES
// =============================================================================

// Union of all possible message types
export type HTOSMessage = 
  | TokenExtractedMessage
  | TokenRefreshMessage
  | TokenDeletedMessage
  | TokenStatusMessage
  | TokenExtractMessage
  | DNRRulesActivatedMessage
  | DNRRulesDeactivatedMessage
  | DNRActivationRequestMessage
  | PromptDispatchMessage
  | PromptResponseMessage
  | PromptErrorMessage
  | PromptProgressMessage
  | UIStateUpdateMessage
  | UINotificationMessage
  | UIProviderStatusMessage
  | SystemReadyMessage
  | SystemErrorMessage
  | SystemHealthCheckMessage
  | SystemHealthResponseMessage
  | SystemResponseMessage
  | OffscreenCreateMessage
  | OffscreenReadyMessage
  | OffscreenIframeMessage
  | StreamStartMessage
  | StreamChunkMessage
  | StreamEndMessage;

// Message type string union for type guards
export type MessageType = 
  | 'htos.token.extracted'
  | 'htos.token.refresh'
  | 'htos.token.deleted'
  | 'htos.token.status'
  | 'htos.token.extract'
  | 'htos.dnr.rules_activated'
  | 'htos.dnr.rules_deactivated'
  | 'htos.dnr.activation_request'
  | 'htos.prompt.dispatch'
  | 'htos.prompt.response'
  | 'htos.prompt.progress'
  | 'htos.ui.state_update'
  | 'htos.ui.notification'
  | 'htos.ui.provider_status'
  | 'htos.system.ready'
  | 'htos.system.health_check'
  | 'htos.system.error'
  | 'htos.system.response'
  | 'htos.offscreen.iframe'
  | 'htos.stream.start'
  | 'htos.stream.chunk'
  | 'htos.stream.end';

// Type guard utility
export function isHTOSMessage(obj: any): obj is HTOSMessage {
  return obj && 
         typeof obj.id === 'string' &&
         typeof obj.type === 'string' &&
         typeof obj.timestamp === 'number' &&
         typeof obj.source === 'string';
}

// Message factory utility
export function createMessage<T extends HTOSMessage>(
  type: T['type'],
  source: MessageSource,
  data: T['data'],
  options?: {
    target?: MessageTarget;
    priority?: MessagePriority;
    correlationId?: string;
  }
): T {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    source,
    target: options?.target,
    priority: options?.priority || 'normal',
    correlationId: options?.correlationId,
    data
  } as T;
}

// Response factory utility
export function createResponse<T = any>(
  correlationId: string,
  success: boolean,
  data?: T,
  error?: string
): MessageResponse<T> {
  return {
    success,
    data,
    error,
    correlationId
  };
}
