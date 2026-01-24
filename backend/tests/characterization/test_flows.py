"""Characterization tests for flow definition and version endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.models.flow import FlowDefinition, FlowVersion, FlowVersionStatus
from app.models.user import User, UserRole


# --- Helper Functions ---


async def create_test_flow(db: AsyncSession, user_id: UUID) -> FlowDefinition:
    """Create a test flow definition with initial draft version."""
    flow_def = FlowDefinition(
        name={"hu": "Teszt Folyamat", "en": "Test Flow"},
        description="Test flow for unit tests",
        created_by=user_id,
    )
    db.add(flow_def)
    await db.flush()

    version = FlowVersion(
        flow_definition_id=flow_def.id,
        version_num=1,
        status=FlowVersionStatus.DRAFT.value,
        graph_schema={
            "nodes": [],
            "edges": [],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        },
        created_by=user_id,
    )
    db.add(version)
    await db.flush()
    await db.refresh(flow_def)

    return flow_def


# --- Flow Definition Tests ---


@pytest.mark.asyncio
async def test_create_flow_definition_returns_201(authenticated_client: AsyncClient):
    """Creating a flow definition should return 201 Created."""
    response = await authenticated_client.post(
        "/api/flows",
        json={
            "name": {"hu": "Új Folyamat", "en": "New Flow"},
            "description": "A new test flow",
        },
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_flow_definition_response_shape(authenticated_client: AsyncClient):
    """Flow definition response must have expected fields."""
    response = await authenticated_client.post(
        "/api/flows",
        json={
            "name": {"hu": "Teszt", "en": "Test"},
        },
    )

    data = response.json()
    expected_fields = {"id", "name", "description", "created_by", "created_at", "updated_at"}
    assert expected_fields.issubset(set(data.keys()))
    assert data["name"]["en"] == "Test"
    assert data["name"]["hu"] == "Teszt"


@pytest.mark.asyncio
async def test_list_flow_definitions(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """List flow definitions returns items with version summary."""
    # Create a flow first
    await create_test_flow(db_session, test_operator_user.id)
    await db_session.commit()

    response = await authenticated_client.get("/api/flows")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    # Check list item shape
    item = data[0]
    assert "id" in item
    assert "name" in item
    assert "latest_version_num" in item
    assert "version_count" in item


@pytest.mark.asyncio
async def test_get_flow_definition_not_found(authenticated_client: AsyncClient):
    """Getting a non-existent flow returns 404."""
    response = await authenticated_client.get(
        "/api/flows/00000000-0000-0000-0000-000000000000"
    )

    assert response.status_code == 404


# --- Flow Version Tests ---


@pytest.mark.asyncio
async def test_list_flow_versions(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """List versions returns all versions for a flow."""
    flow = await create_test_flow(db_session, test_operator_user.id)
    await db_session.commit()

    response = await authenticated_client.get(f"/api/flows/{flow.id}/versions")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["version_num"] == 1
    assert data[0]["status"] == "DRAFT"


@pytest.mark.asyncio
async def test_get_flow_version(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """Get a specific version returns full graph schema."""
    flow = await create_test_flow(db_session, test_operator_user.id)
    await db_session.commit()

    response = await authenticated_client.get(f"/api/flows/{flow.id}/versions/1")

    assert response.status_code == 200
    data = response.json()
    assert data["version_num"] == 1
    assert "graph_schema" in data
    assert "nodes" in data["graph_schema"]
    assert "edges" in data["graph_schema"]


@pytest.mark.asyncio
async def test_get_flow_version_not_found(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """Getting a non-existent version returns 404."""
    flow = await create_test_flow(db_session, test_operator_user.id)
    await db_session.commit()

    response = await authenticated_client.get(f"/api/flows/{flow.id}/versions/999")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_draft_version(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """Updating a draft version saves the graph schema."""
    flow = await create_test_flow(db_session, test_operator_user.id)
    await db_session.commit()

    new_graph = {
        "nodes": [
            {
                "id": "start-1",
                "type": "start",
                "position": {"x": 100, "y": 100},
                "data": {
                    "label": {"hu": "Kezdés", "en": "Start"},
                    "nodeType": "start",
                    "config": {},
                },
            },
            {
                "id": "end-1",
                "type": "end",
                "position": {"x": 300, "y": 100},
                "data": {
                    "label": {"hu": "Vége", "en": "End"},
                    "nodeType": "end",
                    "config": {},
                },
            },
        ],
        "edges": [
            {"id": "e1", "source": "start-1", "target": "end-1"},
        ],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }

    response = await authenticated_client.put(
        f"/api/flows/{flow.id}/versions/1",
        json={"graph_schema": new_graph},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["graph_schema"]["nodes"]) == 2
    assert len(data["graph_schema"]["edges"]) == 1


@pytest.mark.asyncio
async def test_update_published_version_fails(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """Updating a published version returns 403."""
    flow = await create_test_flow(db_session, test_operator_user.id)

    # Manually publish the version
    from sqlalchemy import select
    from datetime import datetime, timezone

    stmt = select(FlowVersion).where(FlowVersion.flow_definition_id == flow.id)
    result = await db_session.execute(stmt)
    version = result.scalar_one()
    version.status = FlowVersionStatus.PUBLISHED.value
    version.published_at = datetime.now(timezone.utc)
    await db_session.commit()

    response = await authenticated_client.put(
        f"/api/flows/{flow.id}/versions/1",
        json={
            "graph_schema": {
                "nodes": [],
                "edges": [],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            }
        },
    )

    assert response.status_code == 403
    assert "PUBLISHED" in response.json()["detail"]


# --- Validation Tests ---


@pytest.mark.asyncio
async def test_update_version_validates_edge_references(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """Graph schema validation catches invalid edge references."""
    flow = await create_test_flow(db_session, test_operator_user.id)
    await db_session.commit()

    invalid_graph = {
        "nodes": [
            {
                "id": "start-1",
                "type": "start",
                "position": {"x": 100, "y": 100},
                "data": {
                    "label": {"hu": "Kezdés", "en": "Start"},
                    "nodeType": "start",
                    "config": {},
                },
            },
        ],
        "edges": [
            # Edge references non-existent target
            {"id": "e1", "source": "start-1", "target": "non-existent"},
        ],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }

    response = await authenticated_client.put(
        f"/api/flows/{flow.id}/versions/1",
        json={"graph_schema": invalid_graph},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_version_validates_parent_references(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """Graph schema validation catches invalid parent references."""
    flow = await create_test_flow(db_session, test_operator_user.id)
    await db_session.commit()

    invalid_graph = {
        "nodes": [
            {
                "id": "child-1",
                "type": "process",
                "position": {"x": 100, "y": 100},
                "data": {
                    "label": {"hu": "Gyermek", "en": "Child"},
                    "nodeType": "process",
                    "config": {},
                },
                "parentId": "non-existent-parent",  # Invalid parent
            },
        ],
        "edges": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }

    response = await authenticated_client.put(
        f"/api/flows/{flow.id}/versions/1",
        json={"graph_schema": invalid_graph},
    )

    assert response.status_code == 422


# --- Publish Tests ---
# Note: These tests require a MANAGER user for the publish endpoint


@pytest.mark.asyncio
async def test_fork_version(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """Forking a version creates a new draft."""
    flow = await create_test_flow(db_session, test_operator_user.id)

    # Publish the first version manually
    from sqlalchemy import select
    from datetime import datetime, timezone

    stmt = select(FlowVersion).where(FlowVersion.flow_definition_id == flow.id)
    result = await db_session.execute(stmt)
    version = result.scalar_one()
    version.status = FlowVersionStatus.PUBLISHED.value
    version.published_at = datetime.now(timezone.utc)
    await db_session.commit()

    # Fork from published version
    response = await authenticated_client.post(f"/api/flows/{flow.id}/versions/1/fork")

    assert response.status_code == 200
    data = response.json()
    assert data["version_num"] == 2
    assert data["status"] == "DRAFT"


@pytest.mark.asyncio
async def test_fork_fails_if_draft_exists(
    authenticated_client: AsyncClient, db_session: AsyncSession, test_operator_user: User
):
    """Forking fails if a draft already exists."""
    flow = await create_test_flow(db_session, test_operator_user.id)
    await db_session.commit()

    # Try to fork when draft already exists
    response = await authenticated_client.post(f"/api/flows/{flow.id}/versions/1/fork")

    assert response.status_code == 409
    assert "draft" in response.json()["detail"].lower()


# --- RBAC Tests ---


@pytest.mark.asyncio
async def test_create_flow_requires_authentication(client: AsyncClient):
    """Creating a flow without auth returns 401."""
    response = await client.post(
        "/api/flows",
        json={
            "name": {"hu": "Teszt", "en": "Test"},
        },
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_flows_requires_authentication(client: AsyncClient):
    """Listing flows without auth returns 401."""
    response = await client.get("/api/flows")

    assert response.status_code == 401


# --- Model Default Tests ---


@pytest.mark.asyncio
async def test_flow_version_graph_schema_default_independence(
    db_session: AsyncSession, test_operator_user: User
):
    """
    Each FlowVersion instance should get its own independent graph_schema default.

    Verifies that the ORM default for graph_schema creates separate dict instances
    for each FlowVersion, not a shared mutable default.
    """
    # Create a flow definition
    flow_def = FlowDefinition(
        name={"hu": "Teszt", "en": "Test"},
        created_by=test_operator_user.id,
    )
    db_session.add(flow_def)
    await db_session.flush()

    # Create two versions WITHOUT passing graph_schema (relying on the default)
    version1 = FlowVersion(
        flow_definition_id=flow_def.id,
        version_num=1,
        status=FlowVersionStatus.DRAFT.value,
        created_by=test_operator_user.id,
        # graph_schema not provided - should use default
    )
    version2 = FlowVersion(
        flow_definition_id=flow_def.id,
        version_num=2,
        status=FlowVersionStatus.DRAFT.value,
        created_by=test_operator_user.id,
        # graph_schema not provided - should use default
    )
    db_session.add(version1)
    db_session.add(version2)
    await db_session.flush()

    # Verify both have the expected default structure
    expected_default = {"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}
    assert version1.graph_schema == expected_default
    assert version2.graph_schema == expected_default

    # Mutate version1's graph_schema
    version1.graph_schema["nodes"].append({"id": "test-node"})

    # Verify mutation doesn't affect version2 (independent dicts)
    assert len(version1.graph_schema["nodes"]) == 1
    assert len(version2.graph_schema["nodes"]) == 0, "Mutation of version1 affected version2 - defaults are shared!"

    # Commit and reload from DB to verify independence persists
    await db_session.commit()
    await db_session.refresh(version1)
    await db_session.refresh(version2)

    assert len(version1.graph_schema["nodes"]) == 1
    assert len(version2.graph_schema["nodes"]) == 0
