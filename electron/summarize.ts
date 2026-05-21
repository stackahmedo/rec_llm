import { ipcMain, net } from 'electron';

async function getSettings(): Promise<{ apiKeys: Record<string, string>; models: Record<string, string>; preferences: Record<string, unknown> }> {
  const { default: Store } = await import('electron-store');
  const store: any = new Store({ name: 'recllm-settings', encryptionKey: 'recllm-local-encryption-key' });
  return {
    apiKeys: (store.get('apiKeys') as Record<string, string>) || {},
    models: (store.get('models') as Record<string, string>) || {},
    preferences: (store.get('preferences') as Record<string, unknown>) || {},
  };
}

interface SummaryRequest {
  transcript: string;
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

function buildPrompt(transcript: string, language: 'en' | 'ja'): string {
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
${transcript.slice(0, 12000)}`;
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await net.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await net.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

async function callGemma(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await net.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Gemma/Groq API error (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

function parseResponse(raw: string): Omit<SummaryResult, 'ok' | 'error'> {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    summary: parsed.summary || '',
    pointNotes: Array.isArray(parsed.pointNotes) ? parsed.pointNotes : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
  };
}

export function registerSummarizeHandlers(): void {
  ipcMain.handle('summarize:generate', async (_event, request: SummaryRequest): Promise<SummaryResult> => {
    const { apiKeys, models, preferences } = await getSettings();
    const provider = (preferences.summaryProvider as string) || 'gemini';

    const apiKey = apiKeys[provider];
    if (!apiKey || apiKey.length < 10) {
      return { ok: false, error: `No API key saved for ${provider}. Go to Settings and save your key.` };
    }

    const model = models[provider] || (provider === 'gemini' ? 'gemini-1.5-pro' : provider === 'chatgpt' ? 'gpt-4o' : 'gemma-2-27b-it');
    const prompt = buildPrompt(request.transcript, request.language);

    try {
      let raw: string;
      if (provider === 'gemini') {
        raw = await callGemini(apiKey, model, prompt);
      } else if (provider === 'chatgpt') {
        raw = await callOpenAI(apiKey, model, prompt);
      } else {
        raw = await callGemma(apiKey, model, prompt);
      }

      const parsed = parseResponse(raw);
      return { ok: true, ...parsed };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Summary generation failed.' };
    }
  });
}
