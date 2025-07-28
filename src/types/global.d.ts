declare global {
  interface Window {
    htosApp: any;
    htos: any;
  }
  
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
