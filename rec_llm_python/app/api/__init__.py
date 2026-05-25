"""RecLLM Python Core — FastAPI Application Factory"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.job_queue import JobQueue


def create_app(queue: JobQueue) -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="RecLLM",
        version="0.2.0",
        description="AI-powered audio transcription and document intelligence",
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

    app.include_router(recordings_router, prefix="/api/recordings", tags=["recordings"])
    app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"])
    app.include_router(search_router, prefix="/api/search", tags=["search"])
    app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
    app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
    app.include_router(exports_router, prefix="/api/exports", tags=["exports"])
    app.include_router(watcher_router, prefix="/api/watcher", tags=["watcher"])
    app.include_router(ai_router, prefix="/api/ai", tags=["ai"])
    app.include_router(progress_router, tags=["progress"])

    # Health check
    @app.get("/api/health")
    async def health():
        return {"status": "ok", "version": "0.3.0"}

    # Serve static UI files
    ui_dir = Path(__file__).parent / "ui" / "static"
    if ui_dir.exists():
        app.mount("/", StaticFiles(directory=str(ui_dir), html=True), name="ui")

    return app
