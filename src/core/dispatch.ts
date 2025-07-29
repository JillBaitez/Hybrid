/**
 * HTOS Parallel Prompt Dispatcher
 * Orchestrates prompt workflows across multiple AI providers
 */

import type { IPromptJob, IPromptResult } from '../types/prompt-job';
import type { IProviderConfig } from '../types/provider';
export interface DispatchResult {
  success: boolean;
  results: IPromptResult[];
  errors: string[];
  timing: {
    start: number;
    end: number;
    duration: number;
  };
}

/**
 * Dispatches prompt to multiple providers in parallel
 * @security Provider tokens handled via DNR rules only
 */
export async function dispatchPrompt(job: IPromptJob): Promise<DispatchResult> {
  const start = Date.now();
  
  try {
    // Fan out to all providers
    const promises = job.providers.map(provider => 
      sendPromptToProvider({
        name: provider.toString(),
        domain: 'default',
        promptUrl: '/prompt',
        selectors: {}
      }, job.prompt, {})
    );
    
    // Wait for all results (including failures)
    const settled = await Promise.allSettled(promises);
    
    const results: IPromptResult[] = [];
    const errors: string[] = [];
    
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push(`Provider ${job.providers[index]}: ${result.reason}`);
      }
    });

    const end = Date.now();

    return {
      success: results.length > 0,
      results: await mergeResults(results),
      errors,
      timing: {
        start,
        end,
        duration: end - start
      }
    };
    
  } catch (error) {
    const end = Date.now();
    return {
      success: false,
      results: [],
      errors: [`Dispatch failed: ${error}`],
      timing: {
        start,
        end,
        duration: end - start
      }
    };
  }
}

/**
 * Sends prompt to individual provider
 * @security Uses offscreen iframe for session-based auth
 */
async function sendPromptToProvider(
  provider: IProviderConfig, 
  prompt: string, 
  options: any = {}
): Promise<IPromptResult> {
  
  // Create offscreen iframe for this provider
  const iframe = await createProviderIframe(provider.name);
  
  try {
    // Send prompt via postMessage
    const response = await sendPromptMessage(iframe, {
      type: 'htos.prompt.send',
      provider: provider.name,
      prompt,
      options
    });
    
    return {
      jobId: provider.name,
      results: [response],
      // metadata property removed as it's not in IPromptResult interface
      // timestop property removed as it's not in IPromptResult interface
    };
    
  } finally {
    // Clean up iframe
    iframe.remove();
  }
}

/**
 * Creates sandboxed iframe for provider
 * @security Iframe runs in isolated context
 */
async function createProviderIframe(providerName: string): Promise<HTMLIFrameElement> {
  // Get offscreen document
  const offscreenDoc = await getOffscreenDocument();
  
  const iframe = offscreenDoc.createElement('iframe');
  iframe.src = chrome.runtime.getURL(`session-layer/nj-engine.html?provider=${providerName}`);
  iframe.sandbox = 'allow-scripts allow-same-origin';
  iframe.style.display = 'none';
  
  offscreenDoc.body.appendChild(iframe);
  
  // Wait for iframe to load
  await new Promise((resolve) => {
    iframe.onload = resolve;
  });
  
  return iframe;
}

/**
 * Sends message to provider iframe
 * @security Uses structured cloning for safe message passing
 */
async function sendPromptMessage(iframe: HTMLIFrameElement, message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const messageId = crypto.randomUUID();
    
    const handler = (event: MessageEvent) => {
      if (event.data.id === messageId) {
        window.removeEventListener('message', handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      }
    };
    
    window.addEventListener('message', handler);
    
    iframe.contentWindow?.postMessage({
      ...message,
      id: messageId
    }, '*');
    
    // Timeout after 30 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Provider timeout'));
    }, 30000);
  });
}

/**
 * Gets or creates offscreen document
 * @security Singleton pattern - only one offscreen doc per session
 */
async function getOffscreenDocument(): Promise<Document> {
  // Check if offscreen document exists
  try {
    const existingContexts = await (chrome.runtime as any).getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length === 0) {
      // Create new offscreen document
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('dist/host/0h.html'),
        reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
        justification: 'HTOS provider session management'
      });
    }
  } catch (error) {
    // Fallback: create offscreen document
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('dist/host/0h.html'),
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: 'HTOS provider session management'
    });
  }

  // Return offscreen document (this is a simplified approach)
  // In practice, you'd need to establish communication with the offscreen doc
  throw new Error('Offscreen document access needs proper implementation');
}

/**
 * Merges results from multiple providers
 * @security No token data in synthesis
 */
async function mergeResults(results: IPromptResult[]): Promise<IPromptResult[]> {
  // TODO: Implement synthesis strategies
  // - 'consensus': Find common themes
  // - 'best': Pick highest confidence
  // - 'merge': Combine all responses
  
  return results;
}