export { geminiProvider } from './gemini';
export { openaiCompatibleProvider } from './openai-compatible';
export { LLMProvider, ProviderConfig, ProviderResponse, ProviderError, isHtmlResponse, safeParseJson } from './types';

import { geminiProvider } from './gemini';
import { openaiCompatibleProvider } from './openai-compatible';
import { LLMProvider, ProviderConfig } from './types';

// Provider registry — add new providers here
const providers: Record<string, LLMProvider> = {
  gemini: geminiProvider,
  chatgpt: openaiCompatibleProvider,
  groq: openaiCompatibleProvider,
};

export function getProvider(name: string): LLMProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown provider: "${name}". Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

export function getProviderConfig(
  providerName: string,
  apiKey: string,
  model: string,
  opts?: { baseUrl?: string }
): ProviderConfig {
  return {
    apiKey,
    model,
    baseUrl: opts?.baseUrl,
  };
}
