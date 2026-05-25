#!/usr/bin/env python3
"""RecLLM — Development startup script.

Launches the Python FastAPI backend server.
Usage: python start.py [--port 8765] [--host 127.0.0.1] [--reload]
"""

import argparse
import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent))


def main():
    parser = argparse.ArgumentParser(description="RecLLM Python Backend")
    parser.add_argument("--port", type=int, default=8765, help="Server port (default: 8765)")
    parser.add_argument("--host", default="127.0.0.1", help="Server host (default: 127.0.0.1)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    parser.add_argument("--desktop", action="store_true", help="Launch as desktop app (pywebview)")
    args = parser.parse_args()

    if args.desktop:
        from app.desktop import main as desktop_main
        desktop_main()
    else:
        import uvicorn
        from app.config import ensure_dirs, APP_DATA_DIR, LOG_FILE
        from app.database.db import get_db
        from app.core.job_queue import JobQueue
        from app.api import create_app

        import logging
        ensure_dirs()
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler(str(LOG_FILE), encoding="utf-8"),
            ],
        )

        logger = logging.getLogger(__name__)
        logger.info("RecLLM starting...")
        logger.info("Data directory: %s", APP_DATA_DIR)

        # Initialize
        get_db()
        queue = JobQueue(max_concurrency=2)
        recovered = queue.recover_orphaned_jobs()
        if recovered > 0:
            logger.info("Recovered %d orphaned jobs", recovered)

        app = create_app(queue)

        logger.info("Server: http://%s:%d", args.host, args.port)
        logger.info("API docs: http://%s:%d/docs", args.host, args.port)

        uvicorn.run(
            app,
            host=args.host,
            port=args.port,
            reload=args.reload,
            log_level="info",
        )


if __name__ == "__main__":
    main()
