"""RecLLM Python Core — Folder Watcher (watchdog-based)"""

import logging
import time
from pathlib import Path
from dataclasses import dataclass, field
from threading import Thread

from app.config import AUDIO_EXTENSIONS

logger = logging.getLogger(__name__)


@dataclass
class WatcherState:
    active: bool = False
    folder_path: str | None = None
    known_files: set = field(default_factory=set)
    on_new_files: list = field(default_factory=list)  # callbacks


class FolderWatcher:
    """Watch a folder for new audio files and notify callbacks."""

    def __init__(self):
        self._state = WatcherState()
        self._thread: Thread | None = None
        self._stop_flag = False

    @property
    def active(self) -> bool:
        return self._state.active

    @property
    def folder_path(self) -> str | None:
        return self._state.folder_path

    @property
    def known_file_count(self) -> int:
        return len(self._state.known_files)

    def on_new_files(self, callback):
        """Register a callback for new file detection."""
        self._state.on_new_files.append(callback)

    def start(self, folder_path: str) -> dict:
        """Start watching a folder."""
        path = Path(folder_path)
        if not path.exists() or not path.is_dir():
            return {"ok": False, "error": f"Folder not found: {folder_path}"}

        if self._state.active:
            self.stop()

        # Scan existing files
        existing = self._scan_folder(path)
        self._state.known_files = existing
        self._state.folder_path = folder_path
        self._state.active = True
        self._stop_flag = False

        # Start polling thread
        self._thread = Thread(target=self._poll_loop, daemon=True)
        self._thread.start()

        logger.info("Folder watcher started: %s (%d existing files)", folder_path, len(existing))
        return {"ok": True, "fileCount": len(existing)}

    def stop(self):
        """Stop watching."""
        self._stop_flag = True
        self._state.active = False
        self._state.folder_path = None
        self._state.known_files.clear()
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        logger.info("Folder watcher stopped")

    def status(self) -> dict:
        return {
            "active": self._state.active,
            "folderPath": self._state.folder_path,
            "knownFileCount": len(self._state.known_files),
        }

    def _poll_loop(self):
        """Poll for new files every 2 seconds."""
        while not self._stop_flag and self._state.active:
            try:
                if self._state.folder_path:
                    path = Path(self._state.folder_path)
                    current = self._scan_folder(path)
                    new_files = current - self._state.known_files

                    if new_files:
                        self._state.known_files = current
                        self._notify_new_files(new_files)
            except Exception as e:
                logger.warning("Folder watcher error: %s", e)

            time.sleep(2.0)

    def _scan_folder(self, folder: Path) -> set[str]:
        """Scan folder for audio files (non-recursive for safety)."""
        files = set()
        try:
            for f in folder.iterdir():
                if f.is_file() and f.suffix.lstrip(".").lower() in AUDIO_EXTENSIONS:
                    files.add(str(f))
        except PermissionError:
            logger.warning("Permission denied: %s", folder)
        return files

    def _notify_new_files(self, new_files: set[str]):
        """Notify callbacks about new files."""
        file_metas = []
        for fp in new_files:
            p = Path(fp)
            file_metas.append({
                "fileName": p.name,
                "filePath": str(p),
                "sizeBytes": p.stat().st_size if p.exists() else 0,
                "extension": p.suffix.lstrip(".").lower(),
            })

        logger.info("Folder watcher: %d new files detected", len(file_metas))
        for callback in self._state.on_new_files:
            try:
                callback(file_metas)
            except Exception as e:
                logger.warning("Watcher callback error: %s", e)
