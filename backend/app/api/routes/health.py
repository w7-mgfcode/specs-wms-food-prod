"""Health check endpoint - must match Node/Express response shape."""

from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
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
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
