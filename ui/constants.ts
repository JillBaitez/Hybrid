import { LLMProvider } from './types';


export const LLM_PROVIDERS_CONFIG: LLMProvider[] = [
  // { id: 'chatgpt', name: 'ChatGPT', color: 'text-green-400', logoBgClass: 'bg-green-500' },
  { id: 'claude', name: 'Claude', color: '#FF7F00', logoBgClass: 'bg-orange-500', hostnames: ['claude.ai'] },
  { id: 'gemini', name: 'Gemini', color: '#4285F4', logoBgClass: 'bg-blue-500', hostnames: ['gemini.google.com'] },
  { id: 'deepseek', name: 'DeepSeek', color: '#000000', logoBgClass: 'bg-gray-900', hostnames: [] }, // Or the real hostname
];

export const SIMULATION_CHUNK_DELAY_MS = 70;
export const FIRST_SENTENCE_SUMMARY_CHUNKS = 8;
export const FULL_OUTPUT_CHUNKS = 30;
export const OVERALL_SUMMARY_CHUNKS = 15;

export const EXAMPLE_PROMPT = "Explain the concept of quantum entanglement in simple terms.";

export const STREAMING_PLACEHOLDER = ""; // CSS will handle visual streaming indicators (pulsing dots)
