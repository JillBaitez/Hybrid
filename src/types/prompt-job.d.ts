export interface IPromptJob {
  id: string;
  prompt: string;
  providers: string[];               // keys matching adapter names
  timeout?: number;                  // ms
}

export interface IProviderResult {
  provider: string;
  raw: string;
  duration: number;
  error?: string;
}

export interface IPromptResult {
  jobId: string;
  results: IProviderResult[];
  merged?: string;
}