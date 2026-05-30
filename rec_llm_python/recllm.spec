# -*- mode: python ; coding: utf-8 -*-
"""RecLLM — PyInstaller spec for standalone Windows client build.

Prerequisites (BUILD machine only — not needed on client PC):
    1. Python 3.11+
    2. pip install pyinstaller pywebview uvicorn fastapi httpx python-multipart pydantic
       numpy scipy soundfile
    3. Place FFmpeg binaries in ffmpeg/ folder:
       - ffmpeg/ffmpeg.exe
       - ffmpeg/ffprobe.exe
       (Download from https://www.gyan.dev/ffmpeg/builds/ — "essentials" build)

Build command:
    pyinstaller recllm.spec --clean

Output:
    dist/RecLLM.exe (single-file, ~180-220MB with Speaker Intelligence)

Client receives ONLY RecLLM.exe — no Python, no FFmpeg install needed.
"""

import sys
from pathlib import Path

block_cipher = None

# Verify FFmpeg binaries exist before building
ffmpeg_dir = Path('ffmpeg')
if not (ffmpeg_dir / 'ffmpeg.exe').exists():
    print("ERROR: ffmpeg/ffmpeg.exe not found!")
    print("Download FFmpeg and place ffmpeg.exe + ffprobe.exe in the ffmpeg/ folder.")
    print("Download: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip")
    sys.exit(1)

a = Analysis(
    ['start.py'],
    pathex=['.'],
    binaries=[
        # Bundle FFmpeg binaries inside the EXE
        ('ffmpeg/ffmpeg.exe', 'ffmpeg'),
        ('ffmpeg/ffprobe.exe', 'ffmpeg'),
    ],
    datas=[
        # Bundle static UI files
        ('app/ui/static', 'app/ui/static'),
    ],
    hiddenimports=[
        # Uvicorn internals (not auto-detected by PyInstaller)
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # FastAPI / Starlette
        'fastapi',
        'starlette',
        'starlette.routing',
        'starlette.middleware',
        'starlette.middleware.cors',
        'starlette.responses',
        'starlette.staticfiles',
        'starlette.websockets',
        # HTTP client
        'httpx',
        'httpx._transports',
        'httpx._transports.default',
        'httpcore',
        # Multipart (file uploads)
        'multipart',
        'python_multipart',
        # Desktop window
        'webview',
        # Database
        'sqlite3',
        # Pydantic
        'pydantic',
        'pydantic_settings',
        # Audio analysis (Speaker Intelligence)
        'numpy',
        'scipy',
        'scipy.signal',
        'soundfile',
        # App modules (ensure all are collected)
        'app.runtime',
        'app.config',
        'app.desktop',
        'app.health',
        'app.middleware',
        'app.database.db',
        'app.database.migrations',
        'app.database.backup',
        'app.core.job_queue',
        'app.core.worker',
        'app.audio.ffmpeg_runner',
        'app.audio.duration_detector',
        'app.ai.clients',
        'app.ai.clients.assemblyai_client',
        'app.ai.clients.openai_client',
        'app.ai.clients.gemini_client',
        'app.api',
        'app.api.routes_recordings',
        'app.api.routes_jobs',
        'app.api.routes_search',
        'app.api.routes_settings',
        'app.api.routes_analytics',
        'app.api.routes_exports',
        'app.api.routes_watcher',
        'app.api.routes_ai',
        'app.api.routes_speakers',
        'app.api.routes_batch',
        'app.api.routes_recording_stats',
        'app.api.routes_timeline',
        'app.api.routes_backup',
        'app.api.routes_progress',
        'app.api.routes_diagnostics',
        'app.api.routes_speaker_analysis',
        # Speaker Intelligence services
        'app.schemas.speaker_analysis',
        'app.services.speaker_intelligence',
        'app.services.voice_features',
        'app.services.overlap_detection',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude unnecessary packages (NOT numpy/scipy — needed for Speaker Intelligence)
        'tkinter',
        'matplotlib',
        'pandas',
        'PIL',
        'pytest',
        'IPython',
        'notebook',
        'setuptools',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='RecLLM',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='app/ui/static/favicon.ico' if Path('app/ui/static/favicon.ico').exists() else None,
)
