/**
 * HTOS Universal Bus System - Message Serializer
 * 
 * Handles complex data serialization/deserialization for cross-context messaging
 * Based on HARPA's proven serialization patterns with HTOS-specific optimizations
 */

import { SerializedData } from './types';

export class Serializer {
  private static blobStore = new Map<string, Blob>();
  private static functionStore = new Map<string, Function>();

  /**
   * Serialize data for cross-context transmission
   */
  static serialize(data: any): string {
    try {
      return JSON.stringify(data, (key, value) => {
        // Handle functions (store reference for security)
        if (typeof value === 'function') {
          const id = this.generateId();
          this.functionStore.set(id, value);
          return { __type: 'function', __id: id, __name: value.name || 'anonymous' };
        }
        
        // Handle undefined
        if (value === undefined) {
          return { __type: 'undefined' };
        }
        
        // Handle Date objects
        if (value instanceof Date) {
          return { __type: 'date', __value: value.toISOString() };
        }
        
        // Handle RegExp
        if (value instanceof RegExp) {
          return { __type: 'regexp', __value: value.toString() };
        }
        
        // Handle Error objects
        if (value instanceof Error) {
          return {
            __type: 'error',
            __value: {
              name: value.name,
              message: value.message,
              stack: value.stack
            }
          };
        }
        
        // Handle Blob objects (store reference)
        if (value instanceof Blob) {
          const id = this.generateId();
          this.storeBlob(id, value);
          return { 
            __type: 'blob', 
            __id: id, 
            __value: { 
              type: value.type, 
              size: value.size 
            } 
          };
        }
        
        // Handle ArrayBuffer
        if (value instanceof ArrayBuffer) {
          return {
            __type: 'arraybuffer',
            __value: Array.from(new Uint8Array(value))
          };
        }
        
        // Handle Map objects
        if (value instanceof Map) {
          return {
            __type: 'map',
            __value: Array.from(value.entries())
          };
        }
        
        // Handle Set objects
        if (value instanceof Set) {
          return {
            __type: 'set',
            __value: Array.from(value.values())
          };
        }
        
        return value;
      });
    } catch (error) {
      console.warn('[HTOS Bus] Serialization failed:', error);
      return JSON.stringify({ 
        __type: 'error', 
        __value: { 
          name: 'SerializationError', 
          message: 'Failed to serialize data' 
        } 
      });
    }
  }

  /**
   * Deserialize data from cross-context transmission
   */
  static deserialize(data: string): any {
    try {
      return JSON.parse(data, (key, value) => {
        if (value && typeof value === 'object' && value.__type) {
          const serializedData = value as SerializedData;
          
          switch (serializedData.__type) {
            case 'function':
              // Return function reference or placeholder
              if (serializedData.__id) {
                const fn = this.functionStore.get(serializedData.__id);
                if (fn) return fn;
              }
              // Return placeholder function for security
              return function placeholder() {
                throw new Error(`Function ${serializedData.__value || 'anonymous'} not available in this context`);
              };
              
            case 'undefined':
              return undefined;
              
            case 'date':
              return new Date(serializedData.__value);
              
            case 'regexp':
              const match = serializedData.__value.match(/^\/(.*)\/([gimuy]*)$/);
              return match ? new RegExp(match[1], match[2]) : new RegExp(serializedData.__value);
              
            case 'error':
              const errorData = serializedData.__value;
              const error = new Error(errorData.message);
              error.name = errorData.name;
              if (errorData.stack) error.stack = errorData.stack;
              return error;
              
            case 'blob':
              if (serializedData.__id) {
                return this.getBlob(serializedData.__id);
              }
              return null;
              
            case 'arraybuffer':
              return new Uint8Array(serializedData.__value).buffer;
              
            case 'map':
              return new Map(serializedData.__value);
              
            case 'set':
              return new Set(serializedData.__value);
              
            default:
              return value;
          }
        }
        return value;
      });
    } catch (error) {
      console.warn('[HTOS Bus] Deserialization failed:', error);
      return { 
        error: 'Deserialization failed', 
        originalData: data.substring(0, 100) + '...' 
      };
    }
  }

  /**
   * Store blob with automatic cleanup
   */
  private static storeBlob(id: string, blob: Blob): void {
    this.blobStore.set(id, blob);
    
    // Clean up after 5 minutes to prevent memory leaks
    setTimeout(() => {
      this.blobStore.delete(id);
    }, 5 * 60 * 1000);
  }

  /**
   * Retrieve stored blob
   */
  private static getBlob(id: string): Blob | null {
    return this.blobStore.get(id) || null;
  }

  /**
   * Store function reference with automatic cleanup
   */
  private static storeFunction(id: string, fn: Function): void {
    this.functionStore.set(id, fn);
    
    // Clean up after 10 minutes
    setTimeout(() => {
      this.functionStore.delete(id);
    }, 10 * 60 * 1000);
  }

  /**
   * Generate unique ID for references
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Check if data needs serialization
   */
  static needsSerialization(data: any): boolean {
    if (data === null || data === undefined) return false;
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') return false;
    
    // Check for complex types that need serialization
    const hasComplexTypes = (obj: any): boolean => {
      if (obj instanceof Date || obj instanceof RegExp || obj instanceof Error) return true;
      if (obj instanceof Blob || obj instanceof ArrayBuffer) return true;
      if (obj instanceof Map || obj instanceof Set) return true;
      if (typeof obj === 'function') return true;
      
      if (Array.isArray(obj)) {
        return obj.some(hasComplexTypes);
      }
      
      if (obj && typeof obj === 'object') {
        return Object.values(obj).some(hasComplexTypes);
      }
      
      return false;
    };
    
    return hasComplexTypes(data);
  }

  /**
   * Get serialization stats
   */
  static getStats(): {
    blobsStored: number;
    functionsStored: number;
  } {
    return {
      blobsStored: this.blobStore.size,
      functionsStored: this.functionStore.size
    };
  }

  /**
   * Clear all stored references (for cleanup)
   */
  static clearAll(): void {
    this.blobStore.clear();
    this.functionStore.clear();
  }
}
