# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Renderer dev server (React/Vite)
npm run dev

# Full Electron dev (compiles main process + launches app with Vite dev server)
npm run electron:dev

# Type-check renderer then build Vite bundle
npm run build

# Compile Electron main process (TS → electron-dist/)
npm run electron:compile

# Preview production build inside Electron
npm run electron:preview

# Package distributable
npm run dist:mac   # or dist:win
```

There is no test runner or linter configured.

## Architecture

RecLLM is an Electron desktop app for audio transcription, speaker diarization, AI summarization, and PDF report generation. It targets Japanese enterprise users (bilingual EN/JA UI).

### Two TypeScript compilation targets

- **Renderer** (`tsconfig.json`): React 18 + Vite 6, ESNext modules, path alias `@/` → `./src/`. Output is the Vite bundle in `dist/`.
- **Electron main** (`tsconfig.electron.json`): CommonJS targeting Node, source in `electron/`, output in `electron-dist/`.

### Electron main process (`electron/`)

`main.ts` registers IPC handler modules at startup:

| Module | Responsibility |
|--------|---------------|
| `settings.ts` | Persistent user settings |
| `credential-store.ts` | API key encryption via `safeStorage` |
| `assemblyai.ts` | Transcription via AssemblyAI API |
| `summarize.ts` | LLM-based summarization |
| `providers/` | LLM provider registry (Gemini, OpenAI-compatible for ChatGPT/Groq) |
| `long-audio-pipeline.ts` | Chunked processing for 10h+ recordings |
| `audio-preprocess.ts` | FFmpeg-based audio conversion |
| `pdf-export.ts` | PDF report generation |
| `history.ts` | Processing history persistence |
| `export.ts` | File export utilities |

`preload.ts` exposes `window.electronAPI` to the renderer via `contextBridge`.

### Renderer (`src/app/`)

- **Routing**: `App.tsx` uses a `view` state string (no router library). Views are lazy-loaded.
- **State**: React Context providers (`TranscriptProvider`, `UploadJobProvider`) — intentionally no global store so views remain independently portable.
- **i18n**: `i18n.tsx` provides `useT()` hook with inline EN/JA dictionaries. Language type is `"en" | "ja" | "both"`.
- **UI primitives**: `components/ui/` is shadcn/ui (Radix + Tailwind). Don't modify these directly unless customizing a primitive.
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite` plugin. Design tokens in `src/styles/theme.css`.

### Adding a new LLM provider

1. Create `electron/providers/<name>.ts` implementing the `LLMProvider` interface from `types.ts`.
2. Register it in `electron/providers/index.ts` in the `providers` record.

### IPC pattern

All renderer↔main communication goes through `ipcRenderer.invoke` / `ipcMain.handle`. To add a new IPC channel:
1. Add the handler in the relevant `electron/*.ts` module.
2. Expose it in `electron/preload.ts` under `window.electronAPI`.
3. Call it from the renderer via `window.electronAPI.<namespace>.<method>()`.

## Key conventions

- Path alias: use `@/` imports in renderer code (resolves to `src/`).
- Credentials are never stored in plaintext — use `credential-store.ts` with `safeStorage`.
- Audio files are gitignored; the app reads them from user-selected paths at runtime.
- FFmpeg/ffprobe are bundled as `extraResources` in production builds (via `ffmpeg-static`/`ffprobe-static`).
