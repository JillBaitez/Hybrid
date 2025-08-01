declare global {
  interface Window {
    // HTOS global app instance (HARPA-inspired architecture)
    htosApp?: any;
    
    // Legacy/alternative HTOS reference
    htos?: any;
    
    // AI provider globals
    ai?: any;
    arkose?: any;
  }
  
  // Chrome Extension API extensions
  namespace chrome.runtime {
    interface ContextFilter {
      contextTypes?: string[];
    }
    
    interface Context {
      contextType: string;
      contextId: string;
      tabId?: number;
      windowId?: number;
      frameId?: number;
    }
    
    function getContexts(filter: ContextFilter): Promise<Context[]>;
  }
}

export {};
