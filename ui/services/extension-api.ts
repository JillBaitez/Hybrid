// src/ui/services/extension-api.ts
// FINAL, EVENT-DRIVEN VERSION

import {
  EXECUTE_WORKFLOW,
  GET_FULL_HISTORY,
  GET_HISTORY_SESSION,
  GET_LAST_ESCALATION,
} from "../../shared/messaging";
import type { LLMProvider, ChatSession, HistoryApiResponse } from "../types";
import type {
  WorkflowRequest,
  WorkflowStep,
  ProviderKey,
} from "../../shared/contract";

interface BackendApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

let EXTENSION_ID: string | null = null;

const api = {
  setExtensionId(id: string): void {
    EXTENSION_ID = id;
    console.log("Extension API connected with ID:", EXTENSION_ID);
  },

  /**
   * Sends a message and expects an immediate response. Used for simple, fast queries.
   * This is the "request-response" pattern.
   */
  async queryBackend<T>(message: { type: string; payload?: any }): Promise<T> {
    if (!EXTENSION_ID) throw new Error("Extension not connected.");

    return new Promise<T>((resolve, reject) => {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        message,
        (response: BackendApiResponse<T>) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (response?.success) {
            resolve(response.data as T);
          } else {
            reject(
              new Error(response?.error?.message || "Unknown backend error.")
            );
          }
        }
      );
    });
  },

  /**
   * Sends a "fire-and-forget" command to the backend to start a long-running task.
   * It does not wait for the task to complete.
   */
  dispatchWorkflow(workflow: WorkflowRequest): void {
    if (!EXTENSION_ID) {
      console.error("Extension not connected. Cannot dispatch workflow.");
      return;
    }
    // We don't await a response. The UI will get updates via the onMessage listener.
    chrome.runtime.sendMessage(EXTENSION_ID, {
      type: EXECUTE_WORKFLOW,
      payload: workflow,
    });
  },

  /**
   * STAGE 1: Executes the initial "batch prompt" workflow.
   */
  executeBatchPrompt(
    prompt: string,
    providers: LLMProvider[],
    isVisible: boolean,
    uiTabId?: number // The UI must provide its own tab ID
  ): { sessionId: string } {
    const sessionId = `sid-${Date.now()}`;
    const workflow: WorkflowRequest = {
      workflowId: `wf-batch-${Date.now()}`,
      context: {
        sessionId,
        uiTabId, // Pass the UI's tab ID to the backend
        executionMode: isVisible ? "visible" : "headless",
      },
      steps: providers.map(
        (p): WorkflowStep => ({
          stepId: `step_${p.id}`,
          provider: p.id as ProviderKey,
          type: "prompt",
          payload: { prompt },
        })
      ),
    };

    console.log("[ExtensionAPI] Dispatching EXECUTE_WORKFLOW:", workflow);
    this.dispatchWorkflow(workflow);

    // Return the session ID immediately so the UI can track this workflow.
    return { sessionId };
  },

  /**
   * STAGE 2: Executes the synthesis step.
   */
  executeSynthesis(
    sessionId: string,
    originalPrompt: string,
    allBatchResults: Record<string, string>,
    synthesisProvider: "claude" | "gemini",
    uiTabId?: number
  ): void {
    const otherProviderResults = Object.fromEntries(
      Object.entries(allBatchResults).filter(
        ([key]) => key !== synthesisProvider
      )
    );
    const synthesisPrompt = `... your detailed prompt here ...`;

    const workflow: WorkflowRequest = {
      workflowId: `wf-synth-${Date.now()}`,
      context: {
        sessionId,
        uiTabId,
        variables: { originalPrompt, allBatchResults },
      },
      steps: [
        {
          stepId: "synthesis_step",
          provider: synthesisProvider,
          type: "prompt",
          payload: { prompt: synthesisPrompt },
        },
      ],
    };

    console.log(
      "[ExtensionAPI] Dispatching synthesis EXECUTE_WORKFLOW:",
      workflow
    );
    this.dispatchWorkflow(workflow);
  },

  // These are fast queries, so they can use the request-response pattern.
  getHistoryList(): Promise<HistoryApiResponse> {
    return this.queryBackend<HistoryApiResponse>({
      type: GET_FULL_HISTORY,
      payload: { limit: 50 },
    });
  },

  getSessionDetails(sessionId: string): Promise<ChatSession> {
    return this.queryBackend<ChatSession>({
      type: GET_HISTORY_SESSION,
      payload: { sessionId },
    });
  },

  getLastEscalation(): Promise<any> {
    return this.queryBackend<any>({ type: GET_LAST_ESCALATION });
  },
};

export default api;
