// Provider adapter interface
export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ProviderResponse {
  text: string;
}

export interface LLMProvider {
  name: string;
  apiFormat: 'openai-compatible' | 'gemini-native' | 'anthropic';
  call(config: ProviderConfig, prompt: string): Promise<ProviderResponse>;
  testConnection(config: ProviderConfig): Promise<{ ok: boolean; error?: string }>;
}

// Shared utilities
export function isHtmlResponse(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML');
}

export function safeParseJson(text: string): any {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string,
    public readonly diagnostic?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
