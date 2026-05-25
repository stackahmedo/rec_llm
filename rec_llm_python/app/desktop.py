"""RecLLM Python — Desktop Launcher (pywebview + FastAPI)"""

import asyncio
import threading
import logging
import sys
from pathlib import Path

from app.config import ensure_dirs, APP_DATA_DIR, LOG_FILE
from app.database.db import get_db, close_db
from app.core.job_queue import JobQueue, JobType
from app.core.worker import transcription_worker

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


def start_server(queue: JobQueue):
    """Start FastAPI server in a background thread."""
    import uvicorn
    from app.api import create_app

    app = create_app(queue)
    config = uvicorn.Config(app, host="127.0.0.1", port=8765, log_level="warning")
    server = uvicorn.Server(config)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # Start job queue
    loop.run_until_complete(queue.start())

    # Run server
    loop.run_until_complete(server.serve())


def main():
    """Launch RecLLM as a desktop application."""
    setup_logging()
    logger.info("RecLLM starting...")
    logger.info("Data directory: %s", APP_DATA_DIR)

    # Initialize database
    get_db()

    # Initialize job queue
    queue = JobQueue(max_concurrency=2)
    queue.register_handler(JobType.TRANSCRIBE, transcription_worker)

    # Recover orphaned jobs
    recovered = queue.recover_orphaned_jobs()
    if recovered > 0:
        logger.info("Recovered %d orphaned jobs", recovered)

    # Start server in background thread
    server_thread = threading.Thread(target=start_server, args=(queue,), daemon=True)
    server_thread.start()

    # Give server time to start
    import time
    time.sleep(1.0)

    # Launch desktop window
    try:
        import webview

        window = webview.create_window(
            title="RecLLM — Audio Intelligence",
            url="http://127.0.0.1:8765",
            width=1280,
            height=800,
            min_size=(900, 600),
            resizable=True,
            text_select=True,
        )
        webview.start(debug=False)

    except ImportError:
        # pywebview not available — fall back to browser
        import webbrowser
        logger.info("pywebview not installed. Opening in browser...")
        webbrowser.open("http://127.0.0.1:8765")

        # Keep main thread alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass

    # Cleanup
    close_db()
    logger.info("RecLLM shutdown complete.")


if __name__ == "__main__":
    main()
