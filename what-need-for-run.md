# What You Need to Run VoiceLens

## System

- **Node.js** 18.18+ (20 LTS recommended)
- **pnpm** 8+ (`npm i -g pnpm`)
- **OS**: macOS, Linux, or Windows (WSL2 recommended on Windows)
- **RAM**: 4 GB free for the dev server; 8 GB+ if you run local Gemma/Whisper
- **Disk**: ~500 MB for `node_modules`, plus space for your audio library

## API Keys (at least one per role)

| Role | Default provider | Where to get a key |
|---|---|---|
| Transcription | AssemblyAI | https://www.assemblyai.com/app/account |
| Summary | Google Gemini | https://aistudio.google.com/app/apikey |
| Summary (alt) | OpenAI ChatGPT | https://platform.openai.com/api-keys |
| Summary (alt) | Gemma via Groq | https://console.groq.com/keys |
| Chat assistant | Anthropic Claude | https://console.anthropic.com/settings/keys |

Keys are pasted in **Settings**, verified with one click, then encrypted (AES-256) and stored in the local vault. They never leave the workspace.

## Install & Run

```bash
pnpm install
pnpm dev
```

Open the URL printed by the dev server.

## Build a Desktop EXE / DMG / AppImage

See **`build-exe.md`** for the full Tauri-based desktop build (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`).

## Optional

- **Self-hosted Gemma / Whisper** — register your endpoint under *Settings → Roles & AI Engines → Add engine*. Any OpenAI-compatible URL works.
- **S3 / Drive export** — set credentials in *Settings → Storage* (forthcoming).
- **OCR on PDFs** — uses Tesseract.js in the browser; no extra install.
- **Japanese / Dual-language UI** — toggle in *Settings → Language*.
