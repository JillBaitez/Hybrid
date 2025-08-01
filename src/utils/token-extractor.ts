/**
 * HTOS Token Extractor - Enhanced with Storage Integration
 * 
 * Implements HARPA pattern for token extraction via dynamic iframe creation
 * Enhanced with expiration checking and DNR activation coordination
 * HTOS-PILLAR-CHECK: preserves SW-only authority & DNR-before-JS
 */

import { secureTokenStore, type ITokenStorage, type ITokenData } from '../storage/secure-token-store';

// Use secure storage implementation
const storage: ITokenStorage = secureTokenStore;

/**
 * Enhanced token extraction with expiration checking and storage integration
 */
export async function extractTokenFromProvider(domain: string): Promise<string | null> {
  await storage.init();
  
  const provider = domain.includes('openai') ? 'chatgpt' : 
                  domain.includes('claude') ? 'claude' : 
                  domain.includes('gemini') ? 'gemini' : domain;
  
  // Check for existing, non-expired token first
  const existingToken = await storage.getToken(provider);
  if (existingToken && !storage.isExpired(existingToken)) {
    return existingToken.token;
  }

  // If no valid token, proceed with extraction
  const iframe = await createProviderExtractionIframe(domain);
  
  try {
    // Send token extraction request to provider iframe
    const token = await sendExtractionMessage(iframe, { 
      type: 'htos.extract.token',
      domain 
    });
    
    if (token) {
      // Store token with 24-hour expiration using secure storage
      await storage.setToken(provider, {
        type: 'session' as const,
        token: token,
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24h expiration
      });
      
      // Notify that token is available (for DNR activation)
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'htos.token.extracted',
          provider,
          domain
        }).catch(() => {
          // Ignore errors - this is just a notification
        });
      }
    }
    
    return token;
  } finally {
    // Always clean up iframe
    iframe.remove();
  }
}

/**
 * Create iframe for token extraction from specific provider domain
 */
async function createProviderExtractionIframe(domain: string): Promise<HTMLIFrameElement> {
  const iframe = document.createElement('iframe');
  
  // Point to provider domain for token extraction
  iframe.src = `https://${domain}`;
  iframe.name = `htos-token-extractor-${domain}`;
  iframe.sandbox = 'allow-scripts allow-same-origin allow-storage-access-by-user-activation';
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none';
  
  document.body.appendChild(iframe);
  
  // Wait for iframe to load
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Iframe load timeout')), 10000);
    
    iframe.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    
    iframe.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Iframe load error'));
    };
  });
  
  return iframe;
}

/**
 * Send extraction message to iframe and wait for response
 */
async function sendExtractionMessage(iframe: HTMLIFrameElement, message: any): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const messageId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error('Token extraction timeout'));
    }, 30000); // 30 second timeout
    
    const messageHandler = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow && event.data?.id === messageId) {
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        
        if (event.data.success) {
          resolve(event.data.token);
        } else {
          reject(new Error(event.data.error || 'Token extraction failed'));
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send extraction request
    iframe.contentWindow?.postMessage({
      ...message,
      id: messageId
    }, '*');
  });
}

/**
 * Extract tokens from multiple providers in parallel
 */
export async function extractTokensFromProviders(domains: string[]): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  
  // Extract tokens in parallel
  const extractionPromises = domains.map(async (domain) => {
    try {
      const token = await extractTokenFromProvider(domain);
      results[domain] = token;
    } catch (error) {
      console.error(`[HTOS] Token extraction failed for ${domain}:`, error);
      results[domain] = null;
    }
  });
  
  await Promise.allSettled(extractionPromises);
  return results;
}
