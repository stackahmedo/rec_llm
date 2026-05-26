# Windows Client Build Guide

## Overview

This document describes how to build `RecLLM.exe` — a standalone Windows application that requires NO developer tools on the client PC. The client receives only the EXE file.

## What the Client Gets

- `RecLLM.exe` (~80-120MB single file)
- No Python installation required
- No FFmpeg installation required
- No Node.js, npm, pip, or any developer tools

## Build Machine Requirements

The BUILD machine (developer PC) needs:

| Requirement | Version | Notes |
|-------------|---------|-------|
| Windows 10/11 | 64-bit | Must build on Windows for Windows EXE |
| Python | 3.11+ | python.org installer |
| pip | latest | Comes with Python |

## Build Steps

### 1. Install Python dependencies

```cmd
cd rec_llm_python
pip install -r requirements.txt
pip install pyinstaller pywebview
```

Or install individually:
```cmd
pip install fastapi uvicorn[standard] httpx python-multipart pydantic pydantic-settings watchdog jinja2 python-docx pywebview pyinstaller
```

### 2. Download FFmpeg

Download the **essentials** build from:
https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip

Extract and place these two files in the project:
```
rec_llm_python/
  ffmpeg/
    ffmpeg.exe      ← from the zip's bin/ folder
    ffprobe.exe     ← from the zip's bin/ folder
```

### 3. Build the EXE

```cmd
cd rec_llm_python
pyinstaller recllm.spec --clean
```

### 4. Collect output

The built EXE is at:
```
rec_llm_python/dist/RecLLM.exe
```

This single file is what you deliver to the client.

## How It Works

### FFmpeg Resolution

The app finds FFmpeg in this order:
1. **Bundled** (inside EXE): `_MEIPASS/ffmpeg/ffmpeg.exe` — used in client mode
2. **Next to EXE**: `./ffmpeg/ffmpeg.exe` — fallback if extracted
3. **System PATH**: `shutil.which("ffmpeg")` — development mode only

### Data Storage

All user data is stored in:
```
%APPDATA%\recllm-data\
  rec_llm.sqlite        ← database
  recordings\           ← imported audio files
  chunks\               ← temporary processing chunks
  transcripts\          ← transcript outputs
  exports\              ← PDF/TXT/DOCX exports
  processing.log        ← application log
```

This is user-writable and survives app updates.

### API Keys

Stored in the SQLite database (settings table), NOT in environment variables or config files. The client enters keys through the Settings UI.

## Troubleshooting Build Issues

### "ffmpeg/ffmpeg.exe not found"
The spec file checks for FFmpeg before building. Download and place the binaries as described in step 2.

### "ModuleNotFoundError" during build
Install the missing module: `pip install <module_name>`

### EXE is too large (>200MB)
Check that `excludes` in the spec file is removing unnecessary packages. The expected size is 80-120MB.

### Windows Defender blocks the EXE
Unsigned EXEs trigger SmartScreen. Options:
- Code-sign with a certificate (recommended for production)
- Client clicks "More info" → "Run anyway"

### pywebview window doesn't open
Falls back to opening `http://127.0.0.1:8765` in the default browser automatically.

## Updating the Build

When code changes:
1. Pull latest code
2. Re-run `pyinstaller recllm.spec --clean`
3. Deliver new `dist/RecLLM.exe`

FFmpeg binaries rarely need updating — only re-download if there's a specific codec issue.
