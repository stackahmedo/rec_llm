"""RecLLM Python — Request Validation Middleware"""

import time
import logging
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Rate limiting: max requests per window
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 120  # requests per window
RATE_LIMIT_UPLOAD_MAX = 10  # uploads per window


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter for localhost API."""

    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._upload_requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        # Clean old entries
        self._requests[client_ip] = [
            t for t in self._requests[client_ip] if now - t < RATE_LIMIT_WINDOW
        ]

        # Check general rate limit
        if len(self._requests[client_ip]) >= RATE_LIMIT_MAX:
            logger.warning("Rate limit exceeded for %s", client_ip)
            raise HTTPException(status_code=429, detail="Too many requests")

        # Check upload rate limit
        if request.url.path.endswith("/upload") and request.method == "POST":
            self._upload_requests[client_ip] = [
                t for t in self._upload_requests[client_ip] if now - t < RATE_LIMIT_WINDOW
            ]
            if len(self._upload_requests[client_ip]) >= RATE_LIMIT_UPLOAD_MAX:
                raise HTTPException(status_code=429, detail="Upload rate limit exceeded")
            self._upload_requests[client_ip].append(now)

        self._requests[client_ip].append(now)
        response = await call_next(request)
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log API requests with timing."""

    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        # Only log API requests, not static files
        if request.url.path.startswith("/api") or request.url.path.startswith("/ws"):
            logger.info(
                "%s %s → %d (%.1fms)",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )

        return response
