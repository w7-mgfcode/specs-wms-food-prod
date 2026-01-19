"""Redis/Valkey cache client."""

import json
from typing import Any

import redis.asyncio as redis

from app.config import settings

# Create async Redis client (works with Valkey via redis:// scheme)
redis_client: redis.Redis = redis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
)


async def get_cache(key: str) -> Any | None:
    """Get a value from cache."""
    value = await redis_client.get(key)
    if value is not None:
        return json.loads(value)
    return None


async def set_cache(key: str, value: Any, ttl_seconds: int = 300) -> None:
    """Set a value in cache with TTL (default 5 minutes)."""
    await redis_client.setex(key, ttl_seconds, json.dumps(value, default=str))


async def delete_cache(key: str) -> None:
    """Delete a value from cache."""
    await redis_client.delete(key)


async def invalidate_pattern(pattern: str) -> None:
    """Invalidate all cache keys matching a pattern."""
    async for key in redis_client.scan_iter(match=pattern):
        await redis_client.delete(key)


def get_traceability_cache_key(lot_code: str) -> str:
    """Generate cache key for traceability data."""
    return f"traceability:{lot_code}"


async def close_cache() -> None:
    """Close the Redis connection."""
    await redis_client.close()
