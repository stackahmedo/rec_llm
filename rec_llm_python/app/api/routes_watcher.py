"""RecLLM Python — Folder Watcher API Routes"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.watcher.folder_watcher import FolderWatcher

router = APIRouter()

# Singleton watcher instance
_watcher = FolderWatcher()


class WatcherStartRequest(BaseModel):
    folder_path: str


@router.get("/status")
async def watcher_status():
    """Get folder watcher status."""
    return _watcher.status()


@router.post("/start")
async def start_watcher(req: WatcherStartRequest):
    """Start watching a folder for new audio files."""
    result = _watcher.start(req.folder_path)
    return result


@router.post("/stop")
async def stop_watcher():
    """Stop the folder watcher."""
    _watcher.stop()
    return {"ok": True}
