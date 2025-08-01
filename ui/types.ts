// src/types.ts

/**
 * UI-LAYER TYPES
 * 
 * This file contains type definitions exclusively for the React UI components
 * and their state. It is decoupled from the backend's internal system contracts.
 */

import type React from 'react';

/** The current step of the UI, controlling what controls are shown */
export type AppStep = 'initial' | 'awaitingSynthesis' | 'synthesisDone';

// --- THIS TYPE IS NEW/MOVED HERE ---
/** Defines the allowed LLM providers for the synthesis step */
export type SynthesisProvider = 'claude' | 'gemini';

/** Defines the properties for a supported LLM provider for UI rendering */
export interface LLMProvider {
  id: string;
  name: string;
  hostnames: string[];
  color: string;
  logoBgClass: string;
  icon?: React.ReactNode;
}

// ... rest of the file is unchanged ...

/** The data structure for a single AI model's response within a message block */
export interface LLMStreamData {
  providerId: string;
  firstSentenceSummary: string;
  fullOutput: string;
  isStreamingSummary: boolean;
  isStreamingOutput: boolean;
  isExpanded: boolean;
}

/** The core data structure for a single message (user or AI) in the chat log */
export interface Message {
  id: string;
  type: 'user' | 'ai';
  sessionId: string | null;
  text?: string; // For user messages
  overallSummary?: string; // For AI synthesis messages
  llmData?: LLMStreamData[]; // For multi-model AI responses
  isOverallSummaryStreaming?: boolean;
  isFinalSynthesis?: boolean;
  timestamp: number;
}

/** The data structure for a single session in the history panel */
export interface ChatSession {
  id: string;
  sessionId: string;
  input?: string;
  workflowId?: string;
  startTime?: number;
  title: string;
  timestamp?: number;
  messages?: Message[]; // Optional full message history for rehydration
}

/** The shape of the response when fetching the list of chat sessions for the history panel */
export interface HistoryApiResponse {
  sessions: ChatSession[];
}

export interface BackendMessage {
  type: 'WORKFLOW_STEP_UPDATE' | 'WORKFLOW_COMPLETE' | 'SYNTHESIS_COMPLETE' | 'WORKFLOW_FAILED';
  sessionId: string;
  data?: {
    providerKey: string;
    result: string;
    threadUrl?: string | null;
  };
  results?: Array<{
    provider: string;
    result: string;
    threadUrl?: string;
  }>;
  error?: string;
}