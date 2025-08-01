/**
 * HTOS Streaming Response Handler
 * 
 * Handles chunked streaming responses from AI providers
 * Manages stream reassembly, backpressure, and error recovery
 * HTOS-PILLAR-CHECK: Reliable streaming with progress tracking and error recovery
 */

import { 
  StreamStartMessage,
  StreamChunkMessage,
  StreamEndMessage,
  PromptProgressMessage,
  MessageSource
} from '../types/message-bus';
import { HTOSMessageBus } from './message-bus';

export interface StreamOptions {
  maxChunkSize?: number;
  timeout?: number;
  retryAttempts?: number;
  progressCallback?: (progress: number) => void;
}

export interface ActiveStream {
  id: string;
  promptId: string;
  provider: string;
  contentType: string;
  totalSize?: number;
  receivedChunks: Map<number, string>;
  expectedSequence: number;
  lastActivity: number;
  isComplete: boolean;
  buffer: string;
  options: Required<StreamOptions>;
}

/**
 * Streaming Response Handler
 */
export class StreamingHandler {
  private bus: HTOSMessageBus;
  private activeStreams = new Map<string, ActiveStream>();
  private cleanupInterval: number;

  constructor(bus: HTOSMessageBus) {
    this.bus = bus;
    
    // Setup stream message subscriptions
    this.setupSubscriptions();
    
    // Cleanup stale streams every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleStreams();
    }, 30000);
  }

  /**
   * Setup message subscriptions for streaming
   */
  private setupSubscriptions(): void {
    this.bus.subscribe<StreamStartMessage>('htos.stream.start', async (message) => {
      await this.handleStreamStart(message);
    });

    this.bus.subscribe<StreamChunkMessage>('htos.stream.chunk', async (message) => {
      await this.handleStreamChunk(message);
    });

    this.bus.subscribe<StreamEndMessage>('htos.stream.end', async (message) => {
      await this.handleStreamEnd(message);
    });
  }

  /**
   * Start a new streaming response
   */
  async startStream(
    promptId: string,
    provider: string,
    contentType: string = 'text/plain',
    options: StreamOptions = {}
  ): Promise<string> {
    const streamId = crypto.randomUUID();
    
    const stream: ActiveStream = {
      id: streamId,
      promptId,
      provider,
      contentType,
      receivedChunks: new Map(),
      expectedSequence: 0,
      lastActivity: Date.now(),
      isComplete: false,
      buffer: '',
      options: {
        maxChunkSize: options.maxChunkSize || 8192,
        timeout: options.timeout || 30000,
        retryAttempts: options.retryAttempts || 3,
        progressCallback: options.progressCallback || (() => {})
      }
    };

    this.activeStreams.set(streamId, stream);

    // Notify stream start
    await this.bus.send<StreamStartMessage>('htos.stream.start', {
      streamId,
      contentType,
      totalSize: options.maxChunkSize
    });

    console.log(`[HTOS] Started stream ${streamId} for prompt ${promptId}`);
    return streamId;
  }

  /**
   * Send a chunk of streaming data
   */
  async sendChunk(
    streamId: string,
    chunk: string,
    sequence: number,
    isLast: boolean = false
  ): Promise<void> {
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      console.warn(`[HTOS] Attempted to send chunk to unknown stream: ${streamId}`);
      return;
    }

    await this.bus.send<StreamChunkMessage>('htos.stream.chunk', {
      streamId,
      chunk,
      sequence,
      isLast
    });

    // Update progress
    if (stream.totalSize) {
      const progress = Math.min(100, (stream.buffer.length / stream.totalSize) * 100);
      await this.updateProgress(stream, progress);
    }
  }

  /**
   * End a stream
   */
  async endStream(streamId: string, success: boolean = true, error?: string): Promise<void> {
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      console.warn(`[HTOS] Attempted to end unknown stream: ${streamId}`);
      return;
    }

    stream.isComplete = true;

    await this.bus.send<StreamEndMessage>('htos.stream.end', {
      streamId,
      success,
      error,
      totalChunks: stream.receivedChunks.size
    });

    // Final progress update
    await this.updateProgress(stream, success ? 100 : -1);

    // Clean up
    this.activeStreams.delete(streamId);
    console.log(`[HTOS] Ended stream ${streamId} (success: ${success})`);
  }

  /**
   * Get complete stream content
   */
  getStreamContent(streamId: string): string | null {
    const stream = this.activeStreams.get(streamId);
    return stream ? stream.buffer : null;
  }

  /**
   * Handle stream start message
   */
  private async handleStreamStart(message: StreamStartMessage): Promise<void> {
    const { streamId, contentType, totalSize } = message.data;
    
    // Update existing stream or log if not found
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.contentType = contentType;
      stream.totalSize = totalSize;
      stream.lastActivity = Date.now();
    }

    console.log(`[HTOS] Stream ${streamId} started (${contentType})`);
  }

  /**
   * Handle stream chunk message
   */
  private async handleStreamChunk(message: StreamChunkMessage): Promise<void> {
    const { streamId, chunk, sequence, isLast } = message.data;
    
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      console.warn(`[HTOS] Received chunk for unknown stream: ${streamId}`);
      return;
    }

    stream.lastActivity = Date.now();

    // Handle out-of-order chunks
    if (sequence === stream.expectedSequence) {
      // In-order chunk - add to buffer immediately
      stream.buffer += chunk;
      stream.receivedChunks.set(sequence, chunk);
      stream.expectedSequence++;

      // Process any buffered chunks that are now in order
      while (stream.receivedChunks.has(stream.expectedSequence)) {
        const nextChunk = stream.receivedChunks.get(stream.expectedSequence)!;
        stream.buffer += nextChunk;
        stream.receivedChunks.delete(stream.expectedSequence);
        stream.expectedSequence++;
      }
    } else if (sequence > stream.expectedSequence) {
      // Out-of-order chunk - buffer it
      stream.receivedChunks.set(sequence, chunk);
    } else {
      // Duplicate or old chunk - ignore
      console.warn(`[HTOS] Received duplicate/old chunk ${sequence} for stream ${streamId}`);
      return;
    }

    // Update progress
    if (stream.totalSize) {
      const progress = Math.min(100, (stream.buffer.length / stream.totalSize) * 100);
      await this.updateProgress(stream, progress);
    }

    // Trigger progress callback
    stream.options.progressCallback(stream.buffer.length);

    // If this is the last chunk, we might be done
    if (isLast) {
      await this.checkStreamCompletion(stream);
    }
  }

  /**
   * Handle stream end message
   */
  private async handleStreamEnd(message: StreamEndMessage): Promise<void> {
    const { streamId, success, error, totalChunks } = message.data;
    
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      console.warn(`[HTOS] Received end for unknown stream: ${streamId}`);
      return;
    }

    stream.isComplete = true;

    if (success) {
      console.log(`[HTOS] Stream ${streamId} completed successfully (${totalChunks} chunks, ${stream.buffer.length} chars)`);
    } else {
      console.error(`[HTOS] Stream ${streamId} failed: ${error}`);
    }

    // Final progress update
    await this.updateProgress(stream, success ? 100 : -1);

    // Keep stream for a short time in case there are late chunks
    setTimeout(() => {
      this.activeStreams.delete(streamId);
    }, 5000);
  }

  /**
   * Update progress for a stream
   */
  private async updateProgress(stream: ActiveStream, progress: number): Promise<void> {
    await this.bus.send<PromptProgressMessage>('htos.prompt.progress', {
      promptId: stream.promptId,
      provider: stream.provider,
      progress,
      stage: progress === 100 ? 'complete' : 
             progress === -1 ? 'error' : 
             progress === 0 ? 'queued' : 'receiving'
    });
  }

  /**
   * Check if stream is complete
   */
  private async checkStreamCompletion(stream: ActiveStream): Promise<void> {
    // Check if we have all expected chunks (this is a simple heuristic)
    const hasGaps = Array.from(stream.receivedChunks.keys()).some(seq => seq > stream.expectedSequence);
    
    if (!hasGaps) {
      // No gaps detected, stream appears complete
      await this.endStream(stream.id, true);
    }
  }

  /**
   * Clean up stale streams
   */
  private cleanupStaleStreams(): void {
    const now = Date.now();
    const staleThreshold = 60000; // 1 minute

    for (const [streamId, stream] of this.activeStreams) {
      if (now - stream.lastActivity > staleThreshold) {
        console.warn(`[HTOS] Cleaning up stale stream: ${streamId}`);
        this.endStream(streamId, false, 'Stream timeout');
      }
    }
  }

  /**
   * Get stream statistics
   */
  getStats(): {
    activeStreams: number;
    totalBytesBuffered: number;
    averageChunkSize: number;
  } {
    let totalBytes = 0;
    let totalChunks = 0;

    for (const stream of this.activeStreams.values()) {
      totalBytes += stream.buffer.length;
      totalChunks += stream.receivedChunks.size;
    }

    return {
      activeStreams: this.activeStreams.size,
      totalBytesBuffered: totalBytes,
      averageChunkSize: totalChunks > 0 ? totalBytes / totalChunks : 0
    };
  }

  /**
   * Destroy the streaming handler
   */
  destroy(): void {
    // End all active streams
    for (const streamId of this.activeStreams.keys()) {
      this.endStream(streamId, false, 'Handler destroyed');
    }

    // Clear cleanup interval
    clearInterval(this.cleanupInterval);

    console.log('[HTOS] Streaming handler destroyed');
  }
}

/**
 * Stream Buffer Utility
 * Helps manage streaming text assembly with word boundary preservation
 */
export class StreamBuffer {
  private buffer = '';
  private wordBoundaryPattern = /\s+/;

  /**
   * Add chunk to buffer
   */
  addChunk(chunk: string): void {
    this.buffer += chunk;
  }

  /**
   * Get complete words from buffer, leaving partial words for next chunk
   */
  getCompleteWords(): string {
    const lastSpaceIndex = this.buffer.lastIndexOf(' ');
    
    if (lastSpaceIndex === -1) {
      // No complete words yet
      return '';
    }

    const completeWords = this.buffer.substring(0, lastSpaceIndex + 1);
    this.buffer = this.buffer.substring(lastSpaceIndex + 1);
    
    return completeWords;
  }

  /**
   * Get all remaining content (for stream end)
   */
  flush(): string {
    const remaining = this.buffer;
    this.buffer = '';
    return remaining;
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = '';
  }
}
