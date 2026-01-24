"""Tests for production run API endpoints."""

import uuid
from datetime import UTC, datetime
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.main import app
from app.models.flow import FlowDefinition, FlowVersion, FlowVersionStatus
from app.models.production import ProductionRun, RunStatus
from app.models.user import AuthUser, User, UserRole
from app.services.auth import create_access_token


def create_test_token(user_id: str, role: UserRole) -> str:
    """Create a JWT token for testing with role claim."""
    return create_access_token(data={"sub": user_id, "role": role.value})


# --- User Fixtures ---


@pytest_asyncio.fixture
async def test_operator_user(db_session: AsyncSession) -> User:
    """Create an OPERATOR test user."""
    user_id = UUID("00000000-0000-0000-0000-000000000010")
    auth_user = AuthUser(id=user_id, email="run-operator@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="run-operator@flowviz.test",
        full_name="Run Operator",
        role=UserRole.OPERATOR,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def test_manager_user(db_session: AsyncSession) -> User:
    """Create a MANAGER test user."""
    user_id = UUID("00000000-0000-0000-0000-000000000011")
    auth_user = AuthUser(id=user_id, email="run-manager@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="run-manager@flowviz.test",
        full_name="Run Manager",
        role=UserRole.MANAGER,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def test_viewer_user(db_session: AsyncSession) -> User:
    """Create a VIEWER test user (limited permissions)."""
    user_id = UUID("00000000-0000-0000-0000-000000000012")
    auth_user = AuthUser(id=user_id, email="run-viewer@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="run-viewer@flowviz.test",
        full_name="Run Viewer",
        role=UserRole.VIEWER,
    )
    db_session.add(user)
    await db_session.commit()
    return user


# --- Auth Headers Fixtures ---


@pytest_asyncio.fixture
async def auth_headers(test_operator_user: User) -> dict:
    """Auth headers for operator user."""
    token = create_test_token(str(test_operator_user.id), test_operator_user.role)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def manager_auth_headers(test_manager_user: User) -> dict:
    """Auth headers for manager user."""
    token = create_test_token(str(test_manager_user.id), test_manager_user.role)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def viewer_auth_headers(test_viewer_user: User) -> dict:
    """Auth headers for viewer user."""
    token = create_test_token(str(test_viewer_user.id), test_viewer_user.role)
    return {"Authorization": f"Bearer {token}"}


# --- Client Fixture ---


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """Create test HTTP client with database override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# --- Flow Version Fixtures ---


@pytest_asyncio.fixture
async def published_flow_version(
    db_session: AsyncSession, test_operator_user: User
) -> FlowVersion:
    """Create a published flow version for testing."""
    # Create flow definition
    flow_def = FlowDefinition(
        name={"en": "Test Flow", "hu": "Teszt Folyamat"},
        description="Test flow for runs",
        created_by=test_operator_user.id,
    )
    db_session.add(flow_def)
    await db_session.flush()

    # Create published version
    version = FlowVersion(
        flow_definition_id=flow_def.id,
        version_num=1,
        status=FlowVersionStatus.PUBLISHED.value,
        graph_schema={
            "nodes": [
                {
                    "id": "start",
                    "type": "start",
                    "position": {"x": 0, "y": 0},
                    "data": {"label": {"en": "Start"}, "nodeType": "start", "config": {}},
                },
                {
                    "id": "end",
                    "type": "end",
                    "position": {"x": 100, "y": 0},
                    "data": {"label": {"en": "End"}, "nodeType": "end", "config": {}},
                },
            ],
            "edges": [{"id": "e1", "source": "start", "target": "end"}],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        },
        published_at=datetime.now(UTC),
        published_by=test_operator_user.id,
        created_by=test_operator_user.id,
    )
    db_session.add(version)
    await db_session.commit()

    return version


@pytest_asyncio.fixture
async def draft_flow_version(
    db_session: AsyncSession, test_operator_user: User
) -> FlowVersion:
    """Create a draft flow version for testing."""
    flow_def = FlowDefinition(
        name={"en": "Draft Flow"},
        created_by=test_operator_user.id,
    )
    db_session.add(flow_def)
    await db_session.flush()

    version = FlowVersion(
        flow_definition_id=flow_def.id,
        version_num=1,
        status=FlowVersionStatus.DRAFT.value,
        graph_schema={"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}},
        created_by=test_operator_user.id,
    )
    db_session.add(version)
    await db_session.commit()

    return version


# --- Tests ---


@pytest.mark.asyncio
async def test_create_run_requires_published_version(
    client: AsyncClient,
    auth_headers: dict,
    draft_flow_version: FlowVersion,
):
    """Test that runs can only be created from PUBLISHED versions."""
    response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(draft_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert response.status_code == 400
    assert "PUBLISHED" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_run_success(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test successful run creation."""
    idempotency_key = str(uuid.uuid4())

    response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": idempotency_key},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "IDLE"
    assert data["current_step_index"] == 0
    assert data["flow_version_id"] == str(published_flow_version.id)
    assert data["run_code"].startswith("RUN-")


@pytest.mark.asyncio
async def test_create_run_idempotency(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test that duplicate requests with same idempotency key return same result."""
    idempotency_key = str(uuid.uuid4())
    headers = {**auth_headers, "Idempotency-Key": idempotency_key}

    # First request
    response1 = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers=headers,
    )

    # Second request with same key
    response2 = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers=headers,
    )

    assert response1.status_code == 201
    assert response2.status_code == 201
    assert response1.json()["id"] == response2.json()["id"]


@pytest.mark.asyncio
async def test_run_lifecycle_idle_to_running(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test starting a run (IDLE → RUNNING)."""
    # Create run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    # Start run
    start_response = await client.post(
        f"/api/runs/{run_id}/start",
        headers=auth_headers,
    )

    assert start_response.status_code == 200
    data = start_response.json()
    assert data["status"] == "RUNNING"
    assert data["started_at"] is not None


@pytest.mark.asyncio
async def test_run_lifecycle_advance_step(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test advancing steps."""
    # Create and start run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)

    # Advance step
    advance_response = await client.post(
        f"/api/runs/{run_id}/advance",
        headers=auth_headers,
    )

    assert advance_response.status_code == 200
    data = advance_response.json()
    assert data["current_step_index"] == 1


@pytest.mark.asyncio
async def test_run_lifecycle_hold_and_resume(
    client: AsyncClient,
    auth_headers: dict,
    manager_auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test hold and resume flow."""
    # Create and start run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)

    # Hold run (operator can hold)
    hold_response = await client.post(
        f"/api/runs/{run_id}/hold",
        json={"reason": "Quality issue detected"},
        headers=auth_headers,
    )

    assert hold_response.status_code == 200
    assert hold_response.json()["status"] == "HOLD"

    # Resume run (requires manager)
    resume_response = await client.post(
        f"/api/runs/{run_id}/resume",
        json={"resolution": "Issue resolved and verified"},
        headers=manager_auth_headers,
    )

    assert resume_response.status_code == 200
    assert resume_response.json()["status"] == "RUNNING"


@pytest.mark.asyncio
async def test_resume_run_requires_manager(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test that resume requires MANAGER or higher role."""
    # Create, start, and hold run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)
    await client.post(
        f"/api/runs/{run_id}/hold",
        json={"reason": "Quality issue detected"},
        headers=auth_headers,
    )

    # Try to resume with operator (should fail)
    resume_response = await client.post(
        f"/api/runs/{run_id}/resume",
        json={"resolution": "Issue resolved and verified"},
        headers=auth_headers,  # Operator token
    )

    assert resume_response.status_code == 403


@pytest.mark.asyncio
async def test_complete_run_requires_step_10(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test that completion requires step 10."""
    # Create and start run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)

    # Try to complete at step 0
    complete_response = await client.post(
        f"/api/runs/{run_id}/complete",
        headers=auth_headers,
    )

    assert complete_response.status_code == 400
    assert "step 10" in complete_response.json()["detail"]


@pytest.mark.asyncio
async def test_abort_run_requires_manager(
    client: AsyncClient,
    auth_headers: dict,
    manager_auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test that abort requires MANAGER or higher role."""
    # Create and start run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)

    # Try to abort with operator (should fail)
    abort_response = await client.post(
        f"/api/runs/{run_id}/abort",
        json={"reason": "Abort due to equipment failure"},
        headers=auth_headers,
    )

    assert abort_response.status_code == 403

    # Abort with manager (should succeed)
    abort_response = await client.post(
        f"/api/runs/{run_id}/abort",
        json={"reason": "Abort due to equipment failure"},
        headers=manager_auth_headers,
    )

    assert abort_response.status_code == 200
    assert abort_response.json()["status"] == "ABORTED"


@pytest.mark.asyncio
async def test_list_runs(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test listing production runs."""
    # Create a run
    await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # List runs
    list_response = await client.get("/api/runs", headers=auth_headers)

    assert list_response.status_code == 200
    data = list_response.json()
    assert len(data) >= 1
    assert data[0]["run_code"].startswith("RUN-")


@pytest.mark.asyncio
async def test_get_run_steps(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test getting step execution history."""
    # Create and start run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)

    # Get steps
    steps_response = await client.get(f"/api/runs/{run_id}/steps", headers=auth_headers)

    assert steps_response.status_code == 200
    data = steps_response.json()
    assert len(data) == 1
    assert data[0]["step_index"] == 0
    assert data[0]["status"] == "IN_PROGRESS"


@pytest.mark.asyncio
async def test_cannot_start_already_running(
    client: AsyncClient,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test that you cannot start an already running run."""
    # Create and start run
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    run_id = create_response.json()["id"]

    await client.post(f"/api/runs/{run_id}/start", headers=auth_headers)

    # Try to start again
    start_response = await client.post(
        f"/api/runs/{run_id}/start",
        headers=auth_headers,
    )

    assert start_response.status_code == 400
    assert "IDLE" in start_response.json()["detail"]


@pytest.mark.asyncio
async def test_viewer_can_list_but_not_create(
    client: AsyncClient,
    viewer_auth_headers: dict,
    auth_headers: dict,
    published_flow_version: FlowVersion,
):
    """Test VIEWER can list runs but cannot create them."""
    # First create a run with operator
    await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # Viewer can list
    list_response = await client.get("/api/runs", headers=viewer_auth_headers)
    assert list_response.status_code == 200

    # Viewer cannot create
    create_response = await client.post(
        "/api/runs",
        json={"flow_version_id": str(published_flow_version.id)},
        headers={**viewer_auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    assert create_response.status_code == 403
