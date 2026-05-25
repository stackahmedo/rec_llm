"""RecLLM Python Core — Configuration"""

import os
import sys
from pathlib import Path


def get_app_data_dir() -> Path:
    """Get platform-appropriate application data directory."""
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "recllm-data"


# Paths
APP_DATA_DIR = get_app_data_dir()
DB_PATH = APP_DATA_DIR / "rec_llm.sqlite"
RECORDINGS_DIR = APP_DATA_DIR / "recordings"
CHUNKS_DIR = APP_DATA_DIR / "chunks"
TRANSCRIPTS_DIR = APP_DATA_DIR / "transcripts"
EXPORTS_DIR = APP_DATA_DIR / "exports"
LOG_FILE = APP_DATA_DIR / "processing.log"

# Audio
AUDIO_EXTENSIONS = {"mp3", "wav", "m4a", "mp4", "aac", "flac", "ogg", "wma"}
CHUNK_DURATION_NORMAL_MIN = 45
CHUNK_DURATION_ENTERPRISE_MIN = 25
MAX_AUDIO_HOURS = 30

# Processing
MAX_RETRIES = 3
CONCURRENCY_NORMAL = 2
CONCURRENCY_ENTERPRISE = 1
RATE_LIMIT_DELAY_SEC = 1.5

# Tier thresholds (hours)
TIER_LONG_AUDIO = 2.0
TIER_ENTERPRISE = 10.0
TIER_BLOCKED = 30.0

# API defaults
DEFAULT_ASSEMBLYAI_MODEL = "best"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_OPENAI_MODEL = "gpt-4o"

# Logging
MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024  # 5MB


def ensure_dirs():
    """Create all required directories."""
    for d in [APP_DATA_DIR, RECORDINGS_DIR, CHUNKS_DIR, TRANSCRIPTS_DIR, EXPORTS_DIR]:
        d.mkdir(parents=True, exist_ok=True)
