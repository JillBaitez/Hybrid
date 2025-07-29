/**
 * BroadcastChannel Bus Contract (IMMUTABLE)
 * Copied from agent/bus/events.ts
 */

export type TextEvents = {
  'ask': { provider: string; prompt: string };
  'chunk': { id: string; data: string };
  'done': { id: string; usage?: any; error?: string };
  'blobIdToObjectUrl': { id: string };
};

export type TextEventType = keyof TextEvents;
export type TextEventPayload<T extends TextEventType> = TextEvents[T];

export interface BusMessage<T extends TextEventType = TextEventType> {
  type: T;
  payload: TextEventPayload<T>;
  id: string;
  timestamp: number;
}

export const BUS_CONFIG = {
  CHANNEL_NAME: 'bus.channel',
  BLOB_URL_PREFIX: '_blob/',
  MAX_RETRY_ATTEMPTS: 3,
  TIMEOUT_MS: 30000,
} as const;

export function isValidEventType(type: string): type is TextEventType {
  return ['ask', 'chunk', 'done', 'blobIdToObjectUrl'].includes(type);
}

export function validateEventPayload<T extends TextEventType>(type: T, payload: any): payload is TextEventPayload<T> {
  switch (type) {
    case 'ask':
      return typeof payload === 'object' && typeof payload.provider === 'string' && typeof payload.prompt === 'string';
    case 'chunk':
      return typeof payload === 'object' && typeof payload.id === 'string' && typeof payload.data === 'string';
    case 'done':
      return typeof payload === 'object' && typeof payload.id === 'string' &&
        (payload.usage === undefined || typeof payload.usage === 'object') &&
        (payload.error === undefined || typeof payload.error === 'string');
    case 'blobIdToObjectUrl':
      return typeof payload === 'object' && typeof payload.id === 'string';
    default:
      return false;
  }
}

export function createBusMessage<T extends TextEventType>(type: T, payload: TextEventPayload<T>): BusMessage<T> {
  if (!validateEventPayload(type, payload)) {
    throw new Error(`Invalid payload for event type: ${type}`);
  }
  return {
    type,
    payload,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
}

export class BusError extends Error {
  constructor(message: string, public readonly eventType?: TextEventType, public readonly originalError?: Error) {
    super(message);
    this.name = 'BusError';
  }
}

export class BusTimeoutError extends BusError {
  constructor(eventType: TextEventType, timeoutMs: number) {
    super(`Bus operation timed out after ${timeoutMs}ms for event: ${eventType}`, eventType);
    this.name = 'BusTimeoutError';
  }
}

export class BusValidationError extends BusError {
  constructor(eventType: TextEventType, details: string) {
    super(`Validation failed for event ${eventType}: ${details}`, eventType);
    this.name = 'BusValidationError';
  }
}
