"""RecLLM Python — WebSocket Progress Endpoint"""

import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()

# Active WebSocket connections
_connections: Set[WebSocket] = set()


@router.websocket("/ws/progress")
async def progress_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time job progress updates."""
    await websocket.accept()
    _connections.add(websocket)
    logger.info("WebSocket client connected (%d total)", len(_connections))

    try:
        while True:
            # Keep connection alive, handle client messages
            data = await websocket.receive_text()
            # Client can send ping/pong or subscribe to specific jobs
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        _connections.discard(websocket)
        logger.info("WebSocket client disconnected (%d remaining)", len(_connections))


async def broadcast_progress(job_id: int, progress: float, status: str | None = None):
    """Broadcast progress update to all connected clients."""
    if not _connections:
        return

    message = json.dumps({
        "type": "progress",
        "jobId": job_id,
        "progress": progress,
        "status": status,
    })

    disconnected = set()
    for ws in _connections:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.add(ws)

    _connections.difference_update(disconnected)


async def broadcast_event(event_type: str, data: dict):
    """Broadcast a generic event to all connected clients."""
    if not _connections:
        return

    message = json.dumps({"type": event_type, **data})

    disconnected = set()
    for ws in _connections:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.add(ws)

    _connections.difference_update(disconnected)
