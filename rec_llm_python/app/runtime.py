"""RecLLM — Runtime Resource Resolver

Detects execution mode (development, PyInstaller frozen, installed)
and provides correct paths for bundled resources.
"""

import sys
import shutil
from pathlib import Path


def is_frozen() -> bool:
    """Check if running as a PyInstaller-bundled executable."""
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


def get_bundle_dir() -> Path:
    """Get the base directory for bundled resources.

    - Frozen (PyInstaller): sys._MEIPASS (temp extraction dir)
    - Development: project root (where start.py lives)
    """
    if is_frozen():
        return Path(sys._MEIPASS)
    # Development mode: app/ is one level down from project root
    return Path(__file__).parent.parent


def get_exe_dir() -> Path:
    """Get the directory containing the running executable.

    - Frozen: directory where RecLLM.exe lives
    - Development: project root
    """
    if is_frozen():
        return Path(sys.executable).parent
    return Path(__file__).parent.parent


def get_ffmpeg_path() -> str:
    """Find FFmpeg binary. Search order:

    1. Bundled inside PyInstaller package: _MEIPASS/ffmpeg/ffmpeg.exe
    2. Next to executable: exe_dir/ffmpeg/ffmpeg.exe
    3. Flat next to executable: exe_dir/ffmpeg.exe
    4. System PATH (development mode)
    """
    candidates = [
        get_bundle_dir() / "ffmpeg" / _ffmpeg_name(),
        get_exe_dir() / "ffmpeg" / _ffmpeg_name(),
        get_exe_dir() / _ffmpeg_name(),
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    # Fall back to system PATH
    path = shutil.which("ffmpeg")
    if path:
        return path

    raise FileNotFoundError(
        "FFmpeg not found. For client builds, FFmpeg should be bundled with the app. "
        "For development, install FFmpeg and ensure it's on PATH."
    )


def get_ffprobe_path() -> str:
    """Find FFprobe binary. Same search order as FFmpeg."""
    candidates = [
        get_bundle_dir() / "ffmpeg" / _ffprobe_name(),
        get_exe_dir() / "ffmpeg" / _ffprobe_name(),
        get_exe_dir() / _ffprobe_name(),
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    path = shutil.which("ffprobe")
    if path:
        return path

    raise FileNotFoundError(
        "FFprobe not found. For client builds, FFprobe should be bundled with the app. "
        "For development, install FFmpeg and ensure it's on PATH."
    )


def get_static_dir() -> Path:
    """Get the path to the static UI files directory."""
    return get_bundle_dir() / "app" / "ui" / "static"


def _ffmpeg_name() -> str:
    """Platform-appropriate FFmpeg binary name."""
    return "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"


def _ffprobe_name() -> str:
    """Platform-appropriate FFprobe binary name."""
    return "ffprobe.exe" if sys.platform == "win32" else "ffprobe"
