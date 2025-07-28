export interface IToken {
  provider: string;
  value: string;            // cookie, JWT, or Arkose token
  expiresAt?: number;       // epoch ms
}

export interface ITokenStore {
  get(provider: string): Promise<IToken | undefined>;
  set(token: IToken): Promise<void>;
  delete(provider: string): Promise<void>;
}