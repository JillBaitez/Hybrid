export interface IOffscreenHost {
  create(): Promise<void>;
  ping(): Promise<boolean>;
  solveArkose(challenge: {
    blob: string;
    difficulty: number;
  }): Promise<string>;
  getLocalStorage(key: string): Promise<string | null>;
}