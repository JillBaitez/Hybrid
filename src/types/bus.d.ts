export interface IBusMessage<T = unknown> {
  id: string;          // UUID
  type: string;        // e.g. 'htos.pow.solve', 'htos.storage.get'
  payload: T;
}

export interface IBusResponse<T = unknown> {
  id: string;
  ok: boolean;
  data?: T;
  error?: string;
}

export interface IBlobRef {
  __htosBlobId: string;
}