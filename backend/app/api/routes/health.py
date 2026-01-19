"""Health check endpoint - must match Node/Express response shape."""

from datetime import UTC, datetime

from fastapi import APIRouter, Request

from app.rate_limit import limiter

router = APIRouter(tags=["health"])


@router.get("/health")
@limiter.limit("200/minute")
async def health_check(request: Request) -> dict:
    """
    Health check endpoint.

    Response shape matches Node/Express:
    {
        "status": "ok",
        "timestamp": "<ISO8601>"
    }
    """
    return {
        "status": "ok",
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
