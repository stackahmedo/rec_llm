"""RecLLM Python Core — Job Queue (asyncio-based background processing)"""

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from dataclasses import dataclass, field
from typing import Callable, Any

from app.database.db import get_cursor

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    TRANSCRIBE = "transcribe"
    SUMMARIZE = "summarize"
    EXPORT = "export"
    GRAMMAR = "grammar"
    TRANSLATE = "translate"


@dataclass
class Job:
    id: int
    recording_id: str | None
    job_type: JobType
    status: JobStatus
    progress: float = 0.0
    error_message: str | None = None
    metadata: dict = field(default_factory=dict)
    created_at: str = ""
    started_at: str | None = None
    completed_at: str | None = None


class JobQueue:
    """Background job queue with configurable concurrency."""

    def __init__(self, max_concurrency: int = 2):
        self.max_concurrency = max_concurrency
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._handlers: dict[JobType, Callable] = {}
        self._running = False
        self._task: asyncio.Task | None = None
        self._progress_callbacks: list[Callable] = []

    def register_handler(self, job_type: JobType, handler: Callable):
        """Register a handler function for a job type."""
        self._handlers[job_type] = handler

    def on_progress(self, callback: Callable):
        """Register a progress callback."""
        self._progress_callbacks.append(callback)

    def create_job(self, recording_id: str | None, job_type: JobType, metadata: dict | None = None) -> int:
        """Create a new job in the database and return its ID."""
        import json
        now = datetime.now(timezone.utc).isoformat()
        with get_cursor() as cur:
            cur.execute(
                """INSERT INTO jobs (recording_id, job_type, status, progress, metadata, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (recording_id, job_type.value, JobStatus.QUEUED.value, 0.0,
                 json.dumps(metadata or {}), now),
            )
            return cur.lastrowid  # type: ignore

    def update_progress(self, job_id: int, progress: float, status: JobStatus | None = None):
        """Update job progress."""
        with get_cursor() as cur:
            if status:
                cur.execute(
                    "UPDATE jobs SET progress = ?, status = ? WHERE id = ?",
                    (progress, status.value, job_id),
                )
            else:
                cur.execute("UPDATE jobs SET progress = ? WHERE id = ?", (progress, job_id))

        for cb in self._progress_callbacks:
            try:
                cb(job_id, progress, status)
            except Exception:
                pass

    def get_queued_jobs(self) -> list[Job]:
        """Get all queued jobs ordered by creation time."""
        import json
        with get_cursor() as cur:
            cur.execute(
                "SELECT * FROM jobs WHERE status = ? ORDER BY created_at ASC",
                (JobStatus.QUEUED.value,),
            )
            rows = cur.fetchall()
            return [
                Job(
                    id=row["id"],
                    recording_id=row["recording_id"],
                    job_type=JobType(row["job_type"]),
                    status=JobStatus(row["status"]),
                    progress=row["progress"],
                    error_message=row["error_message"],
                    metadata=json.loads(row["metadata"] or "{}"),
                    created_at=row["created_at"],
                    started_at=row["started_at"],
                    completed_at=row["completed_at"],
                )
                for row in rows
            ]

    async def start(self):
        """Start the queue processor loop."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._process_loop())
        logger.info("Job queue started (concurrency=%d)", self.max_concurrency)

    async def stop(self):
        """Stop the queue processor."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Job queue stopped")

    async def _process_loop(self):
        """Main processing loop — polls for queued jobs."""
        while self._running:
            jobs = self.get_queued_jobs()
            if not jobs:
                await asyncio.sleep(1.0)
                continue

            for job in jobs:
                if not self._running:
                    break
                async with self._semaphore:
                    await self._execute_job(job)

            await asyncio.sleep(0.5)

    async def _execute_job(self, job: Job):
        """Execute a single job."""
        handler = self._handlers.get(job.job_type)
        if not handler:
            logger.error("No handler for job type: %s", job.job_type)
            self._mark_failed(job.id, f"No handler registered for {job.job_type}")
            return

        now = datetime.now(timezone.utc).isoformat()
        with get_cursor() as cur:
            cur.execute(
                "UPDATE jobs SET status = ?, started_at = ? WHERE id = ?",
                (JobStatus.RUNNING.value, now, job.id),
            )

        try:
            await handler(job, self)
            self._mark_done(job.id)
        except Exception as e:
            logger.exception("Job %d failed: %s", job.id, e)
            self._mark_failed(job.id, str(e))

    def _mark_done(self, job_id: int):
        """Mark job as completed."""
        now = datetime.now(timezone.utc).isoformat()
        with get_cursor() as cur:
            cur.execute(
                "UPDATE jobs SET status = ?, progress = 100, completed_at = ? WHERE id = ?",
                (JobStatus.DONE.value, now, job_id),
            )

    def _mark_failed(self, job_id: int, error: str):
        """Mark job as failed."""
        now = datetime.now(timezone.utc).isoformat()
        with get_cursor() as cur:
            cur.execute(
                "UPDATE jobs SET status = ?, error_message = ?, completed_at = ? WHERE id = ?",
                (JobStatus.FAILED.value, error[:500], now, job_id),
            )

    def recover_orphaned_jobs(self) -> int:
        """Reset any jobs stuck in 'running' state (crash recovery)."""
        with get_cursor() as cur:
            cur.execute(
                "UPDATE jobs SET status = ?, progress = 0 WHERE status = ?",
                (JobStatus.QUEUED.value, JobStatus.RUNNING.value),
            )
            return cur.rowcount
