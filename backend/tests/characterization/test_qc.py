"""Characterization tests for QC decisions endpoint with snapshot validation and negative coverage."""

import pytest
from httpx import AsyncClient


# --- Success Tests ---


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
async def test_create_qc_decision_success_snapshot(client: AsyncClient, snapshot):
    """
    Snapshot test: QC decision success response.

    Golden snapshot captures response shape with normalized dynamic fields.
    """
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "PASS",
            "notes": "Snapshot test notes",
            "temperature_c": 4.0,
        },
    )
    assert response.status_code == 201

    data = response.json()
    # Normalize dynamic fields
    data["id"] = "NORMALIZED"
    data["decided_at"] = "NORMALIZED"

    assert data == snapshot


# --- Negative Tests: HOLD Decision Validation ---


@pytest.mark.asyncio
async def test_hold_decision_without_notes_returns_422(client: AsyncClient):
    """HOLD decision without notes must return 422."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "HOLD",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_hold_decision_with_short_notes_returns_422(client: AsyncClient):
    """HOLD decision with notes < 10 chars must return 422."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "HOLD",
            "notes": "short",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_hold_decision_with_exactly_10_chars_succeeds(client: AsyncClient):
    """HOLD decision with exactly 10 character notes should succeed."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "HOLD",
            "notes": "1234567890",  # Exactly 10 chars
        },
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_hold_decision_with_valid_notes_succeeds(client: AsyncClient):
    """HOLD decision with proper notes (>=10 chars) should succeed."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "HOLD",
            "notes": "Temperature out of range, holding for review",
        },
    )
    assert response.status_code == 201


# --- Negative Tests: FAIL Decision Validation ---


@pytest.mark.asyncio
async def test_fail_decision_without_notes_returns_422(client: AsyncClient):
    """FAIL decision without notes must return 422."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "FAIL",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_fail_decision_with_short_notes_returns_422(client: AsyncClient):
    """FAIL decision with notes < 10 chars must return 422."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "FAIL",
            "notes": "short",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_fail_decision_with_valid_notes_succeeds(client: AsyncClient):
    """FAIL decision with proper notes (>=10 chars) should succeed."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "FAIL",
            "notes": "Contamination detected, batch rejected",
        },
    )
    assert response.status_code == 201


# --- Negative Tests: Parametrized HOLD/FAIL Validation ---


@pytest.mark.asyncio
@pytest.mark.parametrize("decision", ["HOLD", "FAIL"])
async def test_hold_fail_requires_notes_parametrized(client: AsyncClient, decision: str):
    """HOLD/FAIL decisions require notes (min 10 chars) - parametrized."""
    response = await client.post(
        "/api/qc-decisions",
        json={"decision": decision},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("decision", ["HOLD", "FAIL"])
async def test_hold_fail_notes_min_length_parametrized(client: AsyncClient, decision: str):
    """Notes must be at least 10 characters for HOLD/FAIL - parametrized."""
    response = await client.post(
        "/api/qc-decisions",
        json={"decision": decision, "notes": "short"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("decision", ["HOLD", "FAIL"])
async def test_hold_fail_with_valid_notes_parametrized(client: AsyncClient, decision: str):
    """HOLD/FAIL with proper notes (>=10 chars) succeeds - parametrized."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": decision,
            "notes": f"Valid notes for {decision} decision - sufficient length",
        },
    )
    assert response.status_code == 201


# --- Success Tests: PASS Decision ---


@pytest.mark.asyncio
async def test_pass_decision_without_notes_succeeds(client: AsyncClient):
    """PASS decision does NOT require notes."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "PASS",
        },
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_pass_decision_with_optional_notes_succeeds(client: AsyncClient):
    """PASS decision can optionally include notes."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "PASS",
            "notes": "No issues found",
        },
    )
    assert response.status_code == 201


# --- Negative Tests: Invalid Decision Enum ---


@pytest.mark.asyncio
async def test_invalid_decision_enum_returns_422(client: AsyncClient):
    """Invalid decision enum value must return 422."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "INVALID",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_decision",
    ["pass", "HOLD ", "fail", "PASSED", "REJECT", ""],
)
async def test_various_invalid_decision_values_return_422(
    client: AsyncClient, invalid_decision: str
):
    """Various invalid decision values must return 422."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": invalid_decision,
        },
    )
    assert response.status_code == 422


# --- Success Tests: Valid Decision Enums ---


@pytest.mark.asyncio
@pytest.mark.parametrize("decision", ["PASS", "HOLD", "FAIL"])
async def test_all_valid_decisions_work(client: AsyncClient, decision: str):
    """All valid decision enum values should work (with notes for HOLD/FAIL)."""
    payload = {"decision": decision}
    if decision in ("HOLD", "FAIL"):
        payload["notes"] = f"Required notes for {decision} decision"

    response = await client.post("/api/qc-decisions", json=payload)
    assert response.status_code == 201
    assert response.json()["decision"] == decision


# --- Edge Case Tests ---


@pytest.mark.asyncio
async def test_qc_decision_with_all_optional_fields(client: AsyncClient):
    """QC decision can include all optional fields."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "decision": "PASS",
            "notes": "Comprehensive check completed",
            "temperature_c": 4.2,
            "digital_signature": "sig_123abc",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["digital_signature"] == "sig_123abc"


@pytest.mark.asyncio
async def test_qc_decision_with_no_decision_succeeds(client: AsyncClient):
    """QC decision can be created without a decision (for draft/pending state)."""
    response = await client.post(
        "/api/qc-decisions",
        json={
            "temperature_c": 5.0,
        },
    )
    assert response.status_code == 201
    assert response.json()["decision"] is None
