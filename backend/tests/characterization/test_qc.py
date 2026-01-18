"""Characterization tests for QC decisions endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_qc_decision_returns_201(client: AsyncClient):
    """Creating a QC decision should return 201 Created."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "PASS",
            "temperature_c": 4.5,
        },
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_qc_decision_response_shape(client: AsyncClient):
    """
    QC decision response shape must match Node/Express.

    Expected: Returns the created decision with all fields.
    """
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "PASS",
            "notes": "All checks passed",
            "temperature_c": 3.8,
        },
    )

    data = response.json()

    # Must have expected fields
    expected_fields = {
        "id",
        "lot_id",
        "qc_gate_id",
        "operator_id",
        "decision",
        "notes",
        "temperature_c",
        "digital_signature",
        "decided_at",
    }
    assert expected_fields.issubset(set(data.keys()))

    # Values should match input
    assert data["decision"] == "PASS"
    assert data["notes"] == "All checks passed"


@pytest.mark.asyncio
async def test_hold_decision_requires_notes(client: AsyncClient):
    """HOLD decision requires notes (min 10 chars)."""
    # Without notes - should fail validation
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "HOLD",
        },
    )
    assert response.status_code == 422  # Validation error

    # With short notes - should fail
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "HOLD",
            "notes": "short",
        },
    )
    assert response.status_code == 422

    # With proper notes - should succeed
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "HOLD",
            "notes": "Temperature out of range, holding for review",
        },
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_fail_decision_requires_notes(client: AsyncClient):
    """FAIL decision requires notes (min 10 chars)."""
    # With proper notes - should succeed
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "FAIL",
            "notes": "Contamination detected, batch rejected",
        },
    )
    assert response.status_code == 201
