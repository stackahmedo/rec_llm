"""RecLLM Python — Database Backup & Restore Utility"""

import shutil
import logging
from datetime import datetime
from pathlib import Path

from app.config import DB_PATH, APP_DATA_DIR

logger = logging.getLogger(__name__)

BACKUP_DIR = APP_DATA_DIR / "backups"


def create_backup(label: str = "") -> Path:
    """Create a timestamped backup of the database."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = f"_{label}" if label else ""
    backup_name = f"recllm_backup_{timestamp}{suffix}.db"
    backup_path = BACKUP_DIR / backup_name

    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found: {DB_PATH}")

    shutil.copy2(str(DB_PATH), str(backup_path))
    logger.info("Backup created: %s (%.1f MB)", backup_path.name, backup_path.stat().st_size / (1024**2))

    return backup_path


def list_backups() -> list[dict]:
    """List all available backups."""
    if not BACKUP_DIR.exists():
        return []

    backups = []
    for f in sorted(BACKUP_DIR.glob("recllm_backup_*.db"), reverse=True):
        backups.append({
            "name": f.name,
            "path": str(f),
            "size_bytes": f.stat().st_size,
            "size_mb": round(f.stat().st_size / (1024**2), 2),
            "created_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
        })

    return backups


def restore_backup(backup_path: str) -> bool:
    """Restore a database from a backup file."""
    source = Path(backup_path)
    if not source.exists():
        raise FileNotFoundError(f"Backup not found: {backup_path}")

    # Create a safety backup before restoring
    if DB_PATH.exists():
        safety_path = BACKUP_DIR / f"recllm_pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(DB_PATH), str(safety_path))
        logger.info("Safety backup created: %s", safety_path.name)

    shutil.copy2(str(source), str(DB_PATH))
    logger.info("Database restored from: %s", source.name)
    return True


def cleanup_old_backups(keep: int = 10):
    """Remove old backups, keeping the most recent N."""
    if not BACKUP_DIR.exists():
        return 0

    backups = sorted(BACKUP_DIR.glob("recllm_backup_*.db"), key=lambda f: f.stat().st_mtime, reverse=True)
    removed = 0

    for backup in backups[keep:]:
        backup.unlink()
        removed += 1
        logger.info("Removed old backup: %s", backup.name)

    return removed
