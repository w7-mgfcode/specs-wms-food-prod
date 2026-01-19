"""Characterization tests for authentication endpoint with snapshot validation."""

from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user for authentication tests."""
    user = User(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        email="test@flowviz.com",
        full_name="Test User",
        role=UserRole.OPERATOR,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# --- Success Tests ---


@pytest.mark.asyncio
async def test_login_with_valid_email(client: AsyncClient, test_user: User):
    """Login with valid email should return user and token."""
    response = await client.post(
        "/api/login",
        json={"email": test_user.email},
    )

    assert response.status_code == 200
    data = response.json()

    # Response must have user and token
    assert "user" in data
    assert "token" in data

    # User should match
    assert data["user"]["email"] == test_user.email
    assert data["user"]["role"] == test_user.role.value

    # Token should be a non-empty string (JWT)
    assert isinstance(data["token"], str)
    assert len(data["token"]) > 0


@pytest.mark.asyncio
async def test_login_response_shape(client: AsyncClient, test_user: User):
    """
    Login response shape must match Node/Express.

    Expected: {"user": {...user fields...}, "token": "<JWT>"}
    """
    response = await client.post(
        "/api/login",
        json={"email": test_user.email},
    )

    data = response.json()

    # Must have exactly these top-level keys
    assert set(data.keys()) == {"user", "token"}

    # User must have expected fields
    user = data["user"]
    expected_user_fields = {"id", "email", "full_name", "role", "created_at", "last_login"}
    assert expected_user_fields.issubset(set(user.keys()))


@pytest.mark.asyncio
async def test_login_success_snapshot(client: AsyncClient, test_user: User, snapshot):
    """
    Snapshot test: Login success response.

    Golden snapshot captures user object shape with normalized dynamic fields.
    """
    response = await client.post(
        "/api/login",
        json={"email": test_user.email},
    )
    assert response.status_code == 200

    data = response.json()
    # Normalize dynamic fields
    data["user"]["created_at"] = "NORMALIZED"
    data["token"] = "NORMALIZED"

    assert data == snapshot


# --- Failure Tests ---


@pytest.mark.asyncio
async def test_login_with_invalid_email(client: AsyncClient):
    """Login with non-existent email should return 401."""
    response = await client.post(
        "/api/login",
        json={"email": "nonexistent@flowviz.com"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_failure_snapshot(client: AsyncClient, snapshot):
    """
    Snapshot test: Login failure response (invalid credentials).

    Golden snapshot captures error format.
    Note: Rate limiting may return 429 if limit exceeded during test run.
    """
    response = await client.post(
        "/api/login",
        json={"email": "nonexistent@flowviz.com"},
    )
    # Accept either 401 (auth failure) or 429 (rate limit)
    # Rate limiting is tested separately in test_rate_limiting.py
    assert response.status_code in (401, 429)

    if response.status_code == 401:
        assert response.json() == snapshot


@pytest.mark.asyncio
async def test_login_invalid_email_format_returns_422(client: AsyncClient):
    """Login with invalid email format should return 422 validation error."""
    response = await client.post(
        "/api/login",
        json={"email": "not-an-email"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_missing_email_returns_422(client: AsyncClient):
    """Login without email field should return 422 validation error."""
    response = await client.post(
        "/api/login",
        json={},
    )

    assert response.status_code == 422
