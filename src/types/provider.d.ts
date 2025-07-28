export interface IProviderConfig {
  name: string;
  domain: string;
  loginUrl?: string;
  promptUrl: string;
  selectors: {
    username?: string;
    password?: string;
    submit?: string;
    promptTextarea?: string;
    sendButton?: string;
    outputSelector?: string;
  };
  headers?: Record<string, string>;
}

export interface IProviderAdapter {
  readonly config: IProviderConfig;
  login(): Promise<string>;                // returns cookie / JWT / Arkose token
  sendPrompt(text: string, token: string): Promise<string>;
}