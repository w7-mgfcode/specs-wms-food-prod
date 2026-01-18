"""Characterization tests for lots endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_lot_returns_201(client: AsyncClient):
    """Creating a lot should return 201 Created."""
    response = await client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-001",
            "lot_type": "RAW",
            "weight_kg": 100.5,
            "temperature_c": 4.0,
        },
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_lot_response_shape(client: AsyncClient):
    """
    Lot creation response shape must match Node/Express.

    Expected: Returns the created lot with all fields.
    """
    response = await client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-002",
            "lot_type": "MIX",
            "weight_kg": 250.0,
        },
    )

    data = response.json()

    # Must have expected fields
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
    assert expected_fields.issubset(set(data.keys()))

    # Values should match input
    assert data["lot_code"] == "TEST-LOT-002"
    assert data["lot_type"] == "MIX"
    assert float(data["weight_kg"]) == 250.0


@pytest.mark.asyncio
async def test_create_lot_with_minimal_data(client: AsyncClient):
    """Lot can be created with just lot_code (other fields optional)."""
    response = await client.post(
        "/api/lots",
        json={"lot_code": "TEST-LOT-MINIMAL"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["lot_code"] == "TEST-LOT-MINIMAL"
    assert data["lot_type"] is None


@pytest.mark.asyncio
async def test_create_lot_with_metadata(client: AsyncClient):
    """Lot can include custom metadata."""
    response = await client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-META",
            "metadata": {"supplier": "ACME", "batch_number": "B001"},
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["metadata"]["supplier"] == "ACME"
