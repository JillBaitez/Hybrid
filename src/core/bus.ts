import { BUS_CONFIG, BusMessage, TextEventType } from './bus-events.js';
import { dispatchPrompt } from './dispatch.js';

/**
 * Minimal ServiceWorkerBus for HTOS
 * Provides ask→dispatch→done flow over BroadcastChannel
 */
export class ServiceWorkerBus {
  private channel: BroadcastChannel;
  private isInitialized = false;

  constructor() {
    this.channel = new BroadcastChannel(BUS_CONFIG.CHANNEL_NAME);
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    this.channel.addEventListener('message', this.handleMessage.bind(this));
    this.isInitialized = true;
    console.log('[HTOS] ServiceWorkerBus initialised');
  }

  private async handleMessage(event: MessageEvent<BusMessage>): Promise<void> {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type as TextEventType) {
      case 'ask':
        await this.handleAsk(msg as BusMessage<'ask'>);
        break;
      case 'blobIdToObjectUrl':
        // not implemented yet
        this.sendDone(msg.id, undefined, 'blobIdToObjectUrl not implemented');
        break;
      default:
        this.sendDone(msg.id, undefined, `Unknown message type: ${msg.type}`);
    }
  }

  private async handleAsk(msg: BusMessage<'ask'>): Promise<void> {
    const { prompt, provider } = msg.payload;
    try {
      const job = { id: msg.id, prompt, providers: [provider] } as any;
      const result = await dispatchPrompt(job);
      // We could stream chunks, but for now just return done
      this.sendDone(msg.id, result);
    } catch (error: any) {
      this.sendDone(msg.id, undefined, error?.message || String(error));
    }
  }

  private sendDone(id: string, data?: any, error?: string) {
    const resp: BusMessage<'done'> = {
      id,
      type: 'done',
      payload: { id, usage: undefined, error },
      timestamp: Date.now(),
    } as any;
    if (data) (resp.payload as any).usage = data;
    this.channel.postMessage(resp);
  }
}
