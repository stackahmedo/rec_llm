"""RecLLM Python Core — FastAPI Application Factory"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging

from app.core.job_queue import JobQueue

logger = logging.getLogger(__name__)


def create_app(queue: JobQueue) -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="RecLLM",
        version="0.3.1",
        description="AI-powered audio transcription and document intelligence",
    )

    # CORS middleware (allow pywebview and local dev)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request logging
    from app.middleware import RequestLoggingMiddleware
    app.add_middleware(RequestLoggingMiddleware)

    # Global error handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {type(exc).__name__}"},
        )

    # Store queue in app state
    app.state.queue = queue

    # API routes
    from app.api.routes_recordings import router as recordings_router
    from app.api.routes_jobs import router as jobs_router
    from app.api.routes_search import router as search_router
    from app.api.routes_settings import router as settings_router
    from app.api.routes_analytics import router as analytics_router
    from app.api.routes_progress import router as progress_router
    from app.api.routes_exports import router as exports_router
    from app.api.routes_watcher import router as watcher_router
    from app.api.routes_ai import router as ai_router
    from app.api.routes_speakers import router as speakers_router
    from app.api.routes_batch import router as batch_router
    from app.api.routes_recording_stats import router as recording_stats_router
    from app.api.routes_backup import router as backup_router

    app.include_router(recordings_router, prefix="/api/recordings", tags=["recordings"])
    app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"])
    app.include_router(search_router, prefix="/api/search", tags=["search"])
    app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
    app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
    app.include_router(exports_router, prefix="/api/exports", tags=["exports"])
    app.include_router(watcher_router, prefix="/api/watcher", tags=["watcher"])
    app.include_router(ai_router, prefix="/api/ai", tags=["ai"])
    app.include_router(speakers_router, prefix="/api/speakers", tags=["speakers"])
    app.include_router(batch_router, prefix="/api/batch", tags=["batch"])
    app.include_router(recording_stats_router, prefix="/api/recordings", tags=["recording-stats"])
    app.include_router(backup_router, prefix="/api/backup", tags=["backup"])
    app.include_router(progress_router, tags=["progress"])

    # Health check
    @app.get("/api/health")
    async def health():
        return {"status": "ok", "version": "0.3.1"}

    @app.get("/api/health/detailed")
    async def health_detailed():
        from app.health import get_system_health
        return get_system_health()

    # Serve static UI files
    ui_dir = Path(__file__).parent / "ui" / "static"
    if ui_dir.exists():
        app.mount("/", StaticFiles(directory=str(ui_dir), html=True), name="ui")

    return app
