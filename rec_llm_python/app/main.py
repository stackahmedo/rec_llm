"""RecLLM Python Core — Main Entry Point"""

import asyncio
import logging
import sys
from pathlib import Path

from app.config import ensure_dirs, APP_DATA_DIR, LOG_FILE
from app.database.db import get_db, close_db
from app.core.job_queue import JobQueue

logger = logging.getLogger(__name__)


def setup_logging():
    """Configure application logging."""
    ensure_dirs()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(str(LOG_FILE), encoding="utf-8"),
        ],
    )


async def start_app():
    """Start the RecLLM application."""
    setup_logging()
    logger.info("RecLLM Python starting...")
    logger.info("Data directory: %s", APP_DATA_DIR)

    # Initialize database
    db = get_db()
    logger.info("Database initialized: %s", db)

    # Initialize job queue
    queue = JobQueue(max_concurrency=2)

    # Recover orphaned jobs from previous crash
    recovered = queue.recover_orphaned_jobs()
    if recovered > 0:
        logger.info("Recovered %d orphaned jobs", recovered)

    # Start FastAPI server (lifespan handles queue start/stop)
    try:
        import uvicorn
        from app.api import create_app

        app = create_app(queue)
        config = uvicorn.Config(app, host="127.0.0.1", port=8765, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()
    except KeyboardInterrupt:
        pass
    finally:
        close_db()
        logger.info("RecLLM shutdown complete.")


def main():
    """CLI entry point."""
    asyncio.run(start_app())


if __name__ == "__main__":
    main()
