import { net } from 'electron';
import { LLMProvider, ProviderConfig, ProviderResponse, ProviderError, isHtmlResponse } from './types';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const TIMEOUT_MS = 60000;

export const openaiCompatibleProvider: LLMProvider = {
  name: 'OpenAI Compatible',
  apiFormat: 'openai-compatible',

  async call(config: ProviderConfig, prompt: string): Promise<ProviderResponse> {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[OpenAI] POST ${url} model=${config.model}`);
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      response = await net.fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ProviderError('Request timed out after 60s. The model may be overloaded.', undefined, 'OpenAI', 'timeout');
      }
      throw new ProviderError(`Network error: ${err.message || 'Connection failed'}. Check your base URL and connection.`, undefined, 'OpenAI', 'network');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[OpenAI] Response: ${response.status} content-type=${response.headers.get('content-type')}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (response.status === 401) {
      throw new ProviderError('Invalid API key. Check Settings → AI Providers.', 401, 'OpenAI', 'auth');
    }
    if (response.status === 404) {
      throw new ProviderError(`Model "${config.model}" not found at ${baseUrl}. Check model name and base URL.`, 404, 'OpenAI', 'model_not_found');
    }
    if (response.status === 429) {
      throw new ProviderError('Rate limit or quota exceeded. Wait and try again.', 429, 'OpenAI', 'rate_limit');
    }

    if (response.status !== 200) {
      const text = await response.text();
      if (isHtmlResponse(text)) {
        throw new ProviderError(`Provider returned an error page (HTTP ${response.status}). Check your base URL.`, response.status, 'OpenAI', 'html_response');
      }
      try {
        const errJson = JSON.parse(text);
        const msg = errJson?.error?.message || text.slice(0, 150);
        throw new ProviderError(`Provider error: ${msg}`, response.status, 'OpenAI', 'api_error');
      } catch (parseErr: any) {
        if (parseErr instanceof ProviderError) throw parseErr;
        throw new ProviderError(`Provider error (${response.status}): ${text.slice(0, 150)}`, response.status, 'OpenAI', 'api_error');
      }
    }

    if (!contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
      const text = await response.text();
      if (isHtmlResponse(text)) {
        throw new ProviderError('Provider returned HTML instead of JSON. Check your base URL.', 200, 'OpenAI', 'html_response');
      }
      throw new ProviderError(`Unexpected content-type: ${contentType}. Expected application/json.`, 200, 'OpenAI', 'wrong_content_type');
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new ProviderError('Empty response. The model may not support JSON mode or the prompt was filtered.', undefined, 'OpenAI', 'empty_response');
    }
    return { text: content };
  },

  async testConnection(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}/models`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await net.fetch(url, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 200) return { ok: true };
      if (response.status === 401) return { ok: false, error: 'Invalid API key.' };
      if (response.status === 404) return { ok: false, error: `Wrong base URL. ${baseUrl}/models returned 404.` };
      if (response.status === 429) return { ok: false, error: 'Quota exceeded. Try again later.' };

      const text = await response.text();
      if (isHtmlResponse(text)) return { ok: false, error: `Error page returned (HTTP ${response.status}). Check base URL.` };
      return { ok: false, error: `Unexpected status ${response.status}.` };
    } catch (err: any) {
      if (err.name === 'AbortError') return { ok: false, error: 'Connection timed out.' };
      return { ok: false, error: `Network error: ${err.message || 'Connection failed'}` };
    }
  },
};
