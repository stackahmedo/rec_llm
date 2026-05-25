"""RecLLM Python — Backup API Routes"""

from fastapi import APIRouter, HTTPException

from app.database.backup import create_backup, list_backups, restore_backup, cleanup_old_backups

router = APIRouter()


@router.get("/")
async def get_backups():
    """List all available database backups."""
    backups = list_backups()
    return {"backups": backups, "count": len(backups)}


@router.post("/create")
async def create_new_backup(label: str = ""):
    """Create a new database backup."""
    try:
        path = create_backup(label)
        return {"ok": True, "path": str(path), "name": path.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore")
async def restore_from_backup(backup_path: str):
    """Restore database from a backup file."""
    try:
        restore_backup(backup_path)
        return {"ok": True, "restored_from": backup_path}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup")
async def cleanup_backups(keep: int = 10):
    """Remove old backups, keeping the most recent N."""
    removed = cleanup_old_backups(keep)
    return {"ok": True, "removed": removed}
