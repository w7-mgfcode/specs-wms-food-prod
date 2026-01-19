"""Pytest fixtures and configuration."""

import asyncio
import os
from collections.abc import AsyncGenerator, Generator
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("SQLITE_TESTS", "1")

from app.api.deps import get_db  # Import from single source of truth
from app.database import Base
from app.main import app
from app.models.user import AuthUser, User, UserRole
from app.services.auth import create_access_token

# Use SQLite for testing (faster, no external deps)
# NOTE: For schema validation with PostgreSQL-specific types (JSONB, enums, UUID),
# consider using a PostgreSQL test database or testcontainers-python.
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop]:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        execution_options={"schema_translate_map": {"auth": None}},
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession]:
    """Create test database session."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    """
    Create test HTTP client with database override.

    This is an UNAUTHENTICATED client. Use `authenticated_client` for
    endpoints that require authentication.
    """

    async def override_get_db() -> AsyncGenerator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# --- Authenticated Test Fixtures ---

# Test user ID for authenticated fixtures
TEST_OPERATOR_USER_ID = UUID("00000000-0000-0000-0000-000000000099")


@pytest_asyncio.fixture(scope="function")
async def test_operator_user(db_session: AsyncSession) -> User:
    """Create an OPERATOR test user for characterization tests."""
    auth_user = AuthUser(id=TEST_OPERATOR_USER_ID, email="test-operator@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=TEST_OPERATOR_USER_ID,
        email="test-operator@flowviz.test",
        full_name="Test Operator",
        role=UserRole.OPERATOR,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture(scope="function")
async def authenticated_client(
    db_session: AsyncSession, test_operator_user: User
) -> AsyncGenerator[AsyncClient]:
    """
    Create test HTTP client with OPERATOR authentication.

    This client has a valid JWT token for an OPERATOR user, which can:
    - List lots (GET /lots)
    - Create lots (POST /lots)
    - Make QC decisions (POST /qc-decisions)
    - Access traceability (GET /traceability/*)

    Use this fixture for characterization tests that need authentication.
    """

    async def override_get_db() -> AsyncGenerator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    # Create JWT token for the test user
    token = create_access_token(
        data={"sub": str(test_operator_user.id), "role": test_operator_user.role.value}
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
