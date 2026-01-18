"""Characterization tests for traceability endpoint."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lot import Lot, LotGenealogy, LotType


@pytest.fixture
async def test_lots(db_session: AsyncSession) -> dict[str, Lot]:
    """Create test lots with genealogy for traceability tests."""
    # Create parent lots (RAW materials)
    raw_beef = Lot(
        id="11111111-1111-1111-1111-111111111101",
        lot_code="RAW-BEEF-001",
        lot_type=LotType.RAW,
        weight_kg=500.0,
    )
    raw_spice = Lot(
        id="11111111-1111-1111-1111-111111111102",
        lot_code="RAW-SPICE-001",
        lot_type=LotType.RAW,
        weight_kg=50.0,
    )

    # Create MIX lot (child of RAW, parent of FG)
    mix_batch = Lot(
        id="22222222-2222-2222-2222-222222222201",
        lot_code="MIX-BATCH-88",
        lot_type=LotType.MIX,
        weight_kg=540.0,
    )

    # Create FG lot (child of MIX)
    fg_doner = Lot(
        id="33333333-3333-3333-3333-333333333301",
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


@pytest.mark.asyncio
async def test_traceability_returns_200(client: AsyncClient, test_lots: dict):
    """Traceability endpoint should return 200 for existing lot."""
    response = await client.get("/api/traceability/MIX-BATCH-88")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_traceability_returns_404_for_unknown_lot(client: AsyncClient):
    """Traceability endpoint should return 404 for unknown lot."""
    response = await client.get("/api/traceability/UNKNOWN-LOT")
    assert response.status_code == 404


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
