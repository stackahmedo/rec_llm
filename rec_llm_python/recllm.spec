# -*- mode: python ; coding: utf-8 -*-
"""RecLLM — PyInstaller spec for Windows EXE build.

Build command (run on Windows):
    pyinstaller recllm.spec --clean

Requirements:
    pip install pyinstaller pywebview uvicorn fastapi httpx
"""

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['start.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('app/ui/static', 'app/ui/static'),
    ],
    hiddenimports=[
        # Uvicorn internals (not auto-detected)
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
        # HTTP client
        'httpx',
        'httpx._transports',
        'httpx._transports.default',
        'httpcore',
        # Desktop (optional)
        'webview',
        # Database
        'sqlite3',
        # App modules
        'app.desktop',
        'app.health',
        'app.database.db',
        'app.database.migrations',
        'app.database.backup',
        'app.core.job_queue',
        'app.core.worker',
        'app.audio.ffmpeg_runner',
        'app.audio.duration_detector',
        'app.ai.clients.assemblyai_client',
        'app.ai.clients.openai_client',
        'app.ai.clients.gemini_client',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'pytest',
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
