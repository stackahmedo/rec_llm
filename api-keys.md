# API Keys Guide

## Where keys live

All keys are entered in **Settings**. They are:

1. Validated with a live "Check connection" call.
2. Encrypted with AES-256 using a workspace-derived key.
3. Stored locally — they are never sent to a VoiceLens backend (there isn't one).

## Per-provider notes

### AssemblyAI (transcription)
- Sign up at https://www.assemblyai.com/
- Free tier: 5 hours/month
- Key format: 32 hex chars
- Required scopes: `transcription`, `speaker_labels`

### Google Gemini (summary)
- Get a key at https://aistudio.google.com/app/apikey
- Key format: starts with `AIza`
- Free tier: 15 req/min on `gemini-1.5-flash`
- Use `gemini-1.5-pro` for the 30-item digest (long context)

### OpenAI ChatGPT (summary)
- https://platform.openai.com/api-keys
- Key format: `sk-...`
- Enable **JSON mode** for the structured digest
- Recommended model: `gpt-4o`

### Gemma (summary, open weights)
- Hosted via **Groq** (fastest), **Together**, or **HuggingFace Inference**
- Or self-host with vLLM / Ollama and register the endpoint under *Roles & Engines → Add engine*

### Anthropic Claude (chat assistant)
- https://console.anthropic.com/settings/keys
- Key format: `sk-ant-...`

## Adding a custom engine

Any OpenAI-compatible endpoint works:

1. *Settings → Roles & AI Engines → Add engine*
2. Fill name, model ID, base URL (e.g. `https://api.together.xyz/v1`)
3. Choose auth header (`Bearer`, `x-api-key`, `Basic`, or none for local)
4. Paste key, optionally add JSON extra headers
5. Save → assign to any role from the dropdown

## Rotating keys

Replace the value in Settings and click **Save**. The old key is overwritten in the vault — there is no recovery, by design.
