/**
 * HTOS Universal Bus System - Type Definitions
 * 
 * Based on HARPA's proven multi-layered communication architecture
 * Supports all Chrome extension contexts with automatic transport selection
 */

export type BusContext = 'bg' | 'cs' | 'nj' | 'pp' | 'os' | 'oi' | 'fg';

export interface BusMessage {
  $bus: true;
  appName: string;
  name: string;
  args?: any[];
  argsStr?: string;
  reqId?: string;
  locus?: BusContext;
  target?: BusContext | number;
  version?: string;
}

export interface BusHandler {
  fn: Function;
  name: string;
  proxy?: string;
  this?: any;
}

export interface BusConfig {
  appName: string;
  version?: string;
  webUrl?: string;
  debug?: boolean;
}

export interface IBus {
  on(eventName: string, handler: Function, thisArg?: any): void;
  off(eventName: string, handler?: Function): void;
  once(eventName: string, handler: Function): void;
  send(eventName: string, ...args: any[]): Promise<any>;
  call(eventName: string, ...args: any[]): Promise<any>;
  poll(eventName: string, ...args: any[]): Promise<any>;
  getTabId(): Promise<number | null>;
  init(): Promise<void>;
  destroy(): void;
}

export interface SerializedData {
  __type?: string;
  __value?: any;
  __id?: string;
}

export interface ResponseMessage {
  resId: string;
  result?: any;
  error?: string;
}

// HTOS-specific message types
export const HTOSMessageTypes = {
  // Token management
  TOKEN_EXTRACTED: 'htos.token.extracted',
  TOKEN_REFRESH: 'htos.token.refresh',
  TOKEN_STATUS: 'htos.token.status',
  TOKEN_DELETE: 'htos.token.delete',
  
  // DNR coordination
  DNR_ACTIVATE: 'htos.dnr.activate',
  DNR_DEACTIVATE: 'htos.dnr.deactivate',
  DNR_RULES_ACTIVATED: 'htos.dnr.rules_activated',
  
  // System messages
  SYSTEM_READY: 'htos.system.ready',
  SYSTEM_ERROR: 'htos.system.error',
  SYSTEM_HEALTH_CHECK: 'htos.system.health_check',
  
  // Prompt dispatch
  PROMPT_DISPATCH: 'htos.prompt.dispatch',
  PROMPT_RESPONSE: 'htos.prompt.response',
  PROMPT_PROGRESS: 'htos.prompt.progress',
  
  // UI updates
  UI_UPDATE: 'htos.ui.update',
  UI_NOTIFICATION: 'htos.ui.notification',
  UI_STATE_CHANGE: 'htos.ui.state_change',
  
  // Offscreen document
  OFFSCREEN_CREATE: 'htos.offscreen.create',
  OFFSCREEN_READY: 'htos.offscreen.ready',
  OFFSCREEN_IFRAME: 'htos.offscreen.iframe',
  
  // Bus system
  BUS_PROXY: 'bus.proxy',
  BUS_GET_TAB_DATA: 'bus.getTabData',
  BUS_SEND_TO_CS: 'bus.sendToCs',
  BUS_REMOVE_CS_PROXIES: 'bus.removeCsProxies'
} as const;

export type HTOSMessageType = typeof HTOSMessageTypes[keyof typeof HTOSMessageTypes];
