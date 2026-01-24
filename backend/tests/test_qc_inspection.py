"""Tests for QC inspection, temperature log, and audit API endpoints.

Phase 8.4: QC & Genealogy Unification tests.
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
from app.models.lot import Lot, LotGenealogy, LotType
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
    user_id = UUID("00000000-0000-0000-0000-000000000030")
    auth_user = AuthUser(id=user_id, email="qc-operator@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="qc-operator@flowviz.test",
        full_name="QC Operator",
        role=UserRole.OPERATOR,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def test_viewer_user(db_session: AsyncSession) -> User:
    """Create a VIEWER test user."""
    user_id = UUID("00000000-0000-0000-0000-000000000031")
    auth_user = AuthUser(id=user_id, email="qc-viewer@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="qc-viewer@flowviz.test",
        full_name="QC Viewer",
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
async def test_production_run(
    db_session: AsyncSession, test_operator_user: User
) -> ProductionRun:
    """Create a test production run."""
    flow_def = FlowDefinition(
        name={"en": "QC Test Flow"},
        description="Test flow for QC",
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

    run = ProductionRun(
        run_code="RUN-QC-TEST-001",
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
        lot_code="LOT-QC-TEST-001",
        lot_type=LotType.DEB,
        weight_kg=Decimal("100.00"),
        temperature_c=Decimal("3.0"),
        operator_id=test_operator_user.id,
    )
    db_session.add(lot)
    await db_session.commit()
    return lot


@pytest_asyncio.fixture
async def test_lot_with_genealogy(
    db_session: AsyncSession, test_operator_user: User
) -> tuple[Lot, Lot, Lot]:
    """Create lots with genealogy relationships: grandparent -> parent -> child."""
    grandparent = Lot(
        lot_code="LOT-GP-001",
        lot_type=LotType.RAW,
        weight_kg=Decimal("500.00"),
        operator_id=test_operator_user.id,
    )
    parent = Lot(
        lot_code="LOT-P-001",
        lot_type=LotType.DEB,
        weight_kg=Decimal("400.00"),
        operator_id=test_operator_user.id,
    )
    child = Lot(
        lot_code="LOT-C-001",
        lot_type=LotType.MIX,
        weight_kg=Decimal("300.00"),
        operator_id=test_operator_user.id,
    )
    db_session.add_all([grandparent, parent, child])
    await db_session.flush()

    # Create genealogy links
    link1 = LotGenealogy(
        parent_lot_id=grandparent.id,
        child_lot_id=parent.id,
        quantity_used_kg=Decimal("400.00"),
    )
    link2 = LotGenealogy(
        parent_lot_id=parent.id,
        child_lot_id=child.id,
        quantity_used_kg=Decimal("300.00"),
    )
    db_session.add_all([link1, link2])
    await db_session.commit()

    return grandparent, parent, child


# --- QC Inspection Tests ---


@pytest.mark.asyncio
async def test_create_qc_inspection_pass(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test creating a PASS QC inspection."""
    idempotency_key = str(uuid.uuid4())
    response = await client.post(
        "/api/qc-inspections",
        json={
            "lot_id": str(test_lot.id),
            "run_id": str(test_production_run.id),
            "step_index": 2,
            "inspection_type": "VISUAL",
            "is_ccp": False,
            "decision": "PASS",
        },
        headers={**auth_headers, "Idempotency-Key": idempotency_key},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["decision"] == "PASS"
    assert data["step_index"] == 2
    assert data["is_ccp"] is False


@pytest.mark.asyncio
async def test_create_qc_inspection_hold_requires_notes(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test that HOLD decisions require notes."""
    response = await client.post(
        "/api/qc-inspections",
        json={
            "lot_id": str(test_lot.id),
            "run_id": str(test_production_run.id),
            "step_index": 2,
            "inspection_type": "TEMPERATURE",
            "decision": "HOLD",
            # No notes - should fail
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_qc_inspection_hold_with_notes(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test creating a HOLD QC inspection with notes."""
    response = await client.post(
        "/api/qc-inspections",
        json={
            "lot_id": str(test_lot.id),
            "run_id": str(test_production_run.id),
            "step_index": 3,
            "inspection_type": "TEMPERATURE",
            "is_ccp": True,
            "decision": "HOLD",
            "notes": "Temperature exceeded threshold, awaiting supervisor review",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["decision"] == "HOLD"
    assert data["is_ccp"] is True
    assert "Temperature" in data["notes"]


@pytest.mark.asyncio
async def test_create_qc_inspection_idempotency(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test that duplicate inspections with same idempotency key return 409."""
    idempotency_key = str(uuid.uuid4())
    payload = {
        "lot_id": str(test_lot.id),
        "run_id": str(test_production_run.id),
        "step_index": 2,
        "inspection_type": "VISUAL",
        "decision": "PASS",
    }
    headers = {**auth_headers, "Idempotency-Key": idempotency_key}

    response1 = await client.post("/api/qc-inspections", json=payload, headers=headers)
    response2 = await client.post("/api/qc-inspections", json=payload, headers=headers)

    assert response1.status_code == 201
    assert response2.status_code == 409


@pytest.mark.asyncio
async def test_list_qc_inspections(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test listing QC inspections."""
    # Create an inspection first
    await client.post(
        "/api/qc-inspections",
        json={
            "lot_id": str(test_lot.id),
            "run_id": str(test_production_run.id),
            "step_index": 2,
            "inspection_type": "VISUAL",
            "decision": "PASS",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # List inspections
    response = await client.get("/api/qc-inspections", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_qc_inspections_filter_by_run(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test filtering QC inspections by run."""
    await client.post(
        "/api/qc-inspections",
        json={
            "lot_id": str(test_lot.id),
            "run_id": str(test_production_run.id),
            "step_index": 2,
            "inspection_type": "VISUAL",
            "decision": "PASS",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    response = await client.get(
        f"/api/qc-inspections?run_id={test_production_run.id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    for insp in data:
        assert insp["lot_id"] == str(test_lot.id)


@pytest.mark.asyncio
async def test_viewer_can_read_inspections(
    client: AsyncClient,
    auth_headers: dict,
    viewer_auth_headers: dict,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test that VIEWER can read QC inspections."""
    # Create inspection as operator
    await client.post(
        "/api/qc-inspections",
        json={
            "lot_id": str(test_lot.id),
            "run_id": str(test_production_run.id),
            "step_index": 2,
            "inspection_type": "VISUAL",
            "decision": "PASS",
        },
        headers={**auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    # Read as viewer
    response = await client.get("/api/qc-inspections", headers=viewer_auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_viewer_cannot_create_inspection(
    client: AsyncClient,
    viewer_auth_headers: dict,
    test_lot: Lot,
    test_production_run: ProductionRun,
):
    """Test that VIEWER cannot create QC inspections."""
    response = await client.post(
        "/api/qc-inspections",
        json={
            "lot_id": str(test_lot.id),
            "run_id": str(test_production_run.id),
            "step_index": 2,
            "inspection_type": "VISUAL",
            "decision": "PASS",
        },
        headers={**viewer_auth_headers, "Idempotency-Key": str(uuid.uuid4())},
    )

    assert response.status_code == 403


# --- Temperature Log Tests ---


@pytest.mark.asyncio
async def test_create_temperature_log_no_violation(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
):
    """Test creating a temperature log that does not violate threshold."""
    response = await client.post(
        "/api/temperature-logs",
        json={
            "lot_id": str(test_lot.id),
            "temperature_c": "3.5",  # Under 4°C threshold for SURFACE
            "measurement_type": "SURFACE",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["is_violation"] is False
    assert data["measurement_type"] == "SURFACE"


@pytest.mark.asyncio
async def test_create_temperature_log_with_violation(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
):
    """Test creating a temperature log that violates threshold."""
    response = await client.post(
        "/api/temperature-logs",
        json={
            "lot_id": str(test_lot.id),
            "temperature_c": "5.5",  # Over 4°C threshold for SURFACE
            "measurement_type": "SURFACE",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["is_violation"] is True


@pytest.mark.asyncio
async def test_list_temperature_logs(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
):
    """Test listing temperature logs."""
    # Create a log
    await client.post(
        "/api/temperature-logs",
        json={
            "lot_id": str(test_lot.id),
            "temperature_c": "3.5",
            "measurement_type": "SURFACE",
        },
        headers=auth_headers,
    )

    # List logs
    response = await client.get("/api/temperature-logs", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_temperature_logs_violations_only(
    client: AsyncClient,
    auth_headers: dict,
    test_lot: Lot,
):
    """Test filtering temperature logs to violations only."""
    # Create non-violation
    await client.post(
        "/api/temperature-logs",
        json={
            "lot_id": str(test_lot.id),
            "temperature_c": "3.5",
            "measurement_type": "SURFACE",
        },
        headers=auth_headers,
    )

    # Create violation
    await client.post(
        "/api/temperature-logs",
        json={
            "lot_id": str(test_lot.id),
            "temperature_c": "5.5",
            "measurement_type": "SURFACE",
        },
        headers=auth_headers,
    )

    # List violations only
    response = await client.get(
        "/api/temperature-logs?violations_only=true",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    for log in data:
        assert log["is_violation"] is True


# --- Genealogy Tests ---


@pytest.mark.asyncio
async def test_get_parent_lots(
    client: AsyncClient,
    auth_headers: dict,
    test_lot_with_genealogy: tuple[Lot, Lot, Lot],
):
    """Test getting parent lots (1-back)."""
    grandparent, parent, child = test_lot_with_genealogy

    response = await client.get(
        f"/api/genealogy/{child.id}/parents",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["direction"] == "backward"
    assert len(data["nodes"]) == 1
    assert data["nodes"][0]["lot_code"] == parent.lot_code


@pytest.mark.asyncio
async def test_get_parent_lots_depth_2(
    client: AsyncClient,
    auth_headers: dict,
    test_lot_with_genealogy: tuple[Lot, Lot, Lot],
):
    """Test getting parent lots with depth 2 (grandparent)."""
    grandparent, parent, child = test_lot_with_genealogy

    response = await client.get(
        f"/api/genealogy/{child.id}/parents?depth=2",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["nodes"]) == 2
    lot_codes = [n["lot_code"] for n in data["nodes"]]
    assert parent.lot_code in lot_codes
    assert grandparent.lot_code in lot_codes


@pytest.mark.asyncio
async def test_get_child_lots(
    client: AsyncClient,
    auth_headers: dict,
    test_lot_with_genealogy: tuple[Lot, Lot, Lot],
):
    """Test getting child lots (1-forward)."""
    grandparent, parent, child = test_lot_with_genealogy

    response = await client.get(
        f"/api/genealogy/{grandparent.id}/children",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["direction"] == "forward"
    assert len(data["nodes"]) == 1
    assert data["nodes"][0]["lot_code"] == parent.lot_code


@pytest.mark.asyncio
async def test_get_full_tree(
    client: AsyncClient,
    auth_headers: dict,
    test_lot_with_genealogy: tuple[Lot, Lot, Lot],
):
    """Test getting full genealogy tree."""
    grandparent, parent, child = test_lot_with_genealogy

    response = await client.get(
        f"/api/genealogy/{parent.id}/tree",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["direction"] == "both"
    # Should include both grandparent and child
    lot_codes = [n["lot_code"] for n in data["nodes"]]
    assert grandparent.lot_code in lot_codes
    assert child.lot_code in lot_codes


@pytest.mark.asyncio
async def test_genealogy_not_found(
    client: AsyncClient,
    auth_headers: dict,
):
    """Test genealogy for non-existent lot returns 404."""
    fake_id = str(uuid.uuid4())
    response = await client.get(
        f"/api/genealogy/{fake_id}/parents",
        headers=auth_headers,
    )

    assert response.status_code == 404


# --- Audit Tests ---


@pytest.mark.asyncio
async def test_list_audit_events(
    client: AsyncClient,
    auth_headers: dict,
):
    """Test listing audit events."""
    response = await client.get("/api/audit/events", headers=auth_headers)

    assert response.status_code == 200
    # May be empty if no events yet, that's OK
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_viewer_can_read_audit_events(
    client: AsyncClient,
    viewer_auth_headers: dict,
):
    """Test that VIEWER can read audit events."""
    response = await client.get("/api/audit/events", headers=viewer_auth_headers)

    assert response.status_code == 200
