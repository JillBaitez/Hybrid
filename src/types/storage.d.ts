export interface IStorageRecord {
  key: string;
  value: any;
  updated: number;
}

export interface IHTOSStorage {
  tokens: IToken[];
  logs: IPromptResult[];
  settings: Record<string, unknown>;
}