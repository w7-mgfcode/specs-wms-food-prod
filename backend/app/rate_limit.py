"""Rate limiting configuration using SlowAPI.

This module is separate from main.py to avoid circular imports.
Import the limiter from here in route modules.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Initialize rate limiter with Valkey/Redis backend
# In development without Redis, falls back to in-memory storage
# Valid strategies: "fixed-window", "moving-window"
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,
    strategy="fixed-window",
    default_limits=["200/minute"],
)
