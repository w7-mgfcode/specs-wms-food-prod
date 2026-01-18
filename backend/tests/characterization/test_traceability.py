"""Characterization tests for traceability endpoint with snapshot validation."""

from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lot import Lot, LotGenealogy, LotType


@pytest.fixture
async def test_lots(db_session: AsyncSession) -> dict[str, Lot]:
    """Create test lots with genealogy for traceability tests."""
    # Create parent lots (RAW materials)
    raw_beef = Lot(
        id=UUID("11111111-1111-1111-1111-111111111101"),
        lot_code="RAW-BEEF-001",
        lot_type=LotType.RAW,
        weight_kg=500.0,
    )
    raw_spice = Lot(
        id=UUID("11111111-1111-1111-1111-111111111102"),
        lot_code="RAW-SPICE-001",
        lot_type=LotType.RAW,
        weight_kg=50.0,
    )

    # Create MIX lot (child of RAW, parent of FG)
    mix_batch = Lot(
        id=UUID("22222222-2222-2222-2222-222222222201"),
        lot_code="MIX-BATCH-88",
        lot_type=LotType.MIX,
        weight_kg=540.0,
    )

    # Create FG lot (child of MIX)
    fg_doner = Lot(
        id=UUID("33333333-3333-3333-3333-333333333301"),
        lot_code="FG-DONER-X1",
        lot_type=LotType.FG,
        weight_kg=530.0,
    )

    db_session.add_all([raw_beef, raw_spice, mix_batch, fg_doner])
    await db_session.flush()

    # Create genealogy links
    # RAW -> MIX
    link1 = LotGenealogy(
        parent_lot_id=raw_beef.id,
        child_lot_id=mix_batch.id,
        quantity_used_kg=500.0,
    )
    link2 = LotGenealogy(
        parent_lot_id=raw_spice.id,
        child_lot_id=mix_batch.id,
        quantity_used_kg=40.0,
    )
    # MIX -> FG
    link3 = LotGenealogy(
        parent_lot_id=mix_batch.id,
        child_lot_id=fg_doner.id,
        quantity_used_kg=530.0,
    )

    db_session.add_all([link1, link2, link3])
    await db_session.commit()

    return {
        "raw_beef": raw_beef,
        "raw_spice": raw_spice,
        "mix_batch": mix_batch,
        "fg_doner": fg_doner,
    }


# --- Success Tests ---


@pytest.mark.asyncio
async def test_traceability_returns_200(client: AsyncClient, test_lots: dict):
    """Traceability endpoint should return 200 for existing lot."""
    response = await client.get("/api/traceability/MIX-BATCH-88")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_traceability_response_shape(client: AsyncClient, test_lots: dict):
    """
    Traceability response shape must match Node/Express.

    Expected: {"central": {...}, "parents": [...], "children": [...]}
    """
    response = await client.get("/api/traceability/MIX-BATCH-88")
    data = response.json()

    # Must have exactly these keys
    assert set(data.keys()) == {"central", "parents", "children"}

    # Central should be the MIX lot
    assert data["central"]["lot_code"] == "MIX-BATCH-88"
    assert data["central"]["lot_type"] == "MIX"

    # Parents should be 2 RAW lots
    assert isinstance(data["parents"], list)
    assert len(data["parents"]) == 2
    parent_codes = {p["lot_code"] for p in data["parents"]}
    assert parent_codes == {"RAW-BEEF-001", "RAW-SPICE-001"}

    # Children should be 1 FG lot
    assert isinstance(data["children"], list)
    assert len(data["children"]) == 1
    assert data["children"][0]["lot_code"] == "FG-DONER-X1"


@pytest.mark.asyncio
async def test_traceability_for_leaf_lot(client: AsyncClient, test_lots: dict):
    """Leaf lot (FG) should have parents but no children."""
    response = await client.get("/api/traceability/FG-DONER-X1")
    data = response.json()

    assert data["central"]["lot_code"] == "FG-DONER-X1"
    assert len(data["parents"]) == 1  # MIX-BATCH-88
    assert len(data["children"]) == 0


@pytest.mark.asyncio
async def test_traceability_for_root_lot(client: AsyncClient, test_lots: dict):
    """Root lot (RAW) should have children but no parents."""
    response = await client.get("/api/traceability/RAW-BEEF-001")
    data = response.json()

    assert data["central"]["lot_code"] == "RAW-BEEF-001"
    assert len(data["parents"]) == 0
    assert len(data["children"]) == 1  # MIX-BATCH-88


@pytest.mark.asyncio
async def test_traceability_success_snapshot(client: AsyncClient, test_lots: dict, snapshot):
    """
    Snapshot test: Traceability success response.

    Golden snapshot captures response structure with normalized dynamic fields.
    """
    response = await client.get("/api/traceability/MIX-BATCH-88")
    assert response.status_code == 200

    data = response.json()
    # Normalize dynamic fields
    data["central"]["created_at"] = "NORMALIZED"
    for parent in data["parents"]:
        parent["created_at"] = "NORMALIZED"
    for child in data["children"]:
        child["created_at"] = "NORMALIZED"

    # Sort parents for consistent snapshot comparison
    data["parents"] = sorted(data["parents"], key=lambda x: x["lot_code"])

    assert data == snapshot


# --- Failure Tests ---


@pytest.mark.asyncio
async def test_traceability_returns_404_for_unknown_lot(client: AsyncClient):
    """Traceability endpoint should return 404 for unknown lot."""
    response = await client.get("/api/traceability/UNKNOWN-LOT")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_traceability_not_found_snapshot(client: AsyncClient, snapshot):
    """
    Snapshot test: Traceability 404 response.

    Golden snapshot captures error format.
    """
    response = await client.get("/api/traceability/NONEXISTENT-LOT-CODE")
    assert response.status_code == 404

    assert response.json() == snapshot


@pytest.mark.asyncio
async def test_traceability_empty_lot_code_returns_404(client: AsyncClient):
    """Empty lot code in URL should return 404 (or route not matched)."""
    # Note: FastAPI routing may handle this differently
    # This tests the behavior when a valid-looking but non-existent code is used
    response = await client.get("/api/traceability/---")
    assert response.status_code == 404


# --- Edge Case Tests ---


@pytest.mark.asyncio
async def test_traceability_special_characters_in_lot_code(
    client: AsyncClient, db_session: AsyncSession
):
    """Lot codes with special characters should be handled correctly."""
    # Create a lot with special characters in the code
    special_lot = Lot(
        id=UUID("44444444-4444-4444-4444-444444444401"),
        lot_code="LOT-2026/01/18-A",
        lot_type=LotType.RAW,
        weight_kg=100.0,
    )
    db_session.add(special_lot)
    await db_session.commit()

    # URL encoding should handle the slash
    response = await client.get("/api/traceability/LOT-2026%2F01%2F18-A")
    # Encoded slashes are treated as path separators by Starlette/FastAPI
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_traceability_isolated_lot_has_no_relatives(
    client: AsyncClient, db_session: AsyncSession
):
    """A lot with no genealogy links should have empty parents and children."""
    # Create an isolated lot
    isolated_lot = Lot(
        id=UUID("55555555-5555-5555-5555-555555555501"),
        lot_code="ISOLATED-LOT-001",
        lot_type=LotType.BULK,
        weight_kg=200.0,
    )
    db_session.add(isolated_lot)
    await db_session.commit()

    response = await client.get("/api/traceability/ISOLATED-LOT-001")
    assert response.status_code == 200

    data = response.json()
    assert data["central"]["lot_code"] == "ISOLATED-LOT-001"
    assert len(data["parents"]) == 0
    assert len(data["children"]) == 0


@pytest.mark.asyncio
async def test_traceability_central_lot_fields_complete(client: AsyncClient, test_lots: dict):
    """Central lot in response should have all expected fields."""
    response = await client.get("/api/traceability/MIX-BATCH-88")
    data = response.json()

    central = data["central"]
    expected_fields = {
        "id",
        "lot_code",
        "lot_type",
        "production_run_id",
        "phase_id",
        "operator_id",
        "weight_kg",
        "temperature_c",
        "metadata",
        "created_at",
    }
    assert expected_fields.issubset(set(central.keys()))
