import { net } from 'electron';
import { LLMProvider, ProviderConfig, ProviderResponse, ProviderError, isHtmlResponse } from './types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const TIMEOUT_MS = 60000;

export const geminiProvider: LLMProvider = {
  name: 'Gemini',
  apiFormat: 'gemini-native',

  async call(config: ProviderConfig, prompt: string): Promise<ProviderResponse> {
    const url = `${GEMINI_BASE}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Gemini] POST ${url.replace(config.apiKey, '***')} model=${config.model}`);
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      response = await net.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ProviderError('Request timed out after 60s. The model may be overloaded — try again or use a faster model.', undefined, 'Gemini', 'timeout');
      }
      throw new ProviderError(`Network error: ${err.message || 'Connection failed'}`, undefined, 'Gemini', 'network');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Gemini] Response: ${response.status} content-type=${response.headers.get('content-type')}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('Invalid API key. Check your Gemini key in Settings.', response.status, 'Gemini', 'auth');
    }
    if (response.status === 404) {
      throw new ProviderError(`Model "${config.model}" is unavailable or retired. Update your model in Settings.`, 404, 'Gemini', 'model_not_found');
    }
    if (response.status === 429) {
      throw new ProviderError('Rate limit or quota exceeded. Wait a moment and try again.', 429, 'Gemini', 'rate_limit');
    }

    if (response.status !== 200) {
      const text = await response.text();
      if (isHtmlResponse(text)) {
        throw new ProviderError(`Gemini returned an error page (HTTP ${response.status}). The endpoint may be temporarily unavailable.`, response.status, 'Gemini', 'html_response');
      }
      try {
        const errJson = JSON.parse(text);
        const msg = errJson?.error?.message || errJson?.error?.status || text.slice(0, 150);
        throw new ProviderError(`Gemini API error: ${msg}`, response.status, 'Gemini', 'api_error');
      } catch (parseErr: any) {
        if (parseErr instanceof ProviderError) throw parseErr;
        throw new ProviderError(`Gemini API error (${response.status}): ${text.slice(0, 150)}`, response.status, 'Gemini', 'api_error');
      }
    }

    if (!contentType.includes('application/json')) {
      const text = await response.text();
      if (isHtmlResponse(text)) {
        throw new ProviderError('Gemini returned HTML instead of JSON. The API endpoint may have changed.', 200, 'Gemini', 'html_response');
      }
      throw new ProviderError(`Unexpected content-type: ${contentType}. Expected application/json.`, 200, 'Gemini', 'wrong_content_type');
    }

    const data = await response.json() as any;

    if (data.error) {
      throw new ProviderError(`Gemini error: ${data.error.message || JSON.stringify(data.error).slice(0, 150)}`, undefined, 'Gemini', 'api_error');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const blockReason = data.candidates?.[0]?.finishReason;
      if (blockReason && blockReason !== 'STOP') {
        throw new ProviderError(`Response blocked (reason: ${blockReason}). Try a different model.`, undefined, 'Gemini', 'blocked');
      }
      throw new ProviderError('Empty response. The transcript may be too short.', undefined, 'Gemini', 'empty_response');
    }

    return { text };
  },

  async testConnection(config: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
    const url = `${GEMINI_BASE}/v1beta/models/${config.model}?key=${config.apiKey}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await net.fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.status === 200) return { ok: true };
      if (response.status === 401 || response.status === 403) return { ok: false, error: 'Invalid API key.' };
      if (response.status === 404) return { ok: false, error: `Model "${config.model}" not found or retired.` };
      if (response.status === 429) return { ok: false, error: 'Quota exceeded. Try again later.' };

      const text = await response.text();
      if (isHtmlResponse(text)) return { ok: false, error: `Error page returned (HTTP ${response.status}).` };
      return { ok: false, error: `Unexpected status ${response.status}.` };
    } catch (err: any) {
      if (err.name === 'AbortError') return { ok: false, error: 'Connection timed out.' };
      return { ok: false, error: `Network error: ${err.message || 'Connection failed'}` };
    }
  },
};
