import { ipcMain, net } from 'electron';
import { getProvider, getProviderConfig, safeParseJson, ProviderError } from './providers';
import { getAllApiKeys } from './credential-store';
import { summarizeRequestSchema, validateSchema } from './shared/schemas';

const KNOWN_PROVIDERS = ['gemini', 'chatgpt', 'groq'];

const DEFAULT_OPENAI_BASES: Record<string, string> = {
  chatgpt: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
};

async function getSettings(): Promise<{ apiKeys: Record<string, string>; models: Record<string, string>; preferences: Record<string, unknown>; openaiProvider?: { providerType?: string; baseUrl?: string } }> {
  const { default: Store } = await import('electron-store');
  const store: any = new Store({ name: 'recllm-settings' });
  return {
    apiKeys: getAllApiKeys(),
    models: (store.get('models') as Record<string, string>) || {},
    preferences: (store.get('preferences') as Record<string, unknown>) || {},
    openaiProvider: (store.get('openaiProvider') as { providerType?: string; baseUrl?: string }) || undefined,
  };
}

interface UtteranceInput {
  speaker: string;
  startMs: number;
  text: string;
}

interface SummaryRequest {
  transcript: string;
  utterances?: UtteranceInput[];
  language: 'en' | 'ja';
}

interface SummaryResult {
  ok: boolean;
  error?: string;
  summary?: string;
  pointNotes?: string[];
  actionItems?: string[];
  decisions?: string[];
  risks?: string[];
}

interface ParsedChunk {
  summary: string;
  pointNotes: string[];
  actionItems: string[];
  decisions: string[];
  risks: string[];
}

const CHUNK_CHAR_LIMIT = 10000;

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatUtterances(utterances: UtteranceInput[]): string {
  return utterances.map((u) =>
    `[${msToTimestamp(u.startMs)}] ${u.speaker}: ${u.text}`
  ).join('\n');
}

function chunkByUtterances(utterances: UtteranceInput[]): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const u of utterances) {
    const line = `[${msToTimestamp(u.startMs)}] ${u.speaker}: ${u.text}\n`;
    if (current.length + line.length > CHUNK_CHAR_LIMIT && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += line;
  }
  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }
  return chunks;
}

function chunkByText(text: string): string[] {
  if (text.length <= CHUNK_CHAR_LIMIT) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + CHUNK_CHAR_LIMIT;
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > start) end = lastNewline;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks;
}

function buildChunkPrompt(chunk: string, chunkIndex: number, totalChunks: number, language: 'en' | 'ja'): string {
  const lang = language === 'ja' ? 'Japanese' : 'English';
  return `You are a meeting analyst. Analyze this transcript segment (part ${chunkIndex + 1} of ${totalChunks}) and produce output in ${lang}.

Return a JSON object with these exact keys:
{
  "summary": "A concise 1-2 sentence summary of THIS segment",
  "pointNotes": ["key point 1", "key point 2", ...],
  "actionItems": ["action item 1", ...],
  "decisions": ["decision 1", ...],
  "risks": ["risk or issue 1", ...]
}

Rules:
- summary: 1-2 sentences about this segment only
- pointNotes: key topics discussed in this segment
- actionItems: tasks assigned or mentioned
- decisions: concrete decisions made
- risks: concerns or issues raised
- If a category has no items, use an empty array
- Output ONLY valid JSON, no markdown fences

Transcript segment:
${chunk}`;
}

function buildMergePrompt(chunkSummaries: ParsedChunk[], language: 'en' | 'ja'): string {
  const lang = language === 'ja' ? 'Japanese' : 'English';
  const input = chunkSummaries.map((c, i) => `--- Segment ${i + 1} ---
Summary: ${c.summary}
Points: ${c.pointNotes.join('; ')}
Actions: ${c.actionItems.join('; ')}
Decisions: ${c.decisions.join('; ')}
Risks: ${c.risks.join('; ')}`).join('\n\n');

  return `You are a meeting analyst. Below are summaries of ${chunkSummaries.length} consecutive segments of a single meeting transcript. Merge them into one cohesive final summary in ${lang}.

Return a JSON object with these exact keys:
{
  "summary": "A concise 2-3 sentence overall summary of the entire meeting",
  "pointNotes": ["key point 1", "key point 2", ...],
  "actionItems": ["action item 1", ...],
  "decisions": ["decision 1", ...],
  "risks": ["risk or issue 1", ...]
}

Rules:
- summary: 2-3 sentences covering the whole meeting
- pointNotes: 5-15 deduplicated key points from all segments
- actionItems: all unique action items, deduplicated
- decisions: all unique decisions, deduplicated
- risks: all unique risks/issues, deduplicated
- Remove redundancy — merge similar items
- Output ONLY valid JSON, no markdown fences

Segment summaries:
${input}`;
}

function buildSinglePrompt(transcript: string, language: 'en' | 'ja'): string {
  const lang = language === 'ja' ? 'Japanese' : 'English';
  return `You are a meeting analyst. Analyze the following transcript and produce output in ${lang}.

Return a JSON object with these exact keys:
{
  "summary": "A concise 2-3 sentence summary of the meeting/recording",
  "pointNotes": ["key point 1", "key point 2", ...],
  "actionItems": ["action item 1", "action item 2", ...],
  "decisions": ["decision 1", "decision 2", ...],
  "risks": ["risk or issue 1", "risk or issue 2", ...]
}

Rules:
- summary: 2-3 sentences max
- pointNotes: 5-15 bullet points covering the main topics discussed
- actionItems: specific tasks that were assigned or need to be done
- decisions: concrete decisions that were made
- risks: concerns, blockers, or issues raised
- If a category has no items, use an empty array
- Output ONLY valid JSON, no markdown fences, no explanation

Transcript:
${transcript}`;
}


function parseResponse(raw: string): ParsedChunk {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ProviderError('Failed to parse AI response as JSON. The model may have returned malformed output.', undefined, undefined, 'parse_error');
  }
  return {
    summary: parsed.summary || '',
    pointNotes: Array.isArray(parsed.pointNotes) ? parsed.pointNotes : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
  };
}

async function callLLM(provider: string, apiKey: string, model: string, prompt: string, openaiBaseUrl?: string): Promise<string> {
  const adapter = getProvider(provider);
  const config = getProviderConfig(provider, apiKey, model, { baseUrl: openaiBaseUrl });

  if (process.env.NODE_ENV !== 'production') {
    const safeUrl = provider === 'gemini'
      ? `generativelanguage.googleapis.com/v1beta/models/${model}`
      : `${openaiBaseUrl || DEFAULT_OPENAI_BASES[provider] || 'api.openai.com/v1'}/chat/completions`;
    console.log(`[Summarize] provider=${provider} model=${model} endpoint=${safeUrl}`);
  }

  const result = await adapter.call(config, prompt);
  return result.text;
}

function validateProviderConfig(provider: string, apiKey: string, model: string, openaiBaseUrl?: string): string | null {
  if (!KNOWN_PROVIDERS.includes(provider)) {
    return `Unknown AI provider "${provider}". Select a valid provider in Settings.`;
  }
  if (!apiKey || apiKey.length < 10) {
    return `No API key saved for ${provider}. Go to Settings and save your key.`;
  }
  if (!model || model.length === 0) {
    return `No model configured for ${provider}. Select a model in Settings.`;
  }
  // Validate base URL for OpenAI-compatible providers
  if (provider !== 'gemini' && openaiBaseUrl) {
    try {
      const parsed = new URL(openaiBaseUrl);
      if (!parsed.protocol.startsWith('http')) {
        return `Invalid base URL for ${provider}: must start with http:// or https://`;
      }
    } catch {
      return `Invalid base URL for ${provider}: "${openaiBaseUrl}" is not a valid URL. Check Settings.`;
    }
  }
  return null;
}

function formatProviderError(err: unknown): string {
  if (err instanceof ProviderError) {
    if (err.diagnostic === 'html_response') {
      return 'AI provider configuration is invalid. Check model and base URL in Settings.';
    }
    if (err.diagnostic === 'auth') {
      return `API key is invalid or expired for ${err.provider || 'provider'}. Update your key in Settings.`;
    }
    if (err.diagnostic === 'model_not_found') {
      return err.message;
    }
    if (err.diagnostic === 'network') {
      return `Cannot reach AI provider. Check your internet connection and base URL in Settings.`;
    }
    return err.message;
  }
  if (err instanceof Error) {
    if (err.message.includes('parse') || err.message.includes('JSON')) {
      return 'AI response was malformed. Try again or switch to a different model in Settings.';
    }
    return err.message;
  }
  return 'Summary generation failed. Check AI provider settings.';
}

export function registerSummarizeHandlers(): void {
  ipcMain.handle('summarize:generate', async (_event, request: unknown): Promise<SummaryResult> => {
    const v = validateSchema(summarizeRequestSchema, request);
    if (!v.ok) {
      return { ok: false, error: v.error };
    }
    const { apiKeys, models, preferences, openaiProvider } = await getSettings();
    const provider = (preferences.summaryProvider as string) || 'gemini';

    const apiKey = apiKeys[provider];
    const model = models[provider] || (provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'chatgpt' ? 'gpt-4o' : 'gemma-2-27b-it');
    const openaiBaseUrl = provider !== 'gemini'
      ? (openaiProvider?.providerType === 'custom' ? openaiProvider.baseUrl : DEFAULT_OPENAI_BASES[provider])
      : undefined;

    // Pre-flight validation
    const configError = validateProviderConfig(provider, apiKey, model, openaiBaseUrl);
    if (configError) {
      return { ok: false, error: configError };
    }

    try {
      // Determine chunks
      let chunks: string[];
      if (v.data.utterances && v.data.utterances.length > 0) {
        chunks = chunkByUtterances(v.data.utterances);
      } else {
        chunks = chunkByText(v.data.transcript);
      }

      // Single chunk — direct summarization
      if (chunks.length === 1) {
        const prompt = buildSinglePrompt(chunks[0], v.data.language);
        const raw = await callLLM(provider, apiKey, model, prompt, openaiBaseUrl);
        const parsed = parseResponse(raw);
        return { ok: true, ...parsed };
      }

      // Multiple chunks — summarize each, then merge
      const chunkResults: ParsedChunk[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const prompt = buildChunkPrompt(chunks[i], i, chunks.length, v.data.language);
        const raw = await callLLM(provider, apiKey, model, prompt, openaiBaseUrl);
        chunkResults.push(parseResponse(raw));
      }

      // Merge all chunk summaries
      const mergePrompt = buildMergePrompt(chunkResults, v.data.language);
      const mergeRaw = await callLLM(provider, apiKey, model, mergePrompt, openaiBaseUrl);
      const merged = parseResponse(mergeRaw);
      return { ok: true, ...merged };
    } catch (err: any) {
      return { ok: false, error: formatProviderError(err) };
    }
  });
}
