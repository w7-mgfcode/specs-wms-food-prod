"""Tests for inventory and buffer API endpoints.

Phase 8.3: Buffer management and inventory tracking tests.
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.main import app
from app.models.flow import FlowDefinition, FlowVersion, FlowVersionStatus
from app.models.inventory import Buffer
from app.models.lot import Lot, LotType
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
    user_id = UUID("00000000-0000-0000-0000-000000000020")
    auth_user = AuthUser(id=user_id, email="inv-operator@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="inv-operator@flowviz.test",
        full_name="Inventory Operator",
        role=UserRole.OPERATOR,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def test_viewer_user(db_session: AsyncSession) -> User:
    """Create a VIEWER test user."""
    user_id = UUID("00000000-0000-0000-0000-000000000021")
    auth_user = AuthUser(id=user_id, email="inv-viewer@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="inv-viewer@flowviz.test",
        full_name="Inventory Viewer",
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


# --- Test Data Fixtures ---


@pytest_asyncio.fixture
async def test_buffer(db_session: AsyncSession) -> Buffer:
    """Create a test buffer."""
    buffer = Buffer(
        buffer_code="TEST-BUF-001",
        buffer_type="LK",
        allowed_lot_types=["DEB", "BULK"],
        capacity_kg=Decimal("1000.00"),
        temp_min_c=Decimal("1.0"),
        temp_max_c=Decimal("4.0"),
        is_active=True,
    )
    db_session.add(buffer)
    await db_session.commit()
    return buffer


@pytest_asyncio.fixture
async def test_buffer_skw15(db_session: AsyncSession) -> Buffer:
    """Create a SKW15 buffer for purity testing."""
    buffer = Buffer(
        buffer_code="TEST-SKW15-001",
        buffer_type="SKW15",
        allowed_lot_types=["SKW15"],
        capacity_kg=Decimal("300.00"),
        temp_min_c=Decimal("2.0"),
        temp_max_c=Decimal("4.0"),
        is_active=True,
    )
    db_session.add(buffer)
    await db_session.commit()
    return buffer


@pytest_asyncio.fixture
async def test_production_run(
    db_session: AsyncSession, test_operator_user: User
) -> ProductionRun:
    """Create a test production run."""
    # Create flow definition and version
    flow_def = FlowDefinition(
        name={"en": "Test Flow"},
        description="Test flow",
        created_by=test_operator_user.id,
    )
    db_session.add(flow_def)
    await db_session.flush()

    flow_version = FlowVersion(
        flow_definition_id=flow_def.id,
        version_num=1,
        status=FlowVersionStatus.PUBLISHED.value,
        graph_schema={"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}},
        published_at=datetime.now(UTC),
        published_by=test_operator_user.id,
        created_by=test_operator_user.id,
    )
    db_session.add(flow_version)
    await db_session.flush()

    # Create production run
    run = ProductionRun(
        run_code="RUN-TEST-001",
        flow_version_id=flow_version.id,
        status=RunStatus.RUNNING.value,
        current_step_index=1,
        started_by=test_operator_user.id,
        started_at=datetime.now(UTC),
    )
    db_session.add(run)
    await db_session.commit()
    return run


@pytest_asyncio.fixture
async def test_lot(db_session: AsyncSession, test_operator_user: User) -> Lot:
    """Create a test lot."""
    lot = Lot(
        lot_code="LOT-TEST-001",
        lot_type=LotType.DEB,
        weight_kg=Decimal("100.00"),
        temperature_c=Decimal("3.0"),
        operator_id=test_operator_user.id,
    )
    db_session.add(lot)
    await db_session.commit()
    return lot


@pytest_asyncio.fixture
async def test_lot_skw30(db_session: AsyncSession, test_operator_user: User) -> Lot:
    """Create a SKW30 lot for purity testing."""
    lot = Lot(
        lot_code="LOT-SKW30-001",
        lot_type=LotType.SKW30,
        weight_kg=Decimal("25.00"),
        temperature_c=Decimal("3.0"),
        operator_id=test_operator_user.id,
    )
    db_session.add(lot)
    await db_session.commit()
    return lot


# --- Buffer Tests ---


@pytest.mark.asyncio
async def test_list_buffers(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
):
    """Test listing buffers."""
    response = await client.get("/api/buffers", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    buffer_codes = [b["buffer_code"] for b in data]
    assert test_buffer.buffer_code in buffer_codes


@pytest.mark.asyncio
async def test_list_buffers_filter_by_type(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
):
    """Test filtering buffers by type."""
    response = await client.get(
        "/api/buffers",
        params={"buffer_type": "LK"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    for b in data:
        assert b["buffer_type"] == "LK"


@pytest.mark.asyncio
async def test_get_buffer(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
):
    """Test getting a specific buffer."""
    response = await client.get(
        f"/api/buffers/{test_buffer.id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["buffer_code"] == test_buffer.buffer_code
    assert data["buffer_type"] == "LK"
    assert data["allowed_lot_types"] == ["DEB", "BULK"]


@pytest.mark.asyncio
async def test_create_buffer(
    client: AsyncClient,
    auth_headers: dict,
):
    """Test creating a new buffer."""
    response = await client.post(
        "/api/buffers",
        json={
            "buffer_code": "NEW-BUF-001",
            "buffer_type": "FRZ",
            "allowed_lot_types": ["FRZ15", "FRZ30"],
            "capacity_kg": "500.00",
            "temp_min_c": "-25.0",
            "temp_max_c": "-18.0",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["buffer_code"] == "NEW-BUF-001"
    assert data["buffer_type"] == "FRZ"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_create_buffer_duplicate_code(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
):
    """Test that duplicate buffer codes are rejected."""
    response = await client.post(
        "/api/buffers",
        json={
            "buffer_code": test_buffer.buffer_code,
            "buffer_type": "LK",
            "allowed_lot_types": ["DEB"],
            "capacity_kg": "500.00",
            "temp_min_c": "1.0",
            "temp_max_c": "4.0",
        },
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_buffer_invalid_temp_range(
    client: AsyncClient,
    auth_headers: dict,
):
    """Test that invalid temperature ranges are rejected."""
    response = await client.post(
        "/api/buffers",
        json={
            "buffer_code": "BAD-TEMP-001",
            "buffer_type": "LK",
            "allowed_lot_types": ["DEB"],
            "capacity_kg": "500.00",
            "temp_min_c": "10.0",
            "temp_max_c": "5.0",  # min > max
        },
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert "temperature" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_buffer(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
):
    """Test updating buffer settings."""
    response = await client.patch(
        f"/api/buffers/{test_buffer.id}",
        json={"capacity_kg": "1500.00", "is_active": False},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["capacity_kg"] == "1500.00"
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_viewer_cannot_create_buffer(
    client: AsyncClient,
    viewer_auth_headers: dict,
):
    """Test that VIEWER cannot create buffers."""
    response = await client.post(
        "/api/buffers",
        json={
            "buffer_code": "VIEWER-BUF-001",
            "buffer_type": "LK",
            "allowed_lot_types": ["DEB"],
            "capacity_kg": "500.00",
            "temp_min_c": "1.0",
            "temp_max_c": "4.0",
        },
        headers=viewer_auth_headers,
    )

    assert response.status_code == 403


# --- Inventory Tests ---


@pytest.mark.asyncio
async def test_receive_to_buffer(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test receiving a lot into a buffer."""
    response = await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "50.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["move_type"] == "RECEIVE"
    assert data["to_buffer_id"] == str(test_buffer.id)
    assert data["quantity_kg"] == "50.00"


@pytest.mark.asyncio
async def test_receive_idempotency(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test that duplicate receives with same idempotency key return same result."""
    idempotency_key = str(uuid.uuid4())
    payload = {
        "lot_id": str(test_lot.id),
        "buffer_id": str(test_buffer.id),
        "run_id": str(test_production_run.id),
        "quantity_kg": "50.00",
    }
    headers = {**auth_headers, "Idempotency-Key": idempotency_key}

    response1 = await client.post("/api/inventory/receive", json=payload, headers=headers)
    response2 = await client.post("/api/inventory/receive", json=payload, headers=headers)

    assert response1.status_code == 201
    assert response2.status_code == 201
    assert response1.json()["id"] == response2.json()["id"]


@pytest.mark.asyncio
async def test_receive_wrong_lot_type_rejected(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer_skw15: Buffer,
    test_lot_skw30: Lot,
    test_production_run: ProductionRun,
):
    """Test that receiving wrong lot type into buffer is rejected."""
    response = await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot_skw30.id),
            "buffer_id": str(test_buffer_skw15.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "25.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert response.status_code == 400
    assert "not allowed" in response.json()["detail"]


@pytest.mark.asyncio
async def test_transfer_between_buffers(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test transferring a lot between buffers."""
    # First receive into source buffer
    receive_response = await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "50.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )
    assert receive_response.status_code == 201

    # Create second buffer
    target_buffer = Buffer(
        buffer_code="TEST-BUF-002",
        buffer_type="LK",
        allowed_lot_types=["DEB", "BULK"],
        capacity_kg=Decimal("1000.00"),
        temp_min_c=Decimal("1.0"),
        temp_max_c=Decimal("4.0"),
        is_active=True,
    )
    db_session.add(target_buffer)
    await db_session.commit()

    # Transfer
    transfer_response = await client.post(
        "/api/inventory/transfer",
        json={
            "lot_id": str(test_lot.id),
            "from_buffer_id": str(test_buffer.id),
            "to_buffer_id": str(target_buffer.id),
            "quantity_kg": "30.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert transfer_response.status_code == 201
    data = transfer_response.json()
    assert data["move_type"] == "TRANSFER"
    assert data["from_buffer_id"] == str(test_buffer.id)
    assert data["to_buffer_id"] == str(target_buffer.id)


@pytest.mark.asyncio
async def test_transfer_insufficient_quantity(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test that transfer with insufficient quantity is rejected."""
    # Receive 50kg
    await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "50.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # Create second buffer
    target_buffer = Buffer(
        buffer_code="TEST-BUF-003",
        buffer_type="LK",
        allowed_lot_types=["DEB", "BULK"],
        capacity_kg=Decimal("1000.00"),
        temp_min_c=Decimal("1.0"),
        temp_max_c=Decimal("4.0"),
        is_active=True,
    )
    db_session.add(target_buffer)
    await db_session.commit()

    # Try to transfer 100kg (more than available)
    transfer_response = await client.post(
        "/api/inventory/transfer",
        json={
            "lot_id": str(test_lot.id),
            "from_buffer_id": str(test_buffer.id),
            "to_buffer_id": str(target_buffer.id),
            "quantity_kg": "100.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert transfer_response.status_code == 400
    assert "Insufficient" in transfer_response.json()["detail"]


@pytest.mark.asyncio
async def test_consume_from_buffer(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test consuming a lot from a buffer."""
    # First receive
    await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "50.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # Consume
    consume_response = await client.post(
        "/api/inventory/consume",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "quantity_kg": "20.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert consume_response.status_code == 201
    data = consume_response.json()
    assert data["move_type"] == "CONSUME"
    assert data["from_buffer_id"] == str(test_buffer.id)
    assert data["to_buffer_id"] is None


@pytest.mark.asyncio
async def test_ship_from_buffer(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test shipping a lot from a buffer."""
    # First receive
    await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "50.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # Ship
    ship_response = await client.post(
        "/api/inventory/ship",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "quantity_kg": "50.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert ship_response.status_code == 201
    data = ship_response.json()
    assert data["move_type"] == "SHIP"


@pytest.mark.asyncio
async def test_list_inventory(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test listing inventory items."""
    # First receive
    await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "50.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # List
    response = await client.get("/api/inventory", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["lot_id"] == str(test_lot.id)


@pytest.mark.asyncio
async def test_list_stock_moves(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test listing stock moves."""
    # Perform a receive
    await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "50.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # List moves
    response = await client.get("/api/inventory/moves", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["move_type"] == "RECEIVE"


@pytest.mark.asyncio
async def test_get_run_buffers(
    client: AsyncClient,
    auth_headers: dict,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test getting buffer summaries for a run."""
    # First receive
    await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "50.00",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # Get run buffers
    response = await client.get(
        f"/api/runs/{test_production_run.id}/buffers",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    buffer_summary = next(
        (b for b in data if b["buffer_code"] == test_buffer.buffer_code), None
    )
    assert buffer_summary is not None
    assert buffer_summary["lot_count"] == 1
    assert buffer_summary["total_quantity_kg"] == "50.00"


@pytest.mark.asyncio
async def test_viewer_cannot_receive(
    client: AsyncClient,
    viewer_auth_headers: dict,
    test_buffer: Buffer,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test that VIEWER cannot perform receive operations."""
    response = await client.post(
        "/api/inventory/receive",
        json={
            "lot_id": str(test_lot.id),
            "buffer_id": str(test_buffer.id),
            "run_id": str(test_production_run.id),
            "quantity_kg": "50.00",
        },
        headers={**viewer_auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert response.status_code == 403
