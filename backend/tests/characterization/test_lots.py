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


# --- Validation / Edge-case Tests ---


@pytest.mark.asyncio
async def test_create_lot_missing_lot_code_returns_422(client: AsyncClient):
    """Lot creation must fail with 422 when lot_code is missing."""
    response = await client.post(
        "/api/lots",
        json={
            # "lot_code" is intentionally omitted
            "lot_type": "RAW",
            "weight_kg": 100.5,
            "temperature_c": 4.0,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lot_negative_weight_returns_422(client: AsyncClient):
    """Lot creation must fail with 422 when weight_kg is negative."""
    response = await client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-NEG",
            "lot_type": "RAW",
            "weight_kg": -1.0,
            "temperature_c": 4.0,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lot_over_max_weight_returns_422(client: AsyncClient):
    """Lot creation must fail with 422 when weight_kg exceeds the allowed upper bound (10000)."""
    response = await client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-OVERMAX",
            "lot_type": "RAW",
            "weight_kg": 10001.0,  # Schema allows max 10000
            "temperature_c": 4.0,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lot_temperature_below_min_returns_422(client: AsyncClient):
    """Lot creation must fail with 422 when temperature_c is below the allowed range (-50)."""
    response = await client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-COLD",
            "lot_type": "RAW",
            "weight_kg": 100.5,
            "temperature_c": -100.0,  # Schema allows min -50
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lot_temperature_above_max_returns_422(client: AsyncClient):
    """Lot creation must fail with 422 when temperature_c is above the allowed range (100)."""
    response = await client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-HOT",
            "lot_type": "RAW",
            "weight_kg": 100.5,
            "temperature_c": 200.0,  # Schema allows max 100
        },
    )

    assert response.status_code == 422
