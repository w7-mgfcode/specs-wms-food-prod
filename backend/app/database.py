"""Async SQLAlchemy database connection and session management.

PgBouncer-optimized configuration with transaction pooling mode.
"""

from sqlalchemy import JSON, String, Uuid
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# PgBouncer-optimized engine configuration
# Transaction pooling mode requires pool_size to match PgBouncer DEFAULT_POOL_SIZE
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=25,           # Match PgBouncer DEFAULT_POOL_SIZE
    max_overflow=10,        # Extra connections during burst
    pool_pre_ping=True,     # Verify connection health before use
    pool_recycle=3600,      # Recycle connections every hour
    pool_timeout=30,        # Wait up to 30s for available connection
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""

    pass


# Type aliases with SQLite variants for testing
JSONB_TYPE = JSONB().with_variant(JSON(), "sqlite")
UUID_TYPE = Uuid(as_uuid=True)
# ARRAY type with JSON fallback for SQLite (stores as JSON array)
ARRAY_STRING_TYPE = ARRAY(String(10)).with_variant(JSON(), "sqlite")


async def init_db() -> None:
    """Initialize database tables (for development/testing only)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()
