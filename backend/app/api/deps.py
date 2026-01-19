"""API dependencies for dependency injection."""

import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.user import User
from app.services.auth import decode_access_token

# Security scheme for JWT tokens
security = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession]:
    """
    Dependency that provides an async database session.

    This is the SINGLE SOURCE OF TRUTH for database session management.
    All route handlers should use this dependency via `Depends(get_db)`.

    The session automatically commits on success and rolls back on exception.
    For testing, override this dependency in `app.dependency_overrides`.

    Usage:
        @router.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """
    Get the current authenticated user from JWT token.

    Returns None if no valid token is provided (for optional auth).
    """
    if credentials is None:
        return None

    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    # Validate user_id is a valid UUID before database query
    try:
        user_uuid = uuid.UUID(user_id)
    except (TypeError, ValueError):
        return None

    # Fetch user from database
    stmt = select(User).where(User.id == user_uuid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    return user


async def get_current_user_required(
    user: Annotated[User | None, Depends(get_current_user)],
) -> User:
    """
    Get the current authenticated user, raising 401 if not authenticated.

    Use this dependency when authentication is required.
    """
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# Type aliases for cleaner route signatures
DBSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User | None, Depends(get_current_user)]
CurrentUserRequired = Annotated[User, Depends(get_current_user_required)]
