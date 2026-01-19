"""RBAC tests for role-based access control.

Tests verify that:
1. Endpoints require authentication (401 without token)
2. Endpoints enforce role restrictions (403 for unauthorized roles)
3. Authorized roles can access their permitted endpoints
"""

from uuid import UUID

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AuthUser, User, UserRole
from app.services.auth import create_access_token


def create_test_token(user_id: str, role: UserRole) -> str:
    """Create a JWT token for testing with role claim."""
    return create_access_token(data={"sub": user_id, "role": role.value})


# --- User Fixtures ---


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an ADMIN test user."""
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    auth_user = AuthUser(id=user_id, email="admin@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="admin@flowviz.test",
        full_name="Admin User",
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def manager_user(db_session: AsyncSession) -> User:
    """Create a MANAGER test user."""
    user_id = UUID("00000000-0000-0000-0000-000000000002")
    auth_user = AuthUser(id=user_id, email="manager@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="manager@flowviz.test",
        full_name="Manager User",
        role=UserRole.MANAGER,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def auditor_user(db_session: AsyncSession) -> User:
    """Create an AUDITOR test user."""
    user_id = UUID("00000000-0000-0000-0000-000000000003")
    auth_user = AuthUser(id=user_id, email="auditor@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="auditor@flowviz.test",
        full_name="Auditor User",
        role=UserRole.AUDITOR,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def operator_user(db_session: AsyncSession) -> User:
    """Create an OPERATOR test user."""
    user_id = UUID("00000000-0000-0000-0000-000000000004")
    auth_user = AuthUser(id=user_id, email="operator@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="operator@flowviz.test",
        full_name="Operator User",
        role=UserRole.OPERATOR,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def viewer_user(db_session: AsyncSession) -> User:
    """Create a VIEWER test user."""
    user_id = UUID("00000000-0000-0000-0000-000000000005")
    auth_user = AuthUser(id=user_id, email="viewer@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email="viewer@flowviz.test",
        full_name="Viewer User",
        role=UserRole.VIEWER,
    )
    db_session.add(user)
    await db_session.commit()
    return user


# --- Authentication Tests (401) ---


@pytest.mark.asyncio
async def test_missing_auth_returns_401_on_lots(client: AsyncClient):
    """Missing Authorization header should return 401 on /lots."""
    response = await client.get("/api/lots")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_missing_auth_returns_401_on_create_lot(client: AsyncClient):
    """Missing Authorization header should return 401 on POST /lots."""
    response = await client.post("/api/lots", json={"lot_code": "TEST-001", "lot_type": "RAW"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_missing_auth_returns_401_on_qc_decisions(client: AsyncClient):
    """Missing Authorization header should return 401 on POST /qc-decisions."""
    response = await client.post(
        "/api/qc-decisions",
        json={"lot_id": "00000000-0000-0000-0000-000000000001", "decision": "PASS"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_missing_auth_returns_401_on_traceability(client: AsyncClient):
    """Missing Authorization header should return 401 on /traceability."""
    response = await client.get("/api/traceability/TEST-LOT-001")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_token_returns_401(client: AsyncClient):
    """Invalid JWT token should return 401."""
    response = await client.get(
        "/api/lots",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_returns_401(client: AsyncClient):
    """Malformed Bearer token should return 401."""
    response = await client.get(
        "/api/lots",
        headers={"Authorization": "Bearer "},
    )
    assert response.status_code == 401


# --- Health Endpoint (No Auth Required) ---


@pytest.mark.asyncio
async def test_health_endpoint_no_auth_required(client: AsyncClient):
    """Health endpoint should not require authentication."""
    response = await client.get("/api/health")
    assert response.status_code == 200


# --- VIEWER Role Tests (Most Restricted) ---


@pytest.mark.asyncio
async def test_viewer_cannot_create_lots(client: AsyncClient, viewer_user: User):
    """VIEWER role should get 403 when attempting to create lots."""
    token = create_test_token(str(viewer_user.id), UserRole.VIEWER)

    response = await client.post(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
        json={"lot_code": "TEST-001", "lot_type": "RAW"},
    )

    assert response.status_code == 403
    assert "Requires one of" in response.json()["detail"]
    assert "X-Required-Roles" in response.headers


@pytest.mark.asyncio
async def test_viewer_cannot_make_qc_decisions(client: AsyncClient, viewer_user: User):
    """VIEWER role should get 403 when attempting to create QC decisions."""
    token = create_test_token(str(viewer_user.id), UserRole.VIEWER)

    response = await client.post(
        "/api/qc-decisions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "lot_id": "00000000-0000-0000-0000-000000000001",
            "decision": "PASS",
        },
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_viewer_can_list_lots(client: AsyncClient, viewer_user: User):
    """VIEWER role should be able to list lots (read access)."""
    token = create_test_token(str(viewer_user.id), UserRole.VIEWER)

    response = await client.get(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
    )

    # 200 OK - empty list is fine, no 403
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_viewer_can_access_traceability(client: AsyncClient, viewer_user: User):
    """VIEWER role should access traceability (compliance requirement)."""
    token = create_test_token(str(viewer_user.id), UserRole.VIEWER)

    response = await client.get(
        "/api/traceability/TEST-LOT-001",
        headers={"Authorization": f"Bearer {token}"},
    )

    # 404 (lot not found) is acceptable, but NOT 403 (forbidden)
    assert response.status_code in (200, 404)


# --- AUDITOR Role Tests ---


@pytest.mark.asyncio
async def test_auditor_cannot_create_lots(client: AsyncClient, auditor_user: User):
    """AUDITOR role should get 403 when attempting to create lots."""
    token = create_test_token(str(auditor_user.id), UserRole.AUDITOR)

    response = await client.post(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
        json={"lot_code": "TEST-001", "lot_type": "RAW"},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_auditor_can_make_qc_decisions(client: AsyncClient, auditor_user: User):
    """AUDITOR role should be able to make QC decisions."""
    token = create_test_token(str(auditor_user.id), UserRole.AUDITOR)

    response = await client.post(
        "/api/qc-decisions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "lot_id": "00000000-0000-0000-0000-000000000001",
            "decision": "PASS",
        },
    )

    # 201 or 422 (validation) - but NOT 403 (forbidden)
    assert response.status_code in (201, 422)


# --- OPERATOR Role Tests ---


@pytest.mark.asyncio
async def test_operator_can_create_lots(client: AsyncClient, operator_user: User):
    """OPERATOR role should be able to create lots."""
    token = create_test_token(str(operator_user.id), UserRole.OPERATOR)

    response = await client.post(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
        json={"lot_code": "TEST-001", "lot_type": "RAW"},
    )

    # 201 or 422 (validation) - but NOT 403 (forbidden)
    assert response.status_code in (201, 422)


@pytest.mark.asyncio
async def test_operator_can_make_qc_decisions(client: AsyncClient, operator_user: User):
    """OPERATOR role should be able to make QC decisions."""
    token = create_test_token(str(operator_user.id), UserRole.OPERATOR)

    response = await client.post(
        "/api/qc-decisions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "lot_id": "00000000-0000-0000-0000-000000000001",
            "decision": "PASS",
        },
    )

    # 201 or 422 (validation) - but NOT 403 (forbidden)
    assert response.status_code in (201, 422)


# --- MANAGER Role Tests ---


@pytest.mark.asyncio
async def test_manager_can_create_lots(client: AsyncClient, manager_user: User):
    """MANAGER role should be able to create lots."""
    token = create_test_token(str(manager_user.id), UserRole.MANAGER)

    response = await client.post(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
        json={"lot_code": "TEST-002", "lot_type": "RAW"},
    )

    # 201 or 422 (validation) - but NOT 403 (forbidden)
    assert response.status_code in (201, 422)


@pytest.mark.asyncio
async def test_manager_can_make_qc_decisions(client: AsyncClient, manager_user: User):
    """MANAGER role should be able to make QC decisions."""
    token = create_test_token(str(manager_user.id), UserRole.MANAGER)

    response = await client.post(
        "/api/qc-decisions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "lot_id": "00000000-0000-0000-0000-000000000001",
            "decision": "PASS",
        },
    )

    # 201 or 422 (validation) - but NOT 403 (forbidden)
    assert response.status_code in (201, 422)


# --- ADMIN Role Tests ---


@pytest.mark.asyncio
async def test_admin_can_create_lots(client: AsyncClient, admin_user: User):
    """ADMIN role should be able to create lots."""
    token = create_test_token(str(admin_user.id), UserRole.ADMIN)

    response = await client.post(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
        json={"lot_code": "TEST-003", "lot_type": "RAW"},
    )

    # 201 or 422 (validation) - but NOT 403 (forbidden)
    assert response.status_code in (201, 422)


@pytest.mark.asyncio
async def test_admin_can_make_qc_decisions(client: AsyncClient, admin_user: User):
    """ADMIN role should be able to make QC decisions."""
    token = create_test_token(str(admin_user.id), UserRole.ADMIN)

    response = await client.post(
        "/api/qc-decisions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "lot_id": "00000000-0000-0000-0000-000000000001",
            "decision": "PASS",
        },
    )

    # 201 or 422 (validation) - but NOT 403 (forbidden)
    assert response.status_code in (201, 422)


# --- Parametrized Tests for All Roles ---


ROLE_UUID_SUFFIX = {
    UserRole.ADMIN: "a",
    UserRole.MANAGER: "b",
    UserRole.AUDITOR: "c",
    UserRole.OPERATOR: "d",
    UserRole.VIEWER: "e",
}


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR, UserRole.OPERATOR, UserRole.VIEWER])
async def test_all_roles_can_list_lots(client: AsyncClient, db_session: AsyncSession, role: UserRole):
    """All authenticated roles should be able to list lots."""
    suffix = ROLE_UUID_SUFFIX[role]
    user_id = UUID(f"00000000-0000-0000-0000-00000000001{suffix}")
    auth_user = AuthUser(id=user_id, email=f"{role.value.lower()}-param@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email=f"{role.value.lower()}-param@flowviz.test",
        full_name=f"{role.value} Param User",
        role=role,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_test_token(str(user.id), role)

    response = await client.get(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
    )

    # 200 OK - no 403 (forbidden)
    assert response.status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [UserRole.ADMIN, UserRole.MANAGER, UserRole.AUDITOR, UserRole.OPERATOR, UserRole.VIEWER])
async def test_all_roles_can_access_traceability(client: AsyncClient, db_session: AsyncSession, role: UserRole):
    """All authenticated roles should access traceability (compliance requirement)."""
    suffix = ROLE_UUID_SUFFIX[role]
    user_id = UUID(f"00000000-0000-0000-0000-00000000002{suffix}")
    auth_user = AuthUser(id=user_id, email=f"{role.value.lower()}-trace@flowviz.test")
    db_session.add(auth_user)
    await db_session.flush()

    user = User(
        id=user_id,
        email=f"{role.value.lower()}-trace@flowviz.test",
        full_name=f"{role.value} Trace User",
        role=role,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_test_token(str(user.id), role)

    response = await client.get(
        "/api/traceability/TEST-LOT-001",
        headers={"Authorization": f"Bearer {token}"},
    )

    # 200 or 404 (not found) - but NOT 403 (forbidden)
    assert response.status_code in (200, 404)


# --- X-Required-Roles Header Tests ---


@pytest.mark.asyncio
async def test_403_response_includes_required_roles_header(client: AsyncClient, viewer_user: User):
    """403 responses should include X-Required-Roles header."""
    token = create_test_token(str(viewer_user.id), UserRole.VIEWER)

    response = await client.post(
        "/api/lots",
        headers={"Authorization": f"Bearer {token}"},
        json={"lot_code": "TEST-001", "lot_type": "RAW"},
    )

    assert response.status_code == 403
    assert "X-Required-Roles" in response.headers
    required_roles = response.headers["X-Required-Roles"]
    # Should list ADMIN, MANAGER, OPERATOR (CanCreateLots)
    assert "ADMIN" in required_roles
    assert "MANAGER" in required_roles
    assert "OPERATOR" in required_roles
