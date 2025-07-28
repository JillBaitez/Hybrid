/**
 * HTOS Dynamic Iframe Factory
 * Based on HARPA os.js pattern for runtime iframe creation
 * HTOS-PILLAR-CHECK: preserves DNR-before-JS & SW-only authority
 */

export async function createProviderIframe(
  url: string,
  config: { token?: string; provider: string; [key: string]: any }
): Promise<HTMLIFrameElement> {
  const iframe = document.createElement('iframe');
  
  // HARPA pattern: Config via query string, not postMessage
  iframe.src = `${url}?c=${encodeURIComponent(btoa(JSON.stringify(config)))}`;
  iframe.name = `htos-${config.provider}`;
  iframe.sandbox = 'allow-scripts allow-same-origin allow-storage-access-by-user-activation';
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none';
  
  document.body.appendChild(iframe);
  
  // HTOS-PILLAR-CHECK: Iframe created after DNR rules are registered
  console.log(`[HTOS] Dynamic iframe created for ${config.provider}`);
  
  return iframe;
}

/**
 * HARPA pattern: Iframe stability management with 5-minute ping
 */
export function manageIframeStability(
  iframe: HTMLIFrameElement, 
  src: string,
  pingCallback: () => Promise<boolean>
): void {
  setInterval(async () => {
    if (!(await pingCallback())) {
      console.log('[HTOS] Iframe ping failed, restarting...');
      iframe.src = src; // Restart iframe
    }
  }, 5 * 60 * 1000); // 5 minutes
}
