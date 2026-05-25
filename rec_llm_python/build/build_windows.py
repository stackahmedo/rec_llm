"""PyInstaller Build Script for RecLLM Windows EXE"""

import PyInstaller.__main__
import shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
APP_DIR = ROOT / "app"
UI_DIR = APP_DIR / "ui" / "static"
DIST_DIR = ROOT / "dist"
BUILD_DIR = ROOT / "build_output"


def build():
    """Build RecLLM Windows executable."""
    print("Building RecLLM Windows EXE...")

    # Clean previous builds
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)

    args = [
        str(APP_DIR / "main.py"),
        "--name=RecLLM",
        "--onedir",
        f"--distpath={DIST_DIR}",
        f"--workpath={BUILD_DIR}",
        "--noconfirm",
        "--clean",
        # Include UI static files
        f"--add-data={UI_DIR}{';' if __import__('sys').platform == 'win32' else ':'}app/ui/static",
        # Hidden imports for FastAPI
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespan",
        "--hidden-import=uvicorn.lifespan.on",
        # App icon
        # "--icon=assets/icon.ico",
        # Console hidden for production
        "--windowed",
    ]

    PyInstaller.__main__.run(args)

    # Copy FFmpeg binaries
    ffmpeg_src = ROOT / "ffmpeg.exe"
    ffprobe_src = ROOT / "ffprobe.exe"
    dist_app = DIST_DIR / "RecLLM"

    if ffmpeg_src.exists():
        shutil.copy2(ffmpeg_src, dist_app / "ffmpeg.exe")
        print("  Copied ffmpeg.exe")
    if ffprobe_src.exists():
        shutil.copy2(ffprobe_src, dist_app / "ffprobe.exe")
        print("  Copied ffprobe.exe")

    print(f"\nBuild complete: {dist_app}")
    print(f"  Run: {dist_app / 'RecLLM.exe'}")


if __name__ == "__main__":
    build()
