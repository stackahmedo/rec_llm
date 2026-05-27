"""RecLLM Python Core — Jobs API Routes"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database.db import get_cursor
from app.core.job_queue import JobStatus

router = APIRouter()


@router.get("/")
@router.get("")
async def list_jobs(status: str | None = None, limit: int = 50):
    """List jobs with optional status filter."""
    with get_cursor() as cur:
        if status:
            cur.execute(
                "SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?",
                (status, limit),
            )
        else:
            cur.execute(
                "SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?",
                (limit,),
            )
        rows = cur.fetchall()

    return {"jobs": [dict(r) for r in rows]}


@router.get("/stats")
async def job_stats():
    """Get job queue statistics."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
                SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM jobs
        """)
        stats = cur.fetchone()

    return dict(stats)


@router.post("/{job_id}/retry")
async def retry_job(job_id: int):
    """Retry a failed job."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        job = cur.fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job["status"] != "failed":
            raise HTTPException(status_code=400, detail="Only failed jobs can be retried")

        cur.execute(
            "UPDATE jobs SET status = ?, progress = 0, error_message = NULL WHERE id = ?",
            (JobStatus.QUEUED.value, job_id),
        )

    return {"ok": True, "job_id": job_id}


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: int):
    """Cancel a queued job."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        job = cur.fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job["status"] not in ("queued", "running"):
            raise HTTPException(status_code=400, detail="Job cannot be cancelled")

        cur.execute(
            "UPDATE jobs SET status = ? WHERE id = ?",
            (JobStatus.CANCELLED.value, job_id),
        )

    return {"ok": True}


@router.post("/retry-all-failed")
async def retry_all_failed():
    """Retry all failed jobs."""
    with get_cursor() as cur:
        cur.execute(
            "UPDATE jobs SET status = ?, progress = 0, error_message = NULL WHERE status = ?",
            (JobStatus.QUEUED.value, JobStatus.FAILED.value),
        )
        count = cur.rowcount

    return {"ok": True, "retried": count}
