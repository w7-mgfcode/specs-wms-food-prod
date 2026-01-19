"""Characterization tests for lots endpoint with snapshot validation and negative coverage."""

import pytest
from httpx import AsyncClient

# --- Success Tests ---


@pytest.mark.asyncio
async def test_create_lot_returns_201(authenticated_client: AsyncClient):
    """Creating a lot should return 201 Created."""
    response = await authenticated_client.post(
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
async def test_create_lot_response_shape(authenticated_client: AsyncClient):
    """
    Lot creation response shape must match Node/Express.

    Expected: Returns the created lot with all fields.
    """
    response = await authenticated_client.post(
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
async def test_create_lot_with_minimal_data(authenticated_client: AsyncClient):
    """Lot can be created with just lot_code (other fields optional)."""
    response = await authenticated_client.post(
        "/api/lots",
        json={"lot_code": "TEST-LOT-MINIMAL"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["lot_code"] == "TEST-LOT-MINIMAL"
    assert data["lot_type"] is None


@pytest.mark.asyncio
async def test_create_lot_with_metadata(authenticated_client: AsyncClient):
    """Lot can include custom metadata."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-META",
            "metadata": {"supplier": "ACME", "batch_number": "B001"},
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["metadata"]["supplier"] == "ACME"


@pytest.mark.asyncio
async def test_create_lot_success_snapshot(authenticated_client: AsyncClient, snapshot):
    """
    Snapshot test: Lot creation success response.

    Golden snapshot captures response shape with normalized dynamic fields.
    """
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": "SNAPSHOT-LOT",
            "lot_type": "RAW",
            "weight_kg": 100.5,
            "temperature_c": 4.0,
        },
    )
    assert response.status_code == 201

    data = response.json()
    # Normalize dynamic fields
    data["id"] = "NORMALIZED"
    data["created_at"] = "NORMALIZED"

    assert data == snapshot


# --- Negative Tests: Missing Required Fields ---


@pytest.mark.asyncio
async def test_create_lot_missing_lot_code_returns_422(authenticated_client: AsyncClient):
    """Lot creation must fail with 422 when lot_code is missing."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            # "lot_code" is intentionally omitted
            "lot_type": "RAW",
            "weight_kg": 100.5,
            "temperature_c": 4.0,
        },
    )

    assert response.status_code == 422


# --- Negative Tests: Weight Boundary Validation ---


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "weight,description",
    [
        (-1.0, "negative weight"),
        (-0.01, "small negative weight"),
    ],
)
async def test_create_lot_negative_weight_returns_422(
    authenticated_client: AsyncClient, weight: float, description: str
):
    """Lot creation must fail with 422 when weight_kg is negative."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": f"TEST-LOT-{description.replace(' ', '-').upper()}",
            "weight_kg": weight,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "weight,description",
    [
        (10001.0, "over max by 1"),
        (15000.0, "significantly over max"),
    ],
)
async def test_create_lot_over_max_weight_returns_422(
    authenticated_client: AsyncClient, weight: float, description: str
):
    """Lot creation must fail with 422 when weight_kg exceeds the allowed upper bound (10000)."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": f"TEST-LOT-{description.replace(' ', '-').upper()}",
            "weight_kg": weight,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lot_at_max_weight_boundary_succeeds(authenticated_client: AsyncClient):
    """Lot creation should succeed at the exact max weight boundary (10000)."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-MAX-WEIGHT",
            "weight_kg": 10000.0,
        },
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_lot_at_zero_weight_succeeds(authenticated_client: AsyncClient):
    """Lot creation should succeed at zero weight (boundary)."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-ZERO-WEIGHT",
            "weight_kg": 0.0,
        },
    )

    assert response.status_code == 201


# --- Negative Tests: Temperature Boundary Validation ---


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "temp,description",
    [
        (-51.0, "below min by 1"),
        (-100.0, "significantly below min"),
    ],
)
async def test_create_lot_temperature_below_min_returns_422(
    authenticated_client: AsyncClient, temp: float, description: str
):
    """Lot creation must fail with 422 when temperature_c is below the allowed range (-50)."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": f"TEST-LOT-{description.replace(' ', '-').upper()}",
            "temperature_c": temp,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "temp,description",
    [
        (101.0, "above max by 1"),
        (200.0, "significantly above max"),
    ],
)
async def test_create_lot_temperature_above_max_returns_422(
    authenticated_client: AsyncClient, temp: float, description: str
):
    """Lot creation must fail with 422 when temperature_c is above the allowed range (100)."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": f"TEST-LOT-{description.replace(' ', '-').upper()}",
            "temperature_c": temp,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_lot_at_min_temperature_boundary_succeeds(authenticated_client: AsyncClient):
    """Lot creation should succeed at the exact min temperature boundary (-50)."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-MIN-TEMP",
            "temperature_c": -50.0,
        },
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_lot_at_max_temperature_boundary_succeeds(authenticated_client: AsyncClient):
    """Lot creation should succeed at the exact max temperature boundary (100)."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-MAX-TEMP",
            "temperature_c": 100.0,
        },
    )

    assert response.status_code == 201


# --- Negative Tests: Lot Type Enum Validation ---


@pytest.mark.asyncio
async def test_create_lot_invalid_lot_type_returns_422(authenticated_client: AsyncClient):
    """Lot creation must fail with 422 when lot_type is not a valid enum value."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": "TEST-LOT-INVALID-TYPE",
            "lot_type": "INVALID",
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "lot_type",
    ["RAW", "DEB", "BULK", "MIX", "SKW", "FRZ", "FG"],
)
async def test_create_lot_valid_lot_types_succeed(authenticated_client: AsyncClient, lot_type: str):
    """All valid lot types should be accepted."""
    response = await authenticated_client.post(
        "/api/lots",
        json={
            "lot_code": f"TEST-LOT-{lot_type}",
            "lot_type": lot_type,
        },
    )

    assert response.status_code == 201
    assert response.json()["lot_type"] == lot_type
